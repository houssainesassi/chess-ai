import { useEffect, useCallback, useRef } from "react";
import { useGetGameState, useResetGame, getGetGameStateQueryKey } from "@workspace/api-client-react";
import type { AnalysisResult, GameState } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, RotateCcw, Cpu, Settings, Star, Undo2, ArrowRight, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { EvalBar } from "./EvalBar";
import { MoveQualityBadge } from "./MoveQualityBadge";

const PIECES: Record<string, string> = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
};

const REVIEW_CONFIG = {
  best: { label: "Best", badge: "bg-emerald-500 text-white", icon: CheckCircle2 },
  excellent: { label: "Excellent", badge: "bg-green-500 text-white", icon: Star },
  good: { label: "Good", badge: "bg-blue-500 text-white", icon: CheckCircle2 },
  inaccuracy: { label: "Inaccuracy", badge: "bg-yellow-400 text-zinc-950", icon: HelpCircle },
  mistake: { label: "Mistake", badge: "bg-orange-500 text-white", icon: AlertTriangle },
  blunder: { label: "Blunder", badge: "bg-red-500 text-white", icon: AlertTriangle },
} as const;

interface SidebarProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  showBestMove: boolean;
  onToggleBestMove: () => void;
  gameState?: GameState;
  hideReset?: boolean;
  hideRetry?: boolean;
  hideGameReview?: boolean;
  voiceEnabled?: boolean;
  gameOverAction?: React.ReactNode;
}

export function Sidebar({
  analysis,
  isAnalyzing,
  showBestMove,
  onToggleBestMove,
  gameState: externalGameState,
  hideReset = false,
  hideRetry = false,
  hideGameReview = false,
  voiceEnabled = false,
  gameOverAction,
}: SidebarProps) {
  const [, navigate] = useLocation();
  const { data: localGameState } = useGetGameState({ query: { queryKey: getGetGameStateQueryKey(), enabled: !externalGameState } });
  const queryClient = useQueryClient();
  const resetGame = useResetGame();
  const lastSpokenRef = useRef<string | null>(null);

  const gameState = externalGameState ?? localGameState;

  const speak = useCallback((text: string) => {
    if (!voiceEnabled) return;
    if (!window.speechSynthesis) return;
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  }, [voiceEnabled]);

  useEffect(() => {
    if (!analysis) return;
    const commentary = analysis.reviewCommentary ?? analysis.suggestion;
    if (commentary) {
      speak(commentary);
    }
  }, [analysis, speak]);

  if (!gameState || !gameState.moveHistory) return null;

  const movePairs = [];
  for (let i = 0; i < gameState.moveHistory.length; i += 2) {
    movePairs.push({
      number: gameState.moveHistory[i].moveNumber,
      white: gameState.moveHistory[i],
      black: gameState.moveHistory[i + 1],
    });
  }

  const reviewQuality = analysis?.moveQuality ?? null;
  const reviewConfig = reviewQuality ? REVIEW_CONFIG[reviewQuality] : null;
  const ReviewIcon = reviewConfig?.icon ?? Cpu;
  const reviewTitle = analysis?.reviewTitle ?? (analysis?.playedMoveSan && reviewConfig ? `${analysis.playedMoveSan} is ${reviewConfig.label.toLowerCase()}` : null);
  const reviewCommentary = analysis?.reviewCommentary ?? analysis?.suggestion;

  const handleRetry = async () => {
    const response = await fetch("/api/game/undo", { method: "POST" });
    if (response.ok) {
      queryClient.invalidateQueries({ queryKey: getGetGameStateQueryKey() });
    }
  };

  const getAdvantageInfo = () => {
    if (!analysis) return null;
    if (analysis.isMate) {
      const side = analysis.mateIn && analysis.mateIn > 0 ? "White" : "Black";
      return { label: `${side} wins`, score: analysis.evaluation };
    }
    const score = analysis.evaluationScore;
    if (score > 0.3) return { label: "White is better", score: analysis.evaluation };
    if (score < -0.3) return { label: "Black is better", score: analysis.evaluation };
    return { label: "Equal position", score: analysis.evaluation };
  };

  getAdvantageInfo();

  return (
    <div className="w-full md:w-80 flex flex-col bg-card border-l border-border rounded-xl md:rounded-none overflow-hidden shadow-xl">

      {/* Header */}
      <div className="p-4 border-b border-border bg-black/20 flex justify-between items-center shrink-0">
        <h2 className="text-xl font-bold font-serif italic tracking-wide">Smart Board</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${gameState.arduinoConnected ? "bg-green-500" : "bg-red-500"}`} />
          {gameState.arduinoConnected ? "Arduino" : "No Arduino"}
        </div>
      </div>

      {/* Eval Bar + Game Status */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex gap-3 items-start">
          {analysis ? (
            <EvalBar
              evaluationScore={analysis.evaluationScore}
              isMate={analysis.isMate}
              mateIn={analysis.mateIn}
              evaluation={analysis.evaluation}
              turn={gameState.turn}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="text-xs font-mono text-muted-foreground">—</div>
              <div className="w-5 rounded-sm border border-border/60 bg-secondary/30" style={{ height: 280 }} />
            </div>
          )}

          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Game status */}
            <div className="text-center py-2 bg-secondary/50 rounded-lg border border-border/50">
              <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider font-bold">Status</div>
              <div className="text-sm font-semibold leading-tight">
                {gameState.isCheckmate ? "Checkmate!" :
                 gameState.isStalemate ? "Stalemate" :
                 gameState.isDraw ? "Draw" :
                 gameState.isCheck ? "Check!" :
                 `${gameState.turn === "w" ? "White" : "Black"} to move`}
              </div>
            </div>

            {/* Live per-move analysis */}
            {!hideGameReview && (
              <div className="flex flex-col gap-2 p-2 bg-[#242424] rounded-lg border border-zinc-700/80 shadow-inner">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                  <Cpu size={10} />
                  Game Review
                  {isAnalyzing && (
                    <span className="ml-auto animate-pulse text-blue-400">Analyzing…</span>
                  )}
                </div>

                {analysis ? (
                  <div className="flex gap-2 items-start">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-700 border border-amber-300/40 flex items-end justify-center overflow-hidden shrink-0">
                      <div className="w-6 h-6 rounded-t-full bg-amber-950/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-white text-zinc-950 rounded-lg p-3 shadow-lg relative">
                        <div className="absolute left-[-6px] top-5 w-3 h-3 bg-white rotate-45" />
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${reviewConfig?.badge ?? "bg-zinc-300 text-zinc-900"}`}>
                              <ReviewIcon size={14} />
                            </span>
                            <div className="font-bold text-sm leading-snug">
                              {reviewTitle ?? reviewConfig?.label ?? "Analyzing…"}
                            </div>
                          </div>
                          <div className="bg-zinc-900 text-white rounded px-2 py-1 text-xs font-mono shrink-0">
                            {analysis.evaluation}
                          </div>
                        </div>
                        <p className="text-xs text-zinc-700 leading-snug mt-2">
                          {reviewCommentary}
                        </p>
                        {analysis.bestMoveBeforeSan && analysis.playedMoveSan && analysis.bestMoveBeforeSan !== analysis.playedMoveSan && (
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs bg-zinc-100 rounded-md px-2 py-1.5">
                            <span className="text-zinc-500">Best was</span>
                            <span className="font-mono font-bold text-emerald-700">{analysis.bestMoveBeforeSan}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1 mt-2">
                        <button
                          type="button"
                          onClick={onToggleBestMove}
                          className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors ${showBestMove ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"}`}
                        >
                          <Star size={13} />
                          Best
                        </button>
                        {!hideRetry && (
                          <button
                            type="button"
                            onClick={handleRetry}
                            className="h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                          >
                            <Undo2 size={13} />
                            Retry
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { if (!showBestMove) onToggleBestMove(); }}
                          className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white ${hideRetry ? "col-span-2" : ""}`}
                        >
                          <ArrowRight size={14} />
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 italic">
                    {isAnalyzing ? "Running Stockfish…" : "Make a move to start the coach review"}
                  </div>
                )}
              </div>
            )}

            {/* Top moves */}
            {analysis && analysis.topMoves.length > 0 && (
              <div className="flex flex-col gap-1 p-2 bg-secondary/30 rounded-lg border border-border/40">
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
                  <span>Top Moves</span>
                  {analysis.moveQuality && <MoveQualityBadge quality={analysis.moveQuality} />}
                </div>
                {analysis.topMoves.slice(0, 3).map((move, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-semibold flex-1 px-1">{move.san}</span>
                    <span className={`text-right ${
                      move.evaluation.startsWith("+") ? "text-green-400" :
                      move.evaluation.startsWith("-") ? "text-red-400" :
                      move.evaluation.startsWith("M") ? "text-yellow-400" : "text-muted-foreground"
                    }`}>{move.evaluation}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Custom game-over action (e.g. "Review in History" for multiplayer) */}
            {gameState?.isGameOver && gameOverAction}
          </div>
        </div>
      </div>

      {/* Captured pieces */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex justify-between text-lg px-1">
          <div className="text-white drop-shadow-md">
            {gameState.capturedPieces.white.map((p, i) => (
              <span key={i}>{PIECES[p.toUpperCase()] ?? p}</span>
            ))}
          </div>
          <div className="text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]">
            {gameState.capturedPieces.black.map((p, i) => (
              <span key={i}>{PIECES[p] ?? p}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Move History */}
      <div className="flex-1 min-h-0 bg-background/50 flex flex-col">
        <div className="px-4 py-2 border-b border-border text-xs font-semibold text-muted-foreground flex shrink-0">
          <div className="w-12">Move</div>
          <div className="flex-1">White</div>
          <div className="flex-1">Black</div>
        </div>
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="flex flex-col gap-1 pb-4">
            {movePairs.map((pair) => (
              <div key={pair.number} className="flex text-sm py-1 px-2 hover:bg-secondary/50 rounded transition-colors">
                <div className="w-10 text-muted-foreground font-mono">{pair.number}.</div>
                <div className="flex-1 font-mono font-medium">{pair.white.san}</div>
                <div className="flex-1 font-mono font-medium">{pair.black?.san ?? ""}</div>
              </div>
            ))}
            {movePairs.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8 italic">
                Game hasn't started yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-border bg-card flex flex-col gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1"
        >
          <Settings size={13} />
          Board Theme &amp; Piece Settings
        </button>

        <Button
          variant={showBestMove ? "default" : "outline"}
          className="w-full gap-2"
          onClick={onToggleBestMove}
          disabled={!analysis}
          data-testid="button-show-suggestion"
        >
          <Lightbulb size={14} />
          {showBestMove ? "Hide Suggestion" : "Show Best Move"}
        </Button>

        {!hideReset && (
          <Button
            className="w-full uppercase tracking-widest font-bold gap-2"
            onClick={() => resetGame.mutate()}
            data-testid="button-new-game"
          >
            <RotateCcw size={14} />
            New Game
          </Button>
        )}
      </div>
    </div>
  );
}
