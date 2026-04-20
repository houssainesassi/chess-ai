import { Router } from "express";
import { chessEngine } from "../lib/chess-engine";
import { broadcastGameUpdate } from "../lib/socket-server";
import { analyzePosition } from "../lib/stockfish-service";
import {
  MakeMoveBody,
  GetLegalMovesQueryParams,
} from "@workspace/api-zod";
import { Chess } from "chess.js";

const router = Router();

router.get("/game/state", (req, res) => {
  res.json(chessEngine.getState());
});

router.post("/game/move", (req, res) => {
  const parsed = MakeMoveBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { move } = parsed.data;

  if (chessEngine.getState().isGameOver) {
    res.status(400).json({ error: "game_over", message: "The game is already over. Reset to play again." });
    return;
  }

  const result = chessEngine.makeMove(move);

  if (!result.success) {
    res.status(400).json({ error: "invalid_move", message: result.error ?? "Invalid move" });
    return;
  }

  const gameState = chessEngine.getState();
  broadcastGameUpdate();

  res.json({
    success: true,
    gameState,
    move: result.move,
  });
});

// AI move endpoint — Stockfish picks and plays the best move at given depth
router.post("/game/ai-move", async (req, res) => {
  const state = chessEngine.getState();

  if (state.isGameOver) {
    res.status(400).json({ error: "game_over", message: "Game is already over" });
    return;
  }

  const { depth = 10 } = req.body as { depth?: number };
  const clampedDepth = Math.max(1, Math.min(20, depth));

  try {
    const analysis = await analyzePosition(state.fen, clampedDepth);

    if (!analysis.bestMove) {
      res.status(500).json({ error: "no_move", message: "Engine could not find a move" });
      return;
    }

    const result = chessEngine.makeMove(analysis.bestMove);

    if (!result.success) {
      res.status(400).json({ error: "invalid_move", message: result.error ?? "AI move failed" });
      return;
    }

    const newState = chessEngine.getState();
    broadcastGameUpdate();

    res.json({ success: true, gameState: newState, move: result.move, aiMove: analysis.bestMove });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI move failed";
    req.log.error({ err }, "AI move error");
    res.status(500).json({ error: "ai_error", message });
  }
});

router.post("/game/reset", (_req, res) => {
  chessEngine.reset();
  const gameState = chessEngine.getState();
  broadcastGameUpdate();
  res.json(gameState);
});

router.post("/game/undo", (_req, res) => {
  const result = chessEngine.undoLastMove();
  if (!result.success) {
    res.status(400).json({ error: "no_move", message: result.error ?? "No move to retry" });
    return;
  }
  // Undo AI move too if last move was AI's
  const state = chessEngine.getState();
  broadcastGameUpdate();
  res.json(chessEngine.getState());
});

router.get("/game/legal-moves", (req, res) => {
  const parsed = GetLegalMovesQueryParams.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { square } = parsed.data;
  const moves = chessEngine.getLegalMoves(square);

  res.json({ square, moves });
});

router.get("/game/history", (_req, res) => {
  const state = chessEngine.getState();
  res.json({
    moves: state.moveHistory,
    totalMoves: state.moveHistory.length,
  });
});

export default router;
