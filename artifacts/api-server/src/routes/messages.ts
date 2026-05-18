import { Router } from "express";
import { eq, or, and, asc, desc, isNull } from "drizzle-orm";
import { db, directMessagesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSocketServer } from "../lib/socket-server";
import { createNotification } from "../lib/notify";
import { logger } from "../lib/logger";

const router = Router();

function formatUser(u: any) {
  return {
    userId: u.id,
    username: u.username,
    nickname: u.nickname || u.username,
    avatarColor: u.avatarColor || "#3b82f6",
    avatarUrl: u.avatarUrl ?? null,
    isOnline: u.isOnline ?? false,
  };
}

router.get("/messages", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const all = await db
      .select()
      .from(directMessagesTable)
      .where(
        or(
          eq(directMessagesTable.fromUserId, userId),
          eq(directMessagesTable.toUserId, userId),
        ),
      )
      .orderBy(desc(directMessagesTable.createdAt));

    // Group by partner, get latest message + unread count per partner
    const partnerMap = new Map<string, {
      partnerId: string;
      lastMessage: string;
      lastSenderId: string;
      lastMessageAt: Date;
      unreadCount: number;
      lastSeenAt: Date | null;
    }>();

    for (const msg of all) {
      const partnerId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, {
          partnerId,
          lastMessage: msg.message,
          lastSenderId: msg.fromUserId,
          lastMessageAt: msg.createdAt,
          unreadCount: (msg.toUserId === userId && !msg.seenAt) ? 1 : 0,
          lastSeenAt: msg.seenAt,
        });
      } else {
        const entry = partnerMap.get(partnerId)!;
        if (msg.toUserId === userId && !msg.seenAt) {
          entry.unreadCount++;
        }
      }
    }

    const partnerIds = [...partnerMap.keys()];
    const users = partnerIds.length
      ? await db.select().from(usersTable).then((rows) => rows.filter((u) => partnerIds.includes(u.id)))
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const conversations = [...partnerMap.values()].map((c) => ({
      ...c,
      partner: userMap[c.partnerId] ? formatUser(userMap[c.partnerId]) : null,
    }));

    res.json({ conversations });
  } catch (err) {
    logger.error({ err }, "Failed to fetch conversations");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch conversations" });
  }
});

router.get("/messages/:partnerId", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const partnerId = req.params.partnerId;

  try {
    const messages = await db
      .select()
      .from(directMessagesTable)
      .where(
        or(
          and(eq(directMessagesTable.fromUserId, userId), eq(directMessagesTable.toUserId, partnerId)),
          and(eq(directMessagesTable.fromUserId, partnerId), eq(directMessagesTable.toUserId, userId)),
        ),
      )
      .orderBy(asc(directMessagesTable.createdAt))
      .limit(200);

    const [partnerUser] = await db.select().from(usersTable).where(eq(usersTable.id, partnerId));

    res.json({
      messages,
      partner: partnerUser ? formatUser(partnerUser) : null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch messages");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch messages" });
  }
});

router.post("/messages/:partnerId", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const partnerId = req.params.partnerId;
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "validation_error", message: "message is required" });
    return;
  }

  try {
    const [saved] = await db
      .insert(directMessagesTable)
      .values({ fromUserId: userId, toUserId: partnerId, message: message.trim() })
      .returning();

    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const senderName = sender?.nickname || sender?.username || "Someone";

    getSocketServer()?.to(`user:${partnerId}`).emit("dmReceived", {
      id: saved.id,
      fromUserId: userId,
      message: saved.message,
      createdAt: saved.createdAt,
    });

    await createNotification(
      partnerId,
      "direct_message",
      userId,
      saved.id,
      `${senderName}: ${saved.message.slice(0, 80)}`,
    );

    res.json(saved);
  } catch (err) {
    logger.error({ err }, "Failed to send message");
    res.status(500).json({ error: "internal_error", message: "Failed to send message" });
  }
});

router.post("/messages/:partnerId/seen", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const partnerId = req.params.partnerId;

  try {
    await db
      .update(directMessagesTable)
      .set({ seenAt: new Date() })
      .where(
        and(
          eq(directMessagesTable.fromUserId, partnerId),
          eq(directMessagesTable.toUserId, userId),
          isNull(directMessagesTable.seenAt),
        ),
      );

    getSocketServer()?.to(`user:${partnerId}`).emit("dmSeen", { byUserId: userId });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to mark as seen");
    res.status(500).json({ error: "internal_error", message: "Failed to mark as seen" });
  }
});

export default router;
