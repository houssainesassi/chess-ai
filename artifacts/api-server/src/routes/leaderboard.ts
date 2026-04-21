import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
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
    const allUsers = await db.select().from(usersTable);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

    const leaderboard = rows.rows.map((r: any) => {
      const user = userMap[r.user_id];
      const wins = Number(r.wins);
      const losses = Number(r.losses);
      const draws = Number(r.draws);
      const gamesPlayed = Number(r.games_played);
      return {
        userId: r.user_id as string,
        nickname: user?.nickname || user?.username || r.user_id.slice(0, 8) + "…",
        country: user?.country ?? null,
        avatarUrl: user?.avatarUrl ?? null,
        avatarColor: user?.avatarColor ?? "#3b82f6",
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
