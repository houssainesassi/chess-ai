import { Router } from "express";
import { eq, or, and, inArray } from "drizzle-orm";
import { db, usersTable, chessGamesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/status/users", requireAuth, async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.username);

    const completedGames = await db
      .select({
        whitePlayerId: chessGamesTable.whitePlayerId,
        blackPlayerId: chessGamesTable.blackPlayerId,
        winner: chessGamesTable.winner,
      })
      .from(chessGamesTable)
      .where(
        and(
          eq(chessGamesTable.status, "completed"),
          or(
            eq(chessGamesTable.winner, "white"),
            eq(chessGamesTable.winner, "black"),
          ),
        ),
      );

    const winCounts: Record<string, number> = {};
    for (const g of completedGames) {
      const winnerId = g.winner === "white" ? g.whitePlayerId : g.blackPlayerId;
      if (winnerId) winCounts[winnerId] = (winCounts[winnerId] ?? 0) + 1;
    }

    const result = users
      .map((u) => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatarColor: u.avatarColor,
        avatarUrl: u.avatarUrl,
        country: u.country,
        isOnline: u.isOnline ?? false,
        lastSeen: u.updatedAt?.toISOString() ?? null,
        rating: u.rating,
        wins: winCounts[u.id] ?? 0,
      }))
      .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0) || a.username.localeCompare(b.username));

    res.json({ users: result });
  } catch (err) {
    logger.error({ err }, "Failed to fetch status users");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch users" });
  }
});

export default router;
