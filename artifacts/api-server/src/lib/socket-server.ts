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

// Matchmaking queue: userId -> socketId
const matchmakingQueue = new Map<string, string>();

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

    socket.on("joinGame", ({ gameId }: { gameId: string }) => {
      socket.join(`game:${gameId}`);
      logger.info({ socketId: socket.id, gameId }, "Client joined game room");
    });

    socket.on("leaveGame", ({ gameId }: { gameId: string }) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on("registerUser", ({ userId }: { userId: string }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        logger.info({ socketId: socket.id, userId }, "Client registered personal room");
      }
    });

    // ── Matchmaking ──────────────────────────────────────────────────
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

          // Fetch both players' profiles
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

          // Tell waiting player: opponent is the new player
          io?.to(`user:${opponentId}`).emit("matchFound", {
            gameId: game.id,
            opponentId: userId,
            opponentNickname: newPlayerProfile.nickname,
            opponentAvatarColor: newPlayerProfile.avatarColor,
            opponentCountry: newPlayerProfile.country,
          });

          // Tell new player: opponent is the waiting player
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

    // ── Chat ─────────────────────────────────────────────────────────
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

    // ── Resign ───────────────────────────────────────────────────────
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
        } catch (err) {
          logger.error({ err }, "Failed to process resign");
        }
      }
    );

    // ── Draw offer / accept / decline ────────────────────────────────
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

    // ── Disconnect ───────────────────────────────────────────────────
    socket.on("disconnect", () => {
      for (const [userId, sid] of matchmakingQueue.entries()) {
        if (sid === socket.id) {
          matchmakingQueue.delete(userId);
          logger.info({ userId }, "Removed disconnected player from matchmaking queue");
          break;
        }
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
