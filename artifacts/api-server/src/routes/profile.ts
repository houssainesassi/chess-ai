import { Router } from "express";
import { eq, inArray, ilike } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const profileSelect = {
  userId: usersTable.id,
  nickname: usersTable.nickname,
  country: usersTable.country,
  avatarColor: usersTable.avatarColor,
  avatarUrl: usersTable.avatarUrl,
  username: usersTable.username,
};

router.get("/players", requireAuth, async (req, res) => {
  try {
    const users = await db.select(profileSelect).from(usersTable);
    const profiles = users.map((u) => ({
      userId: u.userId,
      nickname: u.nickname || u.username,
      country: u.country || "Other",
      avatarColor: u.avatarColor || "#3b82f6",
      avatarUrl: u.avatarUrl ?? null,
    }));
    res.json({ profiles });
  } catch (err) {
    logger.error({ err }, "Failed to list players");
    res.status(500).json({ error: "internal_error", message: "Failed to list players" });
  }
});

router.get("/profiles", async (req, res) => {
  const raw = req.query["userIds"];
  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "validation_error", message: "userIds query param required" });
    return;
  }
  const userIds = raw.split(",").map((id) => id.trim()).filter(Boolean);
  if (userIds.length === 0) {
    res.json({ profiles: [] });
    return;
  }
  try {
    const users = await db.select(profileSelect).from(usersTable);
    const matched = users.filter((u) => userIds.includes(u.userId));
    const profiles = matched.map((u) => ({
      userId: u.userId,
      nickname: u.nickname || u.username,
      country: u.country || "Other",
      avatarColor: u.avatarColor || "#3b82f6",
      avatarUrl: u.avatarUrl ?? null,
    }));
    res.json({ profiles });
  } catch (err) {
    logger.error({ err }, "Failed to get profiles");
    res.status(500).json({ error: "internal_error", message: "Failed to get profiles" });
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const [user] = await db.select(profileSelect).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    res.json({
      userId: user.userId,
      nickname: user.nickname || user.username,
      country: user.country || "Other",
      avatarColor: user.avatarColor || "#3b82f6",
      avatarUrl: user.avatarUrl ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "internal_error", message: "Failed to get profile" });
  }
});

router.post("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { nickname, country, avatarUrl, avatarColor } = req.body;

  if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
    res.status(400).json({ error: "validation_error", message: "nickname is required" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({
        nickname: nickname.trim(),
        country: (country || "Other").trim(),
        avatarColor: avatarColor || "#3b82f6",
        avatarUrl: avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({
      userId: updated.id,
      nickname: updated.nickname || updated.username,
      country: updated.country || "Other",
      avatarColor: updated.avatarColor || "#3b82f6",
      avatarUrl: updated.avatarUrl ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to save profile");
    res.status(500).json({ error: "internal_error", message: "Failed to save profile" });
  }
});

router.delete("/account", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    logger.info({ userId }, "Account deleted");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "internal_error", message: "Failed to delete account" });
  }
});

export default router;
