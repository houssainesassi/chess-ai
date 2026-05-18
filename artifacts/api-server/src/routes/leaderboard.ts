import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
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
      ),
      aggregated AS (
        SELECT
          user_id,
          SUM(win)::int  AS wins,
          SUM(loss)::int AS losses,
          SUM(draw)::int AS draws,
          (SUM(win) + SUM(loss) + SUM(draw))::int AS games_played
        FROM player_results
        GROUP BY user_id
      )
      SELECT
        u.id AS user_id,
        u.rating,
        u.games_played AS total_games,
        COALESCE(a.wins, 0)::int AS wins,
        COALESCE(a.losses, 0)::int AS losses,
        COALESCE(a.draws, 0)::int AS draws,
        COALESCE(a.games_played, 0)::int AS games_played,
        u.nickname,
        u.username,
        u.country,
        u.avatar_url,
        u.avatar_color
      FROM users u
      LEFT JOIN aggregated a ON a.user_id = u.id
      WHERE u.rating > 0
      ORDER BY u.rating DESC
      LIMIT 50
    `);

    const allRows = rows.rows as any[];

    let filtered = allRows;

    if (mode === "country" && country) {
      filtered = filtered.filter((r: any) => r.country === country);
    } else if (mode === "friends" && friendIdList.length > 0) {
      filtered = filtered.filter((r: any) => friendIdList.includes(r.user_id));
    }

    const leaderboard = filtered.slice(0, 20).map((r: any) => {
      const wins = Number(r.wins);
      const losses = Number(r.losses);
      const draws = Number(r.draws);
      const gamesPlayed = Number(r.games_played);
      return {
        userId: r.user_id as string,
        nickname: r.nickname || r.username || (r.user_id as string).slice(0, 8) + "…",
        country: r.country ?? null,
        avatarUrl: r.avatar_url ?? null,
        avatarColor: r.avatar_color ?? "#3b82f6",
        rating: Number(r.rating) || 800,
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
