import { Router } from "express";
import { eq, or, and } from "drizzle-orm";
import { db, usersTable, chessGamesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

router.get("/leaderboard", async (req, res) => {
  try {
    const { mode, country, friendIds } = req.query as {
      mode?: string;
      country?: string;
      friendIds?: string;
    };

    const friendIdList = friendIds ? friendIds.split(",").filter(Boolean) : [];

    const users = await db.select().from(usersTable);

    const completedGames = await db
      .select({
        whitePlayerId: chessGamesTable.whitePlayerId,
        blackPlayerId: chessGamesTable.blackPlayerId,
        winner: chessGamesTable.winner,
      })
      .from(chessGamesTable)
      .where(eq(chessGamesTable.status, "completed"));

    const stats: Record<string, { wins: number; losses: number; draws: number }> = {};
    for (const g of completedGames) {
      if (!g.blackPlayerId) continue;
      const w = g.whitePlayerId;
      const b = g.blackPlayerId;
      if (!stats[w]) stats[w] = { wins: 0, losses: 0, draws: 0 };
      if (!stats[b]) stats[b] = { wins: 0, losses: 0, draws: 0 };

      if (g.winner === "white") {
        stats[w].wins++;
        stats[b].losses++;
      } else if (g.winner === "black") {
        stats[b].wins++;
        stats[w].losses++;
      } else if (g.winner === "draw") {
        stats[w].draws++;
        stats[b].draws++;
      }
    }

    let filtered = users;

    if (mode === "country" && country) {
      filtered = filtered.filter((u) => u.country === country);
    } else if (mode === "friends" && friendIdList.length > 0) {
      filtered = filtered.filter((u) => friendIdList.includes(u.id));
    }

    const leaderboard = filtered
      .sort((a, b) => (b.rating ?? 800) - (a.rating ?? 800))
      .slice(0, 50)
      .map((u) => {
        const s = stats[u.id] ?? { wins: 0, losses: 0, draws: 0 };
        const gamesPlayed = s.wins + s.losses + s.draws;
        return {
          userId: u.id,
          nickname: u.nickname || u.username,
          country: u.country ?? null,
          avatarUrl: u.avatarUrl ?? null,
          avatarColor: u.avatarColor ?? "#3b82f6",
          rating: u.rating ?? 800,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          gamesPlayed,
          winRate: gamesPlayed > 0 ? Math.round((s.wins / gamesPlayed) * 100) : 0,
        };
      });

    res.json({ leaderboard });
  } catch (err) {
    logger.error({ err }, "Failed to fetch leaderboard");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch leaderboard" });
  }
});

export default router;
