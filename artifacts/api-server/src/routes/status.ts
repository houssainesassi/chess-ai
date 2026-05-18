import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/status/users", requireAuth, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      WITH wins_cte AS (
        SELECT
          CASE
            WHEN winner = 'white' THEN white_player_id
            WHEN winner = 'black' THEN black_player_id
          END AS user_id,
          COUNT(*)::int AS wins
        FROM chess_games
        WHERE status = 'completed'
          AND black_player_id IS NOT NULL
          AND winner IN ('white', 'black')
        GROUP BY user_id
      )
      SELECT
        u.id,
        u.username,
        u.nickname,
        u.avatar_color AS "avatarColor",
        u.avatar_url   AS "avatarUrl",
        u.country,
        u.is_online    AS "isOnline",
        u.updated_at   AS "lastSeen",
        COALESCE(w.wins, 0)::int AS wins
      FROM users u
      LEFT JOIN wins_cte w ON w.user_id = u.id
      ORDER BY u.is_online DESC, u.username ASC
    `);

    res.json({ users: rows.rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch status users");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch users" });
  }
});

export default router;
