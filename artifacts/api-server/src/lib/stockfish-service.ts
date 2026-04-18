import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { createInterface } from "readline";
import path from "path";
import { createRequire } from "module";
import { Chess } from "chess.js";
import { logger } from "./logger";

export interface TopMove {
  move: string;
  evaluation: string;
  san: string;
}

export type MoveQuality = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface AnalysisResult {
  bestMove: string;
  bestMoveSan: string;
  evaluation: string;
  evaluationScore: number;
  depth: number;
  topMoves: TopMove[];
  moveQuality?: MoveQuality;
  suggestion?: string;
  playedMove?: string;
  playedMoveSan?: string;
  bestMoveBefore?: string;
  bestMoveBeforeSan?: string;
  centipawnLoss?: number;
  reviewTitle?: string;
  reviewCommentary?: string;
  isMate: boolean;
  mateIn?: number;
}

interface UciInfo {
  depth?: number;
  score?: { cp?: number; mate?: number };
  pv?: string[];
  multipv?: number;
}

interface EngineResult {
  depth: number;
  score: number;
  isMate: boolean;
  mateIn?: number;
  pv: string[];
  bestMove: string;
}

let proc: ChildProcessWithoutNullStreams | null = null;
let engineReady = false;
let engineInitializing = false;
const pendingQueue: Array<() => void> = [];
const lineHandlers: Array<(line: string) => void> = [];

let engineLock: Promise<void> = Promise.resolve();

function withEngineLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = engineLock.then(fn);
  engineLock = next.then(() => {}, () => {});
  return next;
}

function getEnginePath(): string {
  try {
    const req = createRequire(import.meta.url);
    const stockfishPkg = req.resolve("stockfish/package.json");
    const stockfishDir = path.dirname(stockfishPkg);
    return path.join(stockfishDir, "bin", "stockfish-18-lite-single.js");
  } catch {
    return path.join(process.cwd(), "node_modules", "stockfish", "bin", "stockfish-18-lite-single.js");
  }
}

function sendCommand(cmd: string) {
  if (proc && proc.stdin.writable) {
    proc.stdin.write(cmd + "\n");
  }
}

async function initEngine(): Promise<boolean> {
  if (engineReady) return true;
  if (engineInitializing) {
    return new Promise((resolve) => {
      pendingQueue.push(() => resolve(engineReady));
    });
  }

  engineInitializing = true;

  try {
    const enginePath = getEnginePath();
    proc = spawn(process.execPath, [enginePath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stderr.on("data", () => {});

    const rl = createInterface({ input: proc.stdout });
    rl.on("line", (line: string) => {
      for (const handler of lineHandlers) {
        handler(line);
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Engine init timeout")), 15000);

      const handler = (line: string) => {
        if (line.includes("uciok")) {
          sendCommand("isready");
        } else if (line.includes("readyok")) {
          clearTimeout(timeout);
          const idx = lineHandlers.indexOf(handler);
          if (idx !== -1) lineHandlers.splice(idx, 1);
          engineReady = true;
          pendingQueue.forEach((cb) => cb());
          pendingQueue.length = 0;
          resolve();
        }
      };

      lineHandlers.push(handler);
      sendCommand("uci");
    });

    sendCommand("setoption name MultiPV value 3");
    sendCommand("setoption name Threads value 1");
    logger.info("Stockfish engine initialized");
    return true;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, "Failed to initialize Stockfish");
    engineInitializing = false;
    proc = null;
    return false;
  }
}

function parseInfo(line: string): UciInfo {
  const info: UciInfo = {};

  const depthMatch = line.match(/\bdepth (\d+)/);
  if (depthMatch) info.depth = parseInt(depthMatch[1]);

  const multipvMatch = line.match(/\bmultipv (\d+)/);
  if (multipvMatch) info.multipv = parseInt(multipvMatch[1]);

  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  if (cpMatch) {
    info.score = { cp: parseInt(cpMatch[1]) };
  } else if (mateMatch) {
    info.score = { mate: parseInt(mateMatch[1]) };
  }

  const pvMatch = line.match(/\bpv (.+)/);
  if (pvMatch) {
    info.pv = pvMatch[1].trim().split(/\s+/);
  }

  return info;
}

async function runAnalysis(fen: string, depth: number): Promise<Map<number, EngineResult>> {
  const results = new Map<number, EngineResult>();

  return new Promise((resolve) => {
    const handler = (line: string) => {
      if (line.startsWith("info") && line.includes("score") && line.includes("pv")) {
        const info = parseInfo(line);
        if (info.depth && info.score && info.pv && info.pv.length > 0) {
          const mpv = info.multipv ?? 1;
          const score = info.score.cp ?? (info.score.mate ? info.score.mate * 100000 : 0);
          results.set(mpv, {
            depth: info.depth,
            score,
            isMate: !!info.score.mate,
            mateIn: info.score.mate,
            pv: info.pv,
            bestMove: info.pv[0],
          });
        }
      } else if (line.startsWith("bestmove")) {
        clearTimeout(timeout);
        const idx = lineHandlers.indexOf(handler);
        if (idx !== -1) lineHandlers.splice(idx, 1);
        resolve(results);
      }
    };

    const timeout = setTimeout(() => {
      const idx = lineHandlers.indexOf(handler);
      if (idx !== -1) lineHandlers.splice(idx, 1);
      resolve(results);
    }, 8000);

    lineHandlers.push(handler);
    sendCommand(`position fen ${fen}`);
    sendCommand(`go depth ${Math.min(depth, 18)}`);
  });
}

function cpToEvalLabel(cp: number, turn: "w" | "b"): string {
  const normalized = turn === "w" ? cp : -cp;
  if (Math.abs(normalized) >= 100000) {
    return normalized > 0 ? "M" : "-M";
  }
  const pawns = normalized / 100;
  const sign = pawns >= 0 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

function classifyMoveQuality(cpAfterPlayed: number, cpAfterBestMove: number, turn: "w" | "b"): MoveQuality {
  const perspective = turn === "w" ? 1 : -1;
  const played = cpAfterPlayed * perspective;
  const best = cpAfterBestMove * perspective;
  const loss = best - played;

  if (loss <= 10) return "best";
  if (loss <= 25) return "excellent";
  if (loss <= 50) return "good";
  if (loss <= 100) return "inaccuracy";
  if (loss <= 200) return "mistake";
  return "blunder";
}

function toWhiteCentipawns(result: EngineResult, turn: "w" | "b"): number {
  return turn === "w" ? result.score : -result.score;
}

function uciToSan(chess: Chess, uci: string): string {
  try {
    const from = uci.slice(0, 2) as any;
    const to = uci.slice(2, 4) as any;
    const promotion = uci.length === 5 ? uci[4] : undefined;
    const tempChess = new Chess(chess.fen());
    const move = tempChess.move({ from, to, promotion });
    return move?.san ?? uci;
  } catch {
    return uci;
  }
}

function generateSuggestion(result: EngineResult, turn: "w" | "b"): string {
  const score = turn === "w" ? result.score : -result.score;
  if (result.isMate && result.mateIn) {
    const side = result.mateIn > 0 ? "White" : "Black";
    return `${side} has mate in ${Math.abs(result.mateIn)}.`;
  }
  if (score > 200) return "White is winning decisively.";
  if (score > 75) return "White has a clear advantage.";
  if (score > 25) return "White has a slight edge.";
  if (score < -200) return "Black is winning decisively.";
  if (score < -75) return "Black has a clear advantage.";
  if (score < -25) return "Black has a slight edge.";
  return "The position is roughly equal.";
}

function generateReviewCommentary(args: {
  quality: MoveQuality;
  playedSan: string;
  bestSan?: string;
  centipawnLoss?: number;
  isCheck?: boolean;
  captured?: boolean;
}): { title: string; commentary: string } {
  const label = {
    best: "the best move",
    excellent: "an excellent move",
    good: "a good move",
    inaccuracy: "an inaccuracy",
    mistake: "a mistake",
    blunder: "a blunder",
  }[args.quality];

  const title = `${args.playedSan} is ${label}`;
  const lossText = args.centipawnLoss !== undefined && args.centipawnLoss > 20
    ? ` The engine sees about ${(args.centipawnLoss / 100).toFixed(1)} pawns of value lost.`
    : "";
  const bestText = args.bestSan && args.bestSan !== args.playedSan
    ? ` ${args.bestSan} was the stronger continuation.`
    : "";

  if (args.quality === "best") {
    return {
      title,
      commentary: args.isCheck
        ? "Great choice. You found the forcing move and kept the pressure on the king."
        : "Exactly right. This keeps your advantage and follows the engine's top line.",
    };
  }

  if (args.quality === "excellent") {
    return {
      title,
      commentary: `Very strong move. It is almost as good as the engine's first choice.${bestText}`,
    };
  }

  if (args.quality === "good") {
    return {
      title,
      commentary: `A solid practical move. There was a slightly cleaner way to play.${bestText}`,
    };
  }

  if (args.quality === "inaccuracy") {
    return {
      title,
      commentary: `You moved a little too quickly and let the opponent improve their position.${bestText}${lossText}`,
    };
  }

  if (args.quality === "mistake") {
    return {
      title,
      commentary: `This gives away a clear part of your advantage. Look for forcing moves, captures, and threats first.${bestText}${lossText}`,
    };
  }

  return {
    title,
    commentary: args.captured
      ? `That capture does not work tactically. Your opponent can answer and win material or the attack.${bestText}${lossText}`
      : `This move changes the game. It leaves an important tactic, piece, or square unprotected.${bestText}${lossText}`,
  };
}

const analysisCache = new Map<string, AnalysisResult & { cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function analyzePosition(
  fen: string,
  depth = 15,
  previousFen?: string | null,
  lastMove?: string | null
): Promise<AnalysisResult> {
  const cacheKey = `${fen}|${depth}|${previousFen ?? ""}|${lastMove ?? ""}`;
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    const { cachedAt: _c, ...rest } = cached;
    return rest;
  }

  const ok = await initEngine();
  if (!ok) throw new Error("Stockfish engine could not be initialized");

  return withEngineLock(async () => {
    const rechecked = analysisCache.get(cacheKey);
    if (rechecked && Date.now() - rechecked.cachedAt < CACHE_TTL_MS) {
      const { cachedAt: _c2, ...rest2 } = rechecked;
      return rest2;
    }

    const chess = new Chess(fen);
    const turn = chess.turn() as "w" | "b";

    const allResults = await runAnalysis(fen, depth);
    const primary = allResults.get(1);
    if (!primary || !primary.bestMove) throw new Error("No analysis result from engine");

    const evalNumeric = turn === "w" ? primary.score : -primary.score;
    const evalLabel = cpToEvalLabel(primary.score, turn);
    const bestMoveSan = uciToSan(chess, primary.bestMove);

    const topMoves: TopMove[] = [];
    for (let i = 1; i <= 3; i++) {
      const r = allResults.get(i);
      if (!r) break;
      topMoves.push({
        move: r.bestMove,
        evaluation: cpToEvalLabel(r.score, turn),
        san: uciToSan(chess, r.bestMove),
      });
    }

    let moveQuality: MoveQuality | undefined;
    let playedMove: string | undefined;
    let playedMoveSan: string | undefined;
    let bestMoveBefore: string | undefined;
    let bestMoveBeforeSan: string | undefined;
    let centipawnLoss: number | undefined;
    let reviewTitle: string | undefined;
    let reviewCommentary: string | undefined;

    if (previousFen && lastMove) {
      try {
        const prevChess = new Chess(previousFen);
        const prevTurn = prevChess.turn() as "w" | "b";

        const prevResults = await runAnalysis(previousFen, Math.min(depth, 14));
        const prevBest = prevResults.get(1);

        if (prevBest) {
          playedMove = lastMove;
          playedMoveSan = uciToSan(prevChess, lastMove);
          bestMoveBefore = prevBest.bestMove;
          bestMoveBeforeSan = uciToSan(prevChess, prevBest.bestMove);

          const tempChess = new Chess(previousFen);
          tempChess.move({
            from: prevBest.bestMove.slice(0, 2) as any,
            to: prevBest.bestMove.slice(2, 4) as any,
            promotion: prevBest.bestMove.length === 5 ? prevBest.bestMove[4] : undefined,
          });
          const bestAfterBest = await runAnalysis(tempChess.fen(), Math.min(depth, 12));
          const bestAfterBestPrimary = bestAfterBest.get(1);

          if (bestAfterBestPrimary) {
            const playedWhiteCp = toWhiteCentipawns(primary, turn);
            const bestWhiteCp = toWhiteCentipawns(bestAfterBestPrimary, tempChess.turn() as "w" | "b");
            centipawnLoss = Math.max(
              0,
              Math.round(prevTurn === "w" ? bestWhiteCp - playedWhiteCp : playedWhiteCp - bestWhiteCp),
            );
            moveQuality = classifyMoveQuality(playedWhiteCp, bestWhiteCp, prevTurn);

            const playedOnPrev = new Chess(previousFen);
            const playedVerbose = playedOnPrev.move({
              from: lastMove.slice(0, 2) as any,
              to: lastMove.slice(2, 4) as any,
              promotion: lastMove.length === 5 ? lastMove[4] : undefined,
            });
            const review = generateReviewCommentary({
              quality: moveQuality,
              playedSan: playedMoveSan,
              bestSan: bestMoveBeforeSan,
              centipawnLoss,
              isCheck: playedOnPrev.inCheck(),
              captured: !!playedVerbose?.captured,
            });
            reviewTitle = review.title;
            reviewCommentary = review.commentary;
          }
        }
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : err }, "Move quality evaluation failed");
      }
    }

    const result: AnalysisResult = {
      bestMove: primary.bestMove,
      bestMoveSan,
      evaluation: evalLabel,
      evaluationScore: evalNumeric,
      depth: primary.depth,
      topMoves,
      moveQuality,
      suggestion: generateSuggestion(primary, turn),
      playedMove,
      playedMoveSan,
      bestMoveBefore,
      bestMoveBeforeSan,
      centipawnLoss,
      reviewTitle,
      reviewCommentary,
      isMate: primary.isMate,
      mateIn: primary.mateIn,
    };

    analysisCache.set(cacheKey, { ...result, cachedAt: Date.now() });
    return result;
  });
}
