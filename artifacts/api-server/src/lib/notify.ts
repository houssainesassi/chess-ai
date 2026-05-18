import type { Server as SocketIOServer } from "socket.io";
import { db, notificationsTable } from "@workspace/db";
import { logger } from "./logger";

let _io: SocketIOServer | null = null;

export function initNotify(io: SocketIOServer): void {
  _io = io;
}

export async function createNotification(
  userId: string,
  type: string,
  fromUserId: string | null,
  refId: string | null,
  message: string,
): Promise<void> {
  try {
    const [notif] = await db
      .insert(notificationsTable)
      .values({ userId, type, fromUserId, refId, message })
      .returning();

    _io?.to(`user:${userId}`).emit("newNotification", {
      id: notif.id,
      type: notif.type,
      fromUserId: notif.fromUserId,
      message: notif.message,
      createdAt: notif.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
  }
}
