import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, chessGamesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { gameRoomManager } from "../lib/game-room-manager";
import { broadcastRoomUpdate, getSocketServer } from "../lib/socket-server";
import { logger } from "../lib/logger";

const router = Router();

router.get("/games", async (_req, res) => {
  try {
    const games = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.status, "waiting"))
      .orderBy(chessGamesTable.createdAt);

    res.json({ games });
  } catch (err) {
    logger.error({ err }, "Failed to list games");
    res.status(500).json({ error: "internal_error", message: "Failed to list games" });
  }
});

router.get("/games/active", async (_req, res) => {
  try {
    const games = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.status, "active"))
      .orderBy(chessGamesTable.updatedAt);

    if (games.length === 0) {
      res.json({ games: [] });
      return;
    }

    const users = await db.select().from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = games.map(g => ({
      ...g,
      whitePlayer: userMap[g.whitePlayerId]
        ? { nickname: userMap[g.whitePlayerId].nickname || userMap[g.whitePlayerId].username, avatarColor: userMap[g.whitePlayerId].avatarColor || "#3b82f6" }
        : { nickname: "Unknown", avatarColor: "#3b82f6" },
      blackPlayer: g.blackPlayerId && userMap[g.blackPlayerId]
        ? { nickname: userMap[g.blackPlayerId].nickname || userMap[g.blackPlayerId].username, avatarColor: userMap[g.blackPlayerId].avatarColor || "#64748b" }
        : { nickname: "Unknown", avatarColor: "#64748b" },
    }));

    res.json({ games: enriched });
  } catch (err) {
    logger.error({ err }, "Failed to list active games");
    res.status(500).json({ error: "internal_error", message: "Failed to list active games" });
  }
});

router.get("/my/games", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const games = await db
      .select()
      .from(chessGamesTable)
      .where(
        and(
          eq(chessGamesTable.status, "completed"),
          or(
            eq(chessGamesTable.whitePlayerId, userId),
            eq(chessGamesTable.blackPlayerId, userId),
          ),
        ),
      )
      .orderBy(chessGamesTable.updatedAt);

    res.json({ games });
  } catch (err) {
    logger.error({ err }, "Failed to list my games");
    res.status(500).json({ error: "internal_error", message: "Failed to list games" });
  }
});

router.post("/games", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const [game] = await db
      .insert(chessGamesTable)
      .values({
        whitePlayerId: userId,
        status: "waiting",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      })
      .returning();

    gameRoomManager.getOrCreate(game.id);
    logger.info({ gameId: game.id, userId }, "Game created");
    res.json(game);
  } catch (err) {
    logger.error({ err }, "Failed to create game");
    res.status(500).json({ error: "internal_error", message: "Failed to create game" });
  }
});

router.get("/games/:id", async (req, res) => {
  const { id } = req.params as { id: string };

  try {
    const [game] = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.id, id));

    if (!game) {
      res.status(404).json({ error: "not_found", message: "Game not found" });
      return;
    }

    const engine = gameRoomManager.getOrCreate(id, game.fen, game.pgn || undefined);
    const gameState = engine.getState();

    res.json({ ...game, ...gameState });
  } catch (err) {
    logger.error({ err }, "Failed to get game");
    res.status(500).json({ error: "internal_error", message: "Failed to get game" });
  }
});

router.post("/games/:id/join", requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };
  const userId = (req as any).userId as string;

  try {
    const [game] = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.id, id));

    if (!game) {
      res.status(404).json({ error: "not_found", message: "Game not found" });
      return;
    }

    if (game.status !== "waiting") {
      res.status(400).json({ error: "game_not_waiting", message: "Game is not waiting for a player" });
      return;
    }

    if (game.whitePlayerId === userId) {
      res.status(400).json({ error: "already_in_game", message: "You are already in this game" });
      return;
    }

    const [updated] = await db
      .update(chessGamesTable)
      .set({ blackPlayerId: userId, status: "active", updatedAt: new Date() })
      .where(and(eq(chessGamesTable.id, id), eq(chessGamesTable.status, "waiting")))
      .returning();

    if (!updated) {
      res.status(400).json({ error: "join_failed", message: "Failed to join game (already started?)" });
      return;
    }

    logger.info({ gameId: id, userId }, "Player joined game");

    const engine = gameRoomManager.getOrCreate(id, updated.fen, updated.pgn || undefined);
    const gameState = engine.getState();
    broadcastRoomUpdate(id, gameState);

    getSocketServer()?.to(`user:${game.whitePlayerId}`).emit("gameAccepted", { gameId: id });
    getSocketServer()?.to(`user:${userId}`).emit("gameStart", { gameId: id });

    res.json({ ...updated, ...gameState });
  } catch (err) {
    logger.error({ err }, "Failed to join game");
    res.status(500).json({ error: "internal_error", message: "Failed to join game" });
  }
});

router.post("/games/:id/move", requireAuth, async (req, res) => {
  const { id } = req.params as { id: string };
  const userId = (req as any).userId as string;
  const { move } = req.body;

  if (!move || typeof move !== "string") {
    res.status(400).json({ error: "validation_error", message: "move is required" });
    return;
  }

  try {
    const [game] = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.id, id));

    if (!game) {
      res.status(404).json({ error: "not_found", message: "Game not found" });
      return;
    }

    if (game.status !== "active") {
      res.status(400).json({ error: "game_not_active", message: "Game is not active" });
      return;
    }

    const isWhite = game.whitePlayerId === userId;
    const isBlack = game.blackPlayerId === userId;

    if (!isWhite && !isBlack) {
      res.status(403).json({ error: "not_a_player", message: "You are not a player in this game" });
      return;
    }

    const engine = gameRoomManager.getOrCreate(id, game.fen, game.pgn || undefined);
    const currentTurn = engine.getState().turn;

    if ((isWhite && currentTurn !== "w") || (isBlack && currentTurn !== "b")) {
      res.status(400).json({ error: "not_your_turn", message: "It is not your turn" });
      return;
    }

    if (engine.getState().isGameOver) {
      res.status(400).json({ error: "game_over", message: "Game is already over" });
      return;
    }

    const result = engine.makeMove(move);

    if (!result.success) {
      res.status(400).json({ error: "invalid_move", message: result.error ?? "Invalid move" });
      return;
    }

    const newState = engine.getState();

    let newStatus = game.status;
    let winner: string | null = game.winner;

    if (newState.isCheckmate) {
      newStatus = "completed";
      winner = currentTurn === "w" ? "white" : "black";
    } else if (newState.isStalemate || newState.isDraw) {
      newStatus = "completed";
      winner = "draw";
    }

    await db
      .update(chessGamesTable)
      .set({
        fen: newState.fen,
        pgn: engine.getPgn(),
        status: newStatus,
        winner,
        updatedAt: new Date(),
      })
      .where(eq(chessGamesTable.id, id));

    broadcastRoomUpdate(id, newState);

    res.json({ success: true, gameState: newState, move: result.move });
  } catch (err) {
    logger.error({ err }, "Failed to make move");
    res.status(500).json({ error: "internal_error", message: "Failed to make move" });
  }
});

router.get("/games/:id/legal-moves", async (req, res) => {
  const { id } = req.params as { id: string };
  const { square } = req.query as { square?: string };

  if (!square) {
    res.status(400).json({ error: "validation_error", message: "square query param required" });
    return;
  }

  try {
    const [game] = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.id, id));

    if (!game) {
      res.status(404).json({ error: "not_found", message: "Game not found" });
      return;
    }

    const engine = gameRoomManager.getOrCreate(id, game.fen, game.pgn || undefined);
    const moves = engine.getLegalMoves(square);
    res.json({ square, moves });
  } catch (err) {
    logger.error({ err }, "Failed to get legal moves");
    res.status(500).json({ error: "internal_error", message: "Failed to get legal moves" });
  }
});

export default router;
