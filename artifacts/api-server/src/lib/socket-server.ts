import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger";
import { chessEngine } from "./chess-engine";
import type { GameState } from "./chess-engine";
import { db, chatMessagesTable, chessGamesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { gameRoomManager } from "./game-room-manager";

let io: SocketIOServer | null = null;

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// 2-minute abandonment timeout
const DISCONNECT_TIMEOUT_MS = 2 * 60 * 1000;

// Matchmaking queue: userId -> socketId
const matchmakingQueue = new Map<string, string>();

// Spectators: gameId -> Set<socketId>
const spectatorMap = new Map<string, Set<string>>();

// Player-socket session tracking
// socketId -> { gameId, userId }
const playerGameMap = new Map<string, { gameId: string; userId: string }>();
// gameId -> Map<userId, socketId>
const gamePlayerSockets = new Map<string, Map<string, string>>();
// Abandonment timers: `${gameId}:${userId}` -> NodeJS.Timeout
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function getSpectatorCount(gameId: string): number {
  return spectatorMap.get(gameId)?.size ?? 0;
}

function broadcastSpectatorCount(gameId: string): void {
  if (io) {
    io.to(`game:${gameId}`).emit("spectatorCount", { count: getSpectatorCount(gameId) });
  }
}

async function endGameByAbandonment(gameId: string, loserUserId: string): Promise<void> {
  try {
    const [game] = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.id, gameId));

    if (!game || game.status !== "active") return;

    const winner = game.whitePlayerId === loserUserId ? "black" : "white";

    await db
      .update(chessGamesTable)
      .set({ status: "completed", winner, updatedAt: new Date() })
      .where(and(eq(chessGamesTable.id, gameId), eq(chessGamesTable.status, "active")));

    io?.to(`game:${gameId}`).emit("opponentAbandonedGame", { winner, loserUserId });
    logger.info({ gameId, loserUserId, winner }, "Game ended by abandonment");

    // Cleanup game room
    gamePlayerSockets.get(gameId)?.delete(loserUserId);
  } catch (err) {
    logger.error({ err }, "Failed to end game by abandonment");
  }
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    socket.emit("gameUpdate", chessEngine.getState());
    socket.emit("arduinoStatus", { connected: chessEngine.isArduinoConnected() });

    // ── Join game ─────────────────────────────────────────────────
    socket.on("joinGame", ({ gameId, userId }: { gameId: string; userId?: string }) => {
      socket.join(`game:${gameId}`);
      logger.info({ socketId: socket.id, gameId, userId }, "Client joined game room");

      if (userId) {
        // Register player-socket mapping
        playerGameMap.set(socket.id, { gameId, userId });
        if (!gamePlayerSockets.has(gameId)) {
          gamePlayerSockets.set(gameId, new Map());
        }
        gamePlayerSockets.get(gameId)!.set(userId, socket.id);

        // Cancel any pending disconnect timer (player reconnected)
        const timerKey = `${gameId}:${userId}`;
        if (disconnectTimers.has(timerKey)) {
          clearTimeout(disconnectTimers.get(timerKey)!);
          disconnectTimers.delete(timerKey);
          // Notify the room (opponent) that player came back
          socket.to(`game:${gameId}`).emit("opponentReconnected", { userId });
          logger.info({ gameId, userId }, "Player reconnected — abandonment timer cancelled");
        }
      }

      socket.emit("spectatorCount", { count: getSpectatorCount(gameId) });
    });

    socket.on("leaveGame", ({ gameId }: { gameId: string }) => {
      socket.leave(`game:${gameId}`);
      // Clean player tracking
      const session = playerGameMap.get(socket.id);
      if (session && session.gameId === gameId) {
        playerGameMap.delete(socket.id);
        gamePlayerSockets.get(gameId)?.delete(session.userId);
      }
    });

    socket.on("registerUser", ({ userId }: { userId: string }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        logger.info({ socketId: socket.id, userId }, "Client registered personal room");
      }
    });

    // ── Spectator ─────────────────────────────────────────────────
    socket.on("joinSpectator", ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      socket.join(`game:${gameId}`);
      if (!spectatorMap.has(gameId)) spectatorMap.set(gameId, new Set());
      spectatorMap.get(gameId)!.add(socket.id);
      logger.info({ socketId: socket.id, gameId }, "Spectator joined");
      broadcastSpectatorCount(gameId);
    });

    socket.on("leaveSpectator", ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      socket.leave(`game:${gameId}`);
      spectatorMap.get(gameId)?.delete(socket.id);
      logger.info({ socketId: socket.id, gameId }, "Spectator left");
      broadcastSpectatorCount(gameId);
    });

    // ── Matchmaking ──────────────────────────────────────────────
    socket.on("joinMatchmaking", async ({ userId }: { userId: string }) => {
      if (!userId) return;
      logger.info({ socketId: socket.id, userId }, "Player joining matchmaking queue");

      matchmakingQueue.delete(userId);

      const waiting = [...matchmakingQueue.entries()].find(([uid]) => uid !== userId);

      if (waiting) {
        const [opponentId] = waiting;
        matchmakingQueue.delete(opponentId);

        try {
          const [whiteId, blackId] =
            Math.random() < 0.5 ? [opponentId, userId] : [userId, opponentId];

          const [game] = await db
            .insert(chessGamesTable)
            .values({
              whitePlayerId: whiteId,
              blackPlayerId: blackId,
              status: "active",
              fen: INITIAL_FEN,
            })
            .returning();

          gameRoomManager.getOrCreate(game.id);
          logger.info({ gameId: game.id, whiteId, blackId }, "Match found");

          const allUsers = await db.select().from(usersTable);
          const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

          const newPlayer = userMap[userId];
          const waitingPlayer = userMap[opponentId];

          const newPlayerProfile = {
            nickname: newPlayer?.nickname || newPlayer?.username || "Opponent",
            avatarColor: newPlayer?.avatarColor || "#3b82f6",
            country: newPlayer?.country || null,
          };
          const waitingPlayerProfile = {
            nickname: waitingPlayer?.nickname || waitingPlayer?.username || "Opponent",
            avatarColor: waitingPlayer?.avatarColor || "#3b82f6",
            country: waitingPlayer?.country || null,
          };

          io?.to(`user:${opponentId}`).emit("matchFound", {
            gameId: game.id,
            opponentId: userId,
            opponentNickname: newPlayerProfile.nickname,
            opponentAvatarColor: newPlayerProfile.avatarColor,
            opponentCountry: newPlayerProfile.country,
          });

          io?.to(`user:${userId}`).emit("matchFound", {
            gameId: game.id,
            opponentId: opponentId,
            opponentNickname: waitingPlayerProfile.nickname,
            opponentAvatarColor: waitingPlayerProfile.avatarColor,
            opponentCountry: waitingPlayerProfile.country,
          });
        } catch (err) {
          logger.error({ err }, "Failed to create matched game");
          socket.emit("matchmakingError", { message: "Failed to create game" });
        }
      } else {
        matchmakingQueue.set(userId, socket.id);
        socket.emit("matchmakingQueued", { position: matchmakingQueue.size });
        logger.info({ userId, queueSize: matchmakingQueue.size }, "Player added to queue");
      }
    });

    socket.on("leaveMatchmaking", ({ userId }: { userId: string }) => {
      if (userId) {
        matchmakingQueue.delete(userId);
        logger.info({ userId }, "Player left matchmaking queue");
      }
    });

    // ── Chat ─────────────────────────────────────────────────────
    socket.on(
      "sendMessage",
      async ({
        gameId,
        userId,
        username,
        message,
      }: {
        gameId: string;
        userId: string;
        username: string;
        message: string;
      }) => {
        if (!gameId || !userId || !message?.trim()) return;

        try {
          const [saved] = await db
            .insert(chatMessagesTable)
            .values({ gameId, userId, username, message: message.trim() })
            .returning();

          io?.to(`game:${gameId}`).emit("chatMessage", saved);
        } catch (err) {
          logger.error({ err }, "Failed to save chat message");
        }
      }
    );

    // ── Resign ───────────────────────────────────────────────────
    socket.on(
      "resignGame",
      async ({ gameId, userId }: { gameId: string; userId: string }) => {
        if (!gameId || !userId) return;

        try {
          const [game] = await db
            .select()
            .from(chessGamesTable)
            .where(eq(chessGamesTable.id, gameId));

          if (!game || game.status !== "active") return;

          const isWhite = game.whitePlayerId === userId;
          const isBlack = game.blackPlayerId === userId;
          if (!isWhite && !isBlack) return;

          const winner = isWhite ? "black" : "white";

          await db
            .update(chessGamesTable)
            .set({ status: "completed", winner, updatedAt: new Date() })
            .where(and(eq(chessGamesTable.id, gameId), eq(chessGamesTable.status, "active")));

          io?.to(`game:${gameId}`).emit("playerResigned", { resignedUserId: userId, winner });
          logger.info({ gameId, userId, winner }, "Player resigned");

          // Cancel any pending disconnect timers for this game
          const timerKey = `${gameId}:${userId}`;
          if (disconnectTimers.has(timerKey)) {
            clearTimeout(disconnectTimers.get(timerKey)!);
            disconnectTimers.delete(timerKey);
          }
        } catch (err) {
          logger.error({ err }, "Failed to process resign");
        }
      }
    );

    // ── Quit game (immediate forfeit, no confirmation needed) ────
    socket.on(
      "quitGame",
      async ({ gameId, userId }: { gameId: string; userId: string }) => {
        if (!gameId || !userId) return;

        try {
          const [game] = await db
            .select()
            .from(chessGamesTable)
            .where(eq(chessGamesTable.id, gameId));

          if (!game || game.status !== "active") return;

          const isWhite = game.whitePlayerId === userId;
          const isBlack = game.blackPlayerId === userId;
          if (!isWhite && !isBlack) return;

          const winner = isWhite ? "black" : "white";

          await db
            .update(chessGamesTable)
            .set({ status: "completed", winner, updatedAt: new Date() })
            .where(and(eq(chessGamesTable.id, gameId), eq(chessGamesTable.status, "active")));

          io?.to(`game:${gameId}`).emit("playerResigned", { resignedUserId: userId, winner });
          logger.info({ gameId, userId, winner }, "Player quit game");

          const timerKey = `${gameId}:${userId}`;
          if (disconnectTimers.has(timerKey)) {
            clearTimeout(disconnectTimers.get(timerKey)!);
            disconnectTimers.delete(timerKey);
          }
        } catch (err) {
          logger.error({ err }, "Failed to process quit");
        }
      }
    );

    // ── Draw offer / accept / decline ────────────────────────────
    socket.on("offerDraw", ({ gameId, userId }: { gameId: string; userId: string }) => {
      if (!gameId || !userId) return;
      socket.to(`game:${gameId}`).emit("drawOffered", { byUserId: userId });
      logger.info({ gameId, userId }, "Draw offered");
    });

    socket.on("acceptDraw", async ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      try {
        const [game] = await db
          .select()
          .from(chessGamesTable)
          .where(eq(chessGamesTable.id, gameId));

        if (!game || game.status !== "active") return;

        await db
          .update(chessGamesTable)
          .set({ status: "completed", winner: "draw", updatedAt: new Date() })
          .where(and(eq(chessGamesTable.id, gameId), eq(chessGamesTable.status, "active")));

        io?.to(`game:${gameId}`).emit("drawAccepted", {});
        logger.info({ gameId }, "Draw accepted");
      } catch (err) {
        logger.error({ err }, "Failed to process draw acceptance");
      }
    });

    socket.on("declineDraw", ({ gameId }: { gameId: string }) => {
      if (!gameId) return;
      socket.to(`game:${gameId}`).emit("drawDeclined", {});
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on("disconnect", () => {
      // Clean matchmaking
      for (const [userId, sid] of matchmakingQueue.entries()) {
        if (sid === socket.id) {
          matchmakingQueue.delete(userId);
          logger.info({ userId }, "Removed disconnected player from matchmaking queue");
          break;
        }
      }

      // Clean spectators
      for (const [gameId, sockets] of spectatorMap.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          broadcastSpectatorCount(gameId);
          logger.info({ socketId: socket.id, gameId }, "Spectator disconnected");
          if (sockets.size === 0) spectatorMap.delete(gameId);
          break;
        }
      }

      // Handle player disconnection from active game
      const session = playerGameMap.get(socket.id);
      if (session) {
        const { gameId, userId } = session;
        playerGameMap.delete(socket.id);
        gamePlayerSockets.get(gameId)?.delete(userId);

        (async () => {
          try {
            const [game] = await db
              .select()
              .from(chessGamesTable)
              .where(eq(chessGamesTable.id, gameId));

            if (!game || game.status !== "active") return;

            // Race condition guard: player may have already reconnected
            if (gamePlayerSockets.get(gameId)?.has(userId)) return;

            const remainingCount = gamePlayerSockets.get(gameId)?.size ?? 0;
            const timeoutSeconds = DISCONNECT_TIMEOUT_MS / 1000;

            if (remainingCount === 0) {
              // Both players are gone — notify spectators, start timer for this player
              io?.to(`game:${gameId}`).emit("gamePaused", {
                reason: "Both players disconnected",
                disconnectedUserId: userId,
                timeoutSeconds,
              });
            } else {
              // Notify opponent
              io?.to(`game:${gameId}`).emit("opponentDisconnected", {
                disconnectedUserId: userId,
                timeoutSeconds,
              });
            }

            // Start abandonment timer
            const timerKey = `${gameId}:${userId}`;
            const timer = setTimeout(() => {
              disconnectTimers.delete(timerKey);
              endGameByAbandonment(gameId, userId);
            }, DISCONNECT_TIMEOUT_MS);

            disconnectTimers.set(timerKey, timer);
            logger.info({ gameId, userId, timeoutSeconds }, "Abandonment timer started");
          } catch (err) {
            logger.error({ err }, "Failed to handle player disconnect from game");
          }
        })();
      }

      logger.info({ socketId: socket.id }, "Client disconnected");
    });
  });

  return io;
}

export function broadcastGameUpdate(): void {
  if (io) {
    io.emit("gameUpdate", chessEngine.getState());
  }
}

export function broadcastRoomUpdate(gameId: string, state: GameState): void {
  if (io) {
    io.to(`game:${gameId}`).emit("roomUpdate", state);
    io.to(`game:${gameId}`).emit("spectatorCount", { count: getSpectatorCount(gameId) });
  }
}

export function broadcastArduinoStatus(connected: boolean): void {
  if (io) {
    io.emit("arduinoStatus", { connected });
  }
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
