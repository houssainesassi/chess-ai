import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, chatMessagesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

router.get("/games/:id/messages", async (req, res) => {
  const { id } = req.params;

  try {
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.gameId, id))
      .orderBy(asc(chatMessagesTable.createdAt));

    res.json({ messages });
  } catch (err) {
    logger.error({ err }, "Failed to get chat messages");
    res.status(500).json({ error: "internal_error", message: "Failed to get messages" });
  }
});

export default router;
