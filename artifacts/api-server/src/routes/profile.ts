import { Router } from "express";
import { eq, ilike } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

function formatProfile(u: typeof usersTable.$inferSelect) {
  return {
    userId: u.id,
    username: u.username,
    fullName: u.fullName ?? null,
    nickname: u.nickname || u.username,
    country: u.country || "Other",
    city: u.city ?? null,
    age: u.age ?? null,
    bio: u.bio ?? null,
    avatarColor: u.avatarColor || "#3b82f6",
    avatarUrl: u.avatarUrl ?? null,
    isOnline: u.isOnline ?? false,
    createdAt: u.createdAt,
  };
}

router.get("/players", requireAuth, async (_req, res) => {
  try {
    const users = await db.select().from(usersTable);
    res.json({ profiles: users.map(formatProfile) });
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
  if (userIds.length === 0) { res.json({ profiles: [] }); return; }

  try {
    const users = await db.select().from(usersTable);
    const matched = users.filter((u) => userIds.includes(u.id));
    res.json({ profiles: matched.map(formatProfile) });
  } catch (err) {
    logger.error({ err }, "Failed to get profiles");
    res.status(500).json({ error: "internal_error", message: "Failed to get profiles" });
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "not_found", message: "User not found" }); return; }
    res.json(formatProfile(user));
  } catch (err) {
    logger.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "internal_error", message: "Failed to get profile" });
  }
});

router.get("/profile/:userId", async (req, res) => {
  const targetId = req.params.userId;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
    if (!user) { res.status(404).json({ error: "not_found", message: "User not found" }); return; }
    res.json(formatProfile(user));
  } catch (err) {
    logger.error({ err }, "Failed to get user profile");
    res.status(500).json({ error: "internal_error", message: "Failed to get profile" });
  }
});

router.post("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { nickname, fullName, country, city, age, bio, avatarUrl, avatarColor } = req.body;

  if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
    res.status(400).json({ error: "validation_error", message: "nickname is required" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({
        nickname: nickname.trim(),
        fullName: fullName?.trim() || null,
        country: (country || "Other").trim(),
        city: city?.trim() || null,
        age: age ? Number(age) : null,
        bio: bio?.trim() || null,
        avatarColor: avatarColor || "#3b82f6",
        avatarUrl: avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json(formatProfile(updated));
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

router.get("/profiles/search", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  if (!q || q.length < 2) { res.json({ profiles: [] }); return; }

  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(ilike(usersTable.nickname, `%${q}%`))
      .limit(10);

    res.json({ profiles: users.filter((u) => u.id !== userId).map(formatProfile) });
  } catch (err) {
    logger.error({ err }, "Failed to search profiles");
    res.status(500).json({ error: "internal_error", message: "Failed to search profiles" });
  }
});

export default router;
