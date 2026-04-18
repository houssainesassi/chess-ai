import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/leaderboard", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      WITH player_results AS (
        SELECT white_player_id AS user_id,
          CASE WHEN winner = 'white' THEN 1 ELSE 0 END AS win,
          CASE WHEN winner = 'black' THEN 1 ELSE 0 END AS loss,
          CASE WHEN winner = 'draw'  THEN 1 ELSE 0 END AS draw
        FROM chess_games
        WHERE status = 'completed' AND black_player_id IS NOT NULL
        UNION ALL
        SELECT black_player_id AS user_id,
          CASE WHEN winner = 'black' THEN 1 ELSE 0 END AS win,
          CASE WHEN winner = 'white' THEN 1 ELSE 0 END AS loss,
          CASE WHEN winner = 'draw'  THEN 1 ELSE 0 END AS draw
        FROM chess_games
        WHERE status = 'completed' AND black_player_id IS NOT NULL
      )
      SELECT
        user_id,
        SUM(win)::int  AS wins,
        SUM(loss)::int AS losses,
        SUM(draw)::int AS draws,
        (SUM(win) + SUM(loss) + SUM(draw))::int AS games_played
      FROM player_results
      GROUP BY user_id
      ORDER BY wins DESC, losses ASC
      LIMIT 20
    `);

    if (rows.rows.length === 0) {
      res.json({ leaderboard: [] });
      return;
    }

    const userIds = rows.rows.map((r: any) => r.user_id as string);
    const profiles = await db
      .select()
      .from(userProfilesTable)
      .where(inArray(userProfilesTable.userId, userIds));

    const profileMap = Object.fromEntries(profiles.map((p) => [p.userId, p]));

    const leaderboard = rows.rows.map((r: any) => {
      const profile = profileMap[r.user_id];
      const wins = Number(r.wins);
      const losses = Number(r.losses);
      const draws = Number(r.draws);
      const gamesPlayed = Number(r.games_played);
      return {
        userId: r.user_id as string,
        nickname: profile?.nickname ?? r.user_id.slice(0, 8) + "…",
        country: profile?.country ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        avatarColor: profile?.avatarColor ?? "#555",
        wins,
        losses,
        draws,
        gamesPlayed,
        winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
      };
    });

    res.json({ leaderboard });
  } catch (err) {
    logger.error({ err }, "Failed to fetch leaderboard");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch leaderboard" });
  }
});

export default router;
