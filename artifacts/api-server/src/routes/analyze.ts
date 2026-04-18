import { Router } from "express";
import { Chess } from "chess.js";
import { analyzePosition } from "../lib/stockfish-service";
import { AnalyzePositionBody } from "@workspace/api-zod";

const router = Router();

router.post("/analyze", async (req, res) => {
  const parsed = AnalyzePositionBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { fen, depth = 15, previousFen, lastMove } = parsed.data;

  try {
    const result = await analyzePosition(
      fen,
      depth,
      previousFen ?? undefined,
      lastMove ?? undefined,
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    req.log.error({ err }, "Analysis error");
    res.status(500).json({ error: "analysis_error", message });
  }
});

router.post("/review", async (req, res) => {
  const { moves } = req.body as { moves?: string[] };

  if (!Array.isArray(moves) || moves.length === 0) {
    res.status(400).json({ error: "validation_error", message: "moves array is required" });
    return;
  }

  try {
    const chess = new Chess();
    const positions: string[] = [chess.fen()];

    for (const san of moves) {
      try {
        chess.move(san);
        positions.push(chess.fen());
      } catch {
        break;
      }
    }

    const reviews: any[] = [];

    for (let i = 1; i < positions.length; i++) {
      const previousFen = positions[i - 1];
      const currentFen = positions[i];

      const prevChess = new Chess(previousFen);
      const verbose = prevChess.history({ verbose: true });
      const lastMoveVerbose = new Chess(previousFen);
      lastMoveVerbose.move(moves[i - 1]);
      const historyAfter = lastMoveVerbose.history({ verbose: true });
      const lastMoveObj = historyAfter[historyAfter.length - 1];
      const uci = lastMoveObj
        ? `${lastMoveObj.from}${lastMoveObj.to}${lastMoveObj.promotion ?? ""}`
        : "";

      const result = await analyzePosition(currentFen, 12, previousFen, uci);

      reviews.push({
        moveIndex: i - 1,
        san: moves[i - 1],
        fen: currentFen,
        moveQuality: result.moveQuality,
        reviewTitle: result.reviewTitle,
        reviewCommentary: result.reviewCommentary,
        bestMoveSan: result.bestMoveBeforeSan,
        evaluation: result.evaluation,
        evaluationScore: result.evaluationScore,
        topMoves: result.topMoves,
        isMate: result.isMate,
        mateIn: result.mateIn,
      });
    }

    res.json({ reviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed";
    req.log.error({ err }, "Review error");
    res.status(500).json({ error: "review_error", message });
  }
});

export default router;
