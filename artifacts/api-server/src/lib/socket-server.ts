import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger";
import { chessEngine } from "./chess-engine";
import type { GameState } from "./chess-engine";
import { db, chatMessagesTable, chessGamesTable, usersTable, directMessagesTable } from "@workspace/db";
import { eq, and, lt, isNull } from "drizzle-orm";
import { initNotify, createNotification } from "./notify";
import { gameRoomManager } from "./game-room-manager";
import { applyRatingUpdate } from "./rating";

let io: SocketIOServer | null = null;

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// 2-minute abandonment timeout
const DISCONNECT_TIMEOUT_MS = 2 * 60 * 1000;

// Rating-based matchmaking queue
interface QueueEntry {
  socketId: string;
  rating: number;
  gameMode: "ranked" | "casual";
  joinedAt: number;
}
const matchmakingQueue = new Map<string, QueueEntry>();

function getRatingRange(joinedAt: number): number {
  const secsWaiting = (Date.now() - joinedAt) / 1000;
  const expansions = Math.floor(secsWaiting / 30);
  return Math.min(150 + expansions * 50, 500);
}

async function tryMatchmaking(): Promise<void> {
  if (matchmakingQueue.size < 2) return;
  const entries = [...matchmakingQueue.entries()];

  for (let i = 0; i < entries.length; i++) {
    const [userA, entryA] = entries[i];
    if (!matchmakingQueue.has(userA)) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const [userB, entryB] = entries[j];
      if (!matchmakingQueue.has(userB)) continue;
      if (entryA.gameMode !== entryB.gameMode) continue;

      const rangeA = getRatingRange(entryA.joinedAt);
      const rangeB = getRatingRange(entryB.joinedAt);
      const ratingDiff = Math.abs(entryA.rating - entryB.rating);
      const effectiveRange = Math.max(rangeA, rangeB);

      if (ratingDiff > effectiveRange) continue;

      // Match found
      matchmakingQueue.delete(userA);
      matchmakingQueue.delete(userB);

      try {
        const [whiteId, blackId] =
          Math.random() < 0.5 ? [userA, userB] : [userB, userA];

        const [game] = await db
          .insert(chessGamesTable)
          .values({
            whitePlayerId: whiteId,
            blackPlayerId: blackId,
            status: "active",
            gameMode: entryA.gameMode,
            fen: INITIAL_FEN,
          })
          .returning();

        gameRoomManager.getOrCreate(game.id);
        logger.info({ gameId: game.id, whiteId, blackId, mode: entryA.gameMode }, "Match found");

        const allUsers = await db.select().from(usersTable);
        const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

        const playerA = userMap[userA];
        const playerB = userMap[userB];

        const profileA = {
          nickname: playerA?.nickname || playerA?.username || "Opponent",
          avatarColor: playerA?.avatarColor || "#3b82f6",
          country: playerA?.country || null,
          rating: playerA?.rating ?? 800,
        };
        const profileB = {
          nickname: playerB?.nickname || playerB?.username || "Opponent",
          avatarColor: playerB?.avatarColor || "#3b82f6",
          country: playerB?.country || null,
          rating: playerB?.rating ?? 800,
        };

        io?.to(`user:${userA}`).emit("matchFound", {
          gameId: game.id,
          opponentId: userB,
          opponentNickname: profileB.nickname,
          opponentAvatarColor: profileB.avatarColor,
          opponentCountry: profileB.country,
          opponentRating: profileB.rating,
          myRating: profileA.rating,
          gameMode: entryA.gameMode,
        });

        io?.to(`user:${userB}`).emit("matchFound", {
          gameId: game.id,
          opponentId: userA,
          opponentNickname: profileA.nickname,
          opponentAvatarColor: profileA.avatarColor,
          opponentCountry: profileA.country,
          opponentRating: profileA.rating,
          myRating: profileB.rating,
          gameMode: entryA.gameMode,
        });
      } catch (err) {
        logger.error({ err }, "Failed to create matched game");
        // Re-add to queue so they don't lose their spot entirely
        if (io) {
          io.to(entryA.socketId).emit("matchmakingError", { message: "Failed to create game" });
          io.to(entryB.socketId).emit("matchmakingError", { message: "Failed to create game" });
        }
      }

      return;
    }
  }
}

// Online status tracking: userId -> Set of socketIds (handles multiple tabs)
const userSocketMap = new Map<string, Set<string>>();

async function markUserOnline(userId: string): Promise<void> {
  const now = new Date();
  await db.update(usersTable).set({ isOnline: true, updatedAt: now }).where(eq(usersTable.id, userId)).catch(() => {});
  io?.emit("userStatusChanged", { userId, isOnline: true, lastSeen: now.toISOString() });
}

async function markUserOffline(userId: string): Promise<void> {
  const now = new Date();
  await db.update(usersTable).set({ isOnline: false, updatedAt: now }).where(eq(usersTable.id, userId)).catch(() => {});
  io?.emit("userStatusChanged", { userId, isOnline: false, lastSeen: now.toISOString() });
}

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

    const ratingChanges = await applyRatingUpdate(gameId, winner as "white" | "black" | "draw");
    io?.to(`game:${gameId}`).emit("opponentAbandonedGame", { winner, loserUserId, ratingChanges });
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

  initNotify(io);

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
        (socket as any)._registeredUserId = userId;

        if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
        const wasOnline = userSocketMap.get(userId)!.size > 0;
        userSocketMap.get(userId)!.add(socket.id);

        if (!wasOnline) markUserOnline(userId);

        logger.info({ socketId: socket.id, userId }, "Client registered personal room");
      }
    });

    socket.on("heartbeat", ({ userId }: { userId: string }) => {
      if (!userId) return;
      db.update(usersTable).set({ updatedAt: new Date() }).where(eq(usersTable.id, userId)).catch(() => {});
    });

    // ── Direct Messages ────────────────────────────────────────────
    socket.on("dmSend", async ({ toUserId, message }: { toUserId: string; message: string }) => {
      const fromUserId = (socket as any)._registeredUserId as string;
      if (!fromUserId || !toUserId || !message?.trim()) return;
      try {
        const [saved] = await db
          .insert(directMessagesTable)
          .values({ fromUserId, toUserId, message: message.trim() })
          .returning();
        io?.to(`user:${toUserId}`).emit("dmReceived", {
          id: saved.id,
          fromUserId: saved.fromUserId,
          message: saved.message,
          createdAt: saved.createdAt,
        });
        const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, fromUserId));
        const senderName = sender?.nickname || sender?.username || "Someone";
        await createNotification(toUserId, "direct_message", fromUserId, saved.id, `${senderName}: ${saved.message.slice(0, 80)}`);
      } catch (err) {
        logger.error({ err }, "Failed to relay DM via socket");
      }
    });

    socket.on("dmTyping", ({ toUserId, isTyping }: { toUserId: string; isTyping: boolean }) => {
      const fromUserId = (socket as any)._registeredUserId as string;
      if (!fromUserId || !toUserId) return;
      io?.to(`user:${toUserId}`).emit("dmTyping", { fromUserId, isTyping });
    });

    socket.on("dmSeen", async ({ fromUserId }: { fromUserId: string }) => {
      const toUserId = (socket as any)._registeredUserId as string;
      if (!toUserId || !fromUserId) return;
      try {
        await db
          .update(directMessagesTable)
          .set({ seenAt: new Date() })
          .where(and(
            eq(directMessagesTable.fromUserId, fromUserId),
            eq(directMessagesTable.toUserId, toUserId),
            isNull(directMessagesTable.seenAt),
          ));
        io?.to(`user:${fromUserId}`).emit("dmSeen", { byUserId: toUserId });
      } catch (err) {
        logger.error({ err }, "Failed to mark DM seen via socket");
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
    socket.on("joinMatchmaking", async ({ userId, gameMode }: { userId: string; gameMode?: string }) => {
      if (!userId) return;
      const mode: "ranked" | "casual" = gameMode === "ranked" ? "ranked" : "casual";
      logger.info({ socketId: socket.id, userId, mode }, "Player joining matchmaking queue");

      matchmakingQueue.delete(userId);

      // Look up player's current rating
      let playerRating = 800;
      try {
        const [u] = await db.select({ rating: usersTable.rating }).from(usersTable).where(eq(usersTable.id, userId));
        if (u) playerRating = u.rating;
      } catch (_) {}

      matchmakingQueue.set(userId, { socketId: socket.id, rating: playerRating, gameMode: mode, joinedAt: Date.now() });
      socket.emit("matchmakingQueued", { position: matchmakingQueue.size, rating: playerRating, gameMode: mode });
      logger.info({ userId, queueSize: matchmakingQueue.size, rating: playerRating, mode }, "Player added to queue");

      // Try to match immediately
      await tryMatchmaking();
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

          const ratingChanges = await applyRatingUpdate(gameId, winner as "white" | "black" | "draw");
          io?.to(`game:${gameId}`).emit("playerResigned", { resignedUserId: userId, winner, ratingChanges });
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

          const ratingChanges = await applyRatingUpdate(gameId, winner as "white" | "black" | "draw");
          io?.to(`game:${gameId}`).emit("gameEnd", {
            reason: "quit",
            winner,
            loserUserId: userId,
            ratingChanges,
          });
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

        const ratingChanges = await applyRatingUpdate(gameId, "draw");
        io?.to(`game:${gameId}`).emit("drawAccepted", { ratingChanges });
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
      for (const [userId, entry] of matchmakingQueue.entries()) {
        if (entry.socketId === socket.id) {
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

      // Handle online status
      const registeredUserId = (socket as any)._registeredUserId as string | undefined;
      if (registeredUserId) {
        const sockets = userSocketMap.get(registeredUserId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSocketMap.delete(registeredUserId);
            markUserOffline(registeredUserId);
          }
        }
      }

      logger.info({ socketId: socket.id }, "Client disconnected");
    });
  });

  // Periodic matchmaking: try to pair players every 5 seconds
  setInterval(tryMatchmaking, 5000);

  // Inactivity cleanup: mark stale "online" users as offline every 2 minutes
  setInterval(async () => {
    try {
      const staleThreshold = new Date(Date.now() - 3 * 60 * 1000);
      const stale = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.isOnline, true), lt(usersTable.updatedAt!, staleThreshold)));

      for (const u of stale) {
        if (!userSocketMap.has(u.id)) {
          markUserOffline(u.id);
          logger.info({ userId: u.id }, "Marked stale user as offline");
        }
      }
    } catch (err) {
      logger.error({ err }, "Inactivity cleanup failed");
    }
  }, 2 * 60 * 1000);

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
