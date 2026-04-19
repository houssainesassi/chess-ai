import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, userProfilesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/players", requireAuth, async (req, res) => {
  try {
    const profiles = await db.select().from(userProfilesTable);
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
    const profiles = await db
      .select()
      .from(userProfilesTable)
      .where(inArray(userProfilesTable.userId, userIds));
    res.json({ profiles });
  } catch (err) {
    logger.error({ err }, "Failed to get profiles");
    res.status(500).json({ error: "internal_error", message: "Failed to get profiles" });
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    if (!profile) {
      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }

    res.json(profile);
  } catch (err) {
    logger.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "internal_error", message: "Failed to get profile" });
  }
});

router.post("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const userEmail = (req as any).userEmail as string | undefined;
  const { nickname, country, avatarUrl, avatarColor } = req.body;

  if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
    res.status(400).json({ error: "validation_error", message: "nickname is required" });
    return;
  }
  if (!country || typeof country !== "string" || country.trim().length === 0) {
    res.status(400).json({ error: "validation_error", message: "country is required" });
    return;
  }
  if (!avatarColor || typeof avatarColor !== "string") {
    res.status(400).json({ error: "validation_error", message: "avatarColor is required" });
    return;
  }

  try {
    const [profile] = await db
      .insert(userProfilesTable)
      .values({
        userId,
        nickname: nickname.trim(),
        country: country.trim(),
        avatarUrl: avatarUrl ?? null,
        avatarColor,
        email: userEmail ?? null,
      })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: {
          nickname: nickname.trim(),
          country: country.trim(),
          avatarUrl: avatarUrl ?? null,
          avatarColor,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(profile);
  } catch (err) {
    logger.error({ err }, "Failed to save profile");
    res.status(500).json({ error: "internal_error", message: "Failed to save profile" });
  }
});

router.delete("/account", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    await db.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    logger.info({ userId }, "Account deleted");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "internal_error", message: "Failed to delete account" });
  }
});

export default router;
