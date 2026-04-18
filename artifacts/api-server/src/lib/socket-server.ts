import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger";
import { chessEngine } from "./chess-engine";
import type { GameState } from "./chess-engine";
import { db, chatMessagesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

let io: SocketIOServer | null = null;

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

    socket.on("disconnect", () => {
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
