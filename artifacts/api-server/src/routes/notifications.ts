import { Router } from "express";
import { eq, isNull, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(60);

    const unreadCount = notifications.filter((n) => !n.readAt).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    logger.error({ err }, "Failed to fetch notifications");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch notifications" });
  }
});

router.post("/notifications/read-all", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(eq(notificationsTable.userId, userId));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to mark notifications read");
    res.status(500).json({ error: "internal_error", message: "Failed to mark notifications read" });
  }
});

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const notifId = req.params.id;
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(eq(notificationsTable.id, notifId));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to mark notification read");
    res.status(500).json({ error: "internal_error", message: "Failed to mark notification read" });
  }
});

export default router;
