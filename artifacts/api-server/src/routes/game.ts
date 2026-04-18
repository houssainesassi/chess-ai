import { Router } from "express";
import { chessEngine } from "../lib/chess-engine";
import { broadcastGameUpdate } from "../lib/socket-server";
import {
  MakeMoveBody,
  GetLegalMovesQueryParams,
} from "@workspace/api-zod";

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
  const gameState = chessEngine.getState();
  broadcastGameUpdate();
  res.json(gameState);
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
