import { Router } from "express";
import { eq, and, or, inArray, ilike } from "drizzle-orm";
import { db, friendRequestsTable, usersTable, chessGamesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSocketServer } from "../lib/socket-server";
import { gameRoomManager } from "../lib/game-room-manager";
import { logger } from "../lib/logger";

const router = Router();

function formatProfile(u: any) {
  return {
    userId: u.id,
    nickname: u.nickname || u.username,
    country: u.country || "Other",
    avatarColor: u.avatarColor || "#3b82f6",
    avatarUrl: u.avatarUrl ?? null,
  };
}

router.get("/friends", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const requests = await db
      .select()
      .from(friendRequestsTable)
      .where(
        or(
          eq(friendRequestsTable.fromUserId, userId),
          eq(friendRequestsTable.toUserId, userId),
        ),
      );

    const pendingIn: typeof requests = [];
    const pendingOut: typeof requests = [];
    const friends: typeof requests = [];

    for (const r of requests) {
      if (r.status === "accepted") friends.push(r);
      else if (r.status === "pending") {
        if (r.toUserId === userId) pendingIn.push(r);
        else pendingOut.push(r);
      }
    }

    const allIds = [
      ...new Set([
        ...friends.map((r) => (r.fromUserId === userId ? r.toUserId : r.fromUserId)),
        ...pendingIn.map((r) => r.fromUserId),
        ...pendingOut.map((r) => r.toUserId),
      ]),
    ];

    const userRows = allIds.length
      ? await db.select().from(usersTable).then((rows) => rows.filter((u) => allIds.includes(u.id)))
      : [];

    const profileMap = Object.fromEntries(userRows.map((u) => [u.id, u]));

    const waitingGame = await db
      .select({ id: chessGamesTable.id })
      .from(chessGamesTable)
      .where(and(eq(chessGamesTable.status, "waiting"), eq(chessGamesTable.whitePlayerId, userId)));

    const openGameId = waitingGame[0]?.id ?? null;

    res.json({
      friends: friends.map((r) => {
        const otherId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
        const u = profileMap[otherId];
        return {
          requestId: r.id,
          userId: otherId,
          profile: u ? formatProfile(u) : null,
          since: r.updatedAt,
        };
      }),
      pendingIn: pendingIn.map((r) => {
        const u = profileMap[r.fromUserId];
        return {
          requestId: r.id,
          userId: r.fromUserId,
          profile: u ? formatProfile(u) : null,
          createdAt: r.createdAt,
        };
      }),
      pendingOut: pendingOut.map((r) => {
        const u = profileMap[r.toUserId];
        return {
          requestId: r.id,
          userId: r.toUserId,
          profile: u ? formatProfile(u) : null,
          createdAt: r.createdAt,
        };
      }),
      openGameId,
    });
  } catch (err) {
    logger.error({ err }, "Failed to list friends");
    res.status(500).json({ error: "internal_error", message: "Failed to list friends" });
  }
});

router.post("/friends/request", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { toUserId } = req.body as { toUserId?: string };

  if (!toUserId || typeof toUserId !== "string") {
    res.status(400).json({ error: "validation_error", message: "toUserId is required" });
    return;
  }
  if (toUserId === userId) {
    res.status(400).json({ error: "validation_error", message: "Cannot friend yourself" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(friendRequestsTable)
      .where(
        or(
          and(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.toUserId, toUserId)),
          and(eq(friendRequestsTable.fromUserId, toUserId), eq(friendRequestsTable.toUserId, userId)),
        ),
      );

    if (existing.length > 0) {
      const e = existing[0];
      if (e.status === "accepted") {
        res.status(400).json({ error: "already_friends", message: "Already friends" });
        return;
      }
      if (e.status === "pending") {
        res.status(400).json({ error: "request_exists", message: "Friend request already pending" });
        return;
      }
      const [updated] = await db
        .update(friendRequestsTable)
        .set({ status: "pending", fromUserId: userId, toUserId, updatedAt: new Date() })
        .where(eq(friendRequestsTable.id, e.id))
        .returning();
      notifyFriendRequest(toUserId, updated);
      res.json(updated);
      return;
    }

    const [created] = await db
      .insert(friendRequestsTable)
      .values({ fromUserId: userId, toUserId })
      .returning();

    notifyFriendRequest(toUserId, created);
    res.json(created);
  } catch (err) {
    logger.error({ err }, "Failed to send friend request");
    res.status(500).json({ error: "internal_error", message: "Failed to send friend request" });
  }
});

router.post("/friends/accept/:requestId", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const requestId = req.params.requestId as string;

  try {
    const [request] = await db
      .select()
      .from(friendRequestsTable)
      .where(eq(friendRequestsTable.id, requestId));

    if (!request || request.toUserId !== userId) {
      res.status(404).json({ error: "not_found", message: "Request not found" });
      return;
    }

    const [updated] = await db
      .update(friendRequestsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendRequestsTable.id, requestId))
      .returning();

    getSocketServer()?.to(`user:${request.fromUserId}`).emit("friendAccepted", {
      requestId,
      byUserId: userId,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to accept friend request");
    res.status(500).json({ error: "internal_error", message: "Failed to accept request" });
  }
});

router.post("/friends/decline/:requestId", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const requestId = req.params.requestId as string;

  try {
    const [request] = await db
      .select()
      .from(friendRequestsTable)
      .where(eq(friendRequestsTable.id, requestId));

    if (!request || request.toUserId !== userId) {
      res.status(404).json({ error: "not_found", message: "Request not found" });
      return;
    }

    await db
      .update(friendRequestsTable)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(friendRequestsTable.id, requestId));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to decline friend request");
    res.status(500).json({ error: "internal_error", message: "Failed to decline request" });
  }
});

router.delete("/friends/:friendUserId", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const friendUserId = req.params.friendUserId as string;

  try {
    await db
      .delete(friendRequestsTable)
      .where(
        or(
          and(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.toUserId, friendUserId)),
          and(eq(friendRequestsTable.fromUserId, friendUserId), eq(friendRequestsTable.toUserId, userId)),
        ),
      );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to remove friend");
    res.status(500).json({ error: "internal_error", message: "Failed to remove friend" });
  }
});

router.post("/friends/invite", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { toUserId } = req.body as { toUserId?: string };

  if (!toUserId) {
    res.status(400).json({ error: "validation_error", message: "toUserId is required" });
    return;
  }

  try {
    const [friendship] = await db
      .select()
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.status, "accepted"),
          or(
            and(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.toUserId, toUserId)),
            and(eq(friendRequestsTable.fromUserId, toUserId), eq(friendRequestsTable.toUserId, userId)),
          ),
        ),
      );

    if (!friendship) {
      res.status(403).json({ error: "not_friends", message: "You are not friends with this player" });
      return;
    }

    const [game] = await db
      .insert(chessGamesTable)
      .values({
        whitePlayerId: userId,
        status: "waiting",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      })
      .returning();

    gameRoomManager.getOrCreate(game.id);

    const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    getSocketServer()?.to(`user:${toUserId}`).emit("gameInvite", {
      gameId: game.id,
      fromUserId: userId,
      fromNickname: fromUser?.nickname || fromUser?.username || "Someone",
      fromAvatarColor: fromUser?.avatarColor || "#3b82f6",
      fromAvatarUrl: fromUser?.avatarUrl ?? null,
      fromCountry: fromUser?.country ?? null,
    });

    res.json({ success: true, gameId: game.id });
  } catch (err) {
    logger.error({ err }, "Failed to send game invite");
    res.status(500).json({ error: "internal_error", message: "Failed to send invite" });
  }
});

router.post("/friends/invite/decline", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { gameId } = req.body as { gameId?: string };

  if (!gameId) {
    res.status(400).json({ error: "validation_error", message: "gameId is required" });
    return;
  }

  try {
    const [game] = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.id, gameId));

    if (!game) {
      res.status(404).json({ error: "not_found", message: "Game not found" });
      return;
    }

    if (game.status !== "waiting") {
      res.status(400).json({ error: "game_not_waiting", message: "Game is no longer waiting" });
      return;
    }

    const [decliner] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    await db.delete(chessGamesTable).where(eq(chessGamesTable.id, gameId));

    getSocketServer()?.to(`user:${game.whitePlayerId}`).emit("gameInviteDeclined", {
      gameId,
      byUserId: userId,
      byNickname: decliner?.nickname || decliner?.username || "Your opponent",
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to decline game invite");
    res.status(500).json({ error: "internal_error", message: "Failed to decline invite" });
  }
});

router.post("/challenge/:toUserId", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const toUserId = req.params.toUserId as string;

  if (!toUserId || toUserId === userId) {
    res.status(400).json({ error: "validation_error", message: "Invalid target user" });
    return;
  }

  try {
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, toUserId));
    if (!targetUser) {
      res.status(404).json({ error: "not_found", message: "Player not found" });
      return;
    }

    const [game] = await db
      .insert(chessGamesTable)
      .values({
        whitePlayerId: userId,
        status: "waiting",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      })
      .returning();

    gameRoomManager.getOrCreate(game.id);

    const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    getSocketServer()?.to(`user:${toUserId}`).emit("gameInvite", {
      gameId: game.id,
      fromUserId: userId,
      fromNickname: fromUser?.nickname || fromUser?.username || "Someone",
      fromAvatarColor: fromUser?.avatarColor || "#3b82f6",
      fromAvatarUrl: fromUser?.avatarUrl ?? null,
      fromCountry: fromUser?.country ?? null,
    });

    res.json({ success: true, gameId: game.id });
  } catch (err) {
    logger.error({ err }, "Failed to send direct challenge");
    res.status(500).json({ error: "internal_error", message: "Failed to send challenge" });
  }
});

router.get("/profiles/search", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const q = (req.query.q as string | undefined)?.trim() ?? "";

  if (!q || q.length < 2) {
    res.json({ profiles: [] });
    return;
  }

  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(ilike(usersTable.nickname, `%${q}%`))
      .limit(10);

    const profiles = users
      .filter((u) => u.id !== userId)
      .map((u) => ({
        userId: u.id,
        nickname: u.nickname || u.username,
        country: u.country || "Other",
        avatarColor: u.avatarColor || "#3b82f6",
        avatarUrl: u.avatarUrl ?? null,
      }));

    res.json({ profiles });
  } catch (err) {
    logger.error({ err }, "Failed to search profiles");
    res.status(500).json({ error: "internal_error", message: "Failed to search profiles" });
  }
});

function notifyFriendRequest(toUserId: string, request: { id: string; fromUserId: string }) {
  getSocketServer()?.to(`user:${toUserId}`).emit("friendRequest", {
    requestId: request.id,
    fromUserId: request.fromUserId,
  });
}

export default router;
