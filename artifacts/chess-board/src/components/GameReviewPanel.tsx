import { useState, useCallback, useEffect } from "react";
import { Star, ArrowRight, RotateCcw, CheckCircle2, HelpCircle, AlertTriangle, Cpu, ChevronLeft, ChevronRight, Loader2, BarChart3 } from "lucide-react";
import { MoveQualityBadge } from "./MoveQualityBadge";

export type MoveQuality = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface MoveReview {
  moveIndex: number;
  san: string;
  fen: string;
  moveQuality?: MoveQuality;
  reviewTitle?: string;
  reviewCommentary?: string;
  bestMoveSan?: string;
  evaluation: string;
  evaluationScore: number;
  topMoves: Array<{ san: string; evaluation: string; move: string }>;
  isMate: boolean;
  mateIn?: number;
}

interface GameSummary {
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  best: number;
  accuracy: number;
}

const QUALITY_CONFIG = {
  best: { label: "Best", badge: "bg-emerald-500 text-white", icon: CheckCircle2, dot: "bg-emerald-500" },
  excellent: { label: "Excellent", badge: "bg-green-500 text-white", icon: Star, dot: "bg-green-400" },
  good: { label: "Good", badge: "bg-blue-500 text-white", icon: CheckCircle2, dot: "bg-blue-400" },
  inaccuracy: { label: "Inaccuracy", badge: "bg-yellow-400 text-zinc-950", icon: HelpCircle, dot: "bg-yellow-400" },
  mistake: { label: "Mistake", badge: "bg-orange-500 text-white", icon: AlertTriangle, dot: "bg-orange-500" },
  blunder: { label: "Blunder", badge: "bg-red-500 text-white", icon: AlertTriangle, dot: "bg-red-500" },
} as const;

function computeSummary(reviews: MoveReview[]): GameSummary {
  let blunders = 0, mistakes = 0, inaccuracies = 0, best = 0;
  for (const r of reviews) {
    if (r.moveQuality === "blunder") blunders++;
    else if (r.moveQuality === "mistake") mistakes++;
    else if (r.moveQuality === "inaccuracy") inaccuracies++;
    else if (r.moveQuality === "best" || r.moveQuality === "excellent") best++;
  }
  const goodMoves = reviews.filter(r => r.moveQuality === "best" || r.moveQuality === "excellent" || r.moveQuality === "good").length;
  const accuracy = reviews.length > 0 ? Math.round((goodMoves / reviews.length) * 100) : 0;
  return { blunders, mistakes, inaccuracies, best, accuracy };
}

interface Props {
  reviews: MoveReview[];
  isLoading: boolean;
  currentMoveIdx: number;
  onNavigate: (idx: number) => void;
  onClose: () => void;
}

export function GameReviewPanel({ reviews, isLoading, currentMoveIdx, onNavigate, onClose }: Props) {
  const [showSummary, setShowSummary] = useState(false);

  const review = reviews[currentMoveIdx] ?? null;
  const quality = review?.moveQuality;
  const config = quality ? QUALITY_CONFIG[quality] : null;
  const ReviewIcon = config?.icon ?? Cpu;

  const goNext = useCallback(() => {
    if (currentMoveIdx < reviews.length - 1) onNavigate(currentMoveIdx + 1);
  }, [currentMoveIdx, reviews.length, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentMoveIdx > 0) onNavigate(currentMoveIdx - 1);
  }, [currentMoveIdx, onNavigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const summary = computeSummary(reviews);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 px-4">
        <Loader2 size={24} className="animate-spin text-primary" />
        <div className="text-sm font-semibold text-center">Analyzing your game…</div>
        <div className="text-xs text-muted-foreground text-center">
          Stockfish is reviewing every move. This may take a minute.
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-6">No moves to review.</div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with nav */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
          <Cpu size={11} className="text-primary" />
          Game Review
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSummary(s => !s)}
            title="Summary"
            className={`p-1.5 rounded-md transition-colors ${showSummary ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
          >
            <BarChart3 size={13} />
          </button>
          <button
            onClick={goPrev}
            disabled={currentMoveIdx === 0}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px] font-mono text-muted-foreground min-w-[48px] text-center">
            {currentMoveIdx + 1} / {reviews.length}
          </span>
          <button
            onClick={goNext}
            disabled={currentMoveIdx === reviews.length - 1}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Game summary */}
      {showSummary && (
        <div className="rounded-xl border border-border/40 bg-secondary/10 p-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Game Summary</div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <SummaryItem label="Accuracy" value={`${summary.accuracy}%`} color="text-primary" />
            <SummaryItem label="Best/Excellent" value={summary.best} color="text-emerald-400" />
            <SummaryItem label="Inaccuracies" value={summary.inaccuracies} color="text-yellow-400" />
            <SummaryItem label="Mistakes" value={summary.mistakes} color="text-orange-400" />
            <SummaryItem label="Blunders" value={summary.blunders} color="text-red-400" />
          </div>
        </div>
      )}

      {/* Move card */}
      {review && (
        <div className="flex flex-col gap-2 p-2 bg-[#1c1c1c] rounded-xl border border-zinc-700/80 shadow-inner">
          <div className="flex gap-2 items-start">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-amber-200 to-amber-700 border border-amber-300/40 flex items-end justify-center overflow-hidden shrink-0">
              <div className="w-5.5 h-5.5 rounded-t-full bg-amber-950/80" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="bg-white text-zinc-950 rounded-xl p-3 shadow-lg relative">
                <div className="absolute left-[-6px] top-4 w-3 h-3 bg-white rotate-45" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${config?.badge ?? "bg-zinc-200 text-zinc-700"}`}>
                      <ReviewIcon size={13} />
                    </span>
                    <span className="font-bold text-sm leading-snug">
                      {review.reviewTitle ?? (quality && config ? `${review.san} is ${config.label.toLowerCase()}` : review.san)}
                    </span>
                  </div>
                  <span className="bg-zinc-900 text-white rounded px-2 py-0.5 text-xs font-mono shrink-0">
                    {review.evaluation}
                  </span>
                </div>

                {review.reviewCommentary && (
                  <p className="text-xs text-zinc-600 leading-snug mt-2">
                    {review.reviewCommentary}
                  </p>
                )}

                {review.bestMoveSan && review.bestMoveSan !== review.san && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs bg-zinc-100 rounded-lg px-2.5 py-1.5">
                    <span className="text-zinc-500">Best was</span>
                    <span className="font-mono font-bold text-emerald-700">{review.bestMoveSan}</span>
                  </div>
                )}
              </div>

              {/* Best / Retry / Next */}
              <div className="grid grid-cols-3 gap-1 mt-2">
                <button
                  type="button"
                  disabled
                  title="Best move is shown in the card"
                  className="h-8 rounded-lg text-xs font-bold flex items-center justify-center gap-1 bg-zinc-800 text-zinc-400 opacity-60 cursor-default"
                >
                  <Star size={12} />
                  Best
                </button>
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentMoveIdx === 0}
                  className="h-8 rounded-lg text-xs font-bold flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={12} />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentMoveIdx === reviews.length - 1}
                  className="h-8 rounded-lg text-xs font-bold flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-40"
                >
                  <ArrowRight size={13} />
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Top moves */}
          {review.topMoves.length > 0 && (
            <div className="pt-2 border-t border-zinc-700/60">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1 flex items-center justify-between">
                <span>Top Moves</span>
                {quality && <MoveQualityBadge quality={quality} />}
              </div>
              <div className="space-y-0.5">
                {review.topMoves.slice(0, 3).map((move, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-mono py-0.5">
                    <span className="text-zinc-500 w-4">{i + 1}.</span>
                    <span className="font-semibold flex-1 px-1 text-zinc-200">{move.san}</span>
                    <span className={
                      move.evaluation.startsWith("+") ? "text-green-400" :
                      move.evaluation.startsWith("-") ? "text-red-400" : "text-yellow-400"
                    }>{move.evaluation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Move list with quality dots */}
      <div className="rounded-xl border border-border/40 bg-secondary/5 p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Moves</div>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-0.5 text-xs font-mono max-h-48 overflow-y-auto">
          {Array.from({ length: Math.ceil(reviews.length / 2) }, (_, pairIdx) => {
            const wReview = reviews[pairIdx * 2];
            const bReview = reviews[pairIdx * 2 + 1];
            return (
              <MoveRow
                key={pairIdx}
                number={pairIdx + 1}
                white={wReview}
                black={bReview}
                currentIdx={currentMoveIdx}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      </div>

      <button
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
      >
        Close review
      </button>
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between bg-secondary/20 rounded-lg px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function MoveRow({ number, white, black, currentIdx, onNavigate }: {
  number: number;
  white?: MoveReview;
  black?: MoveReview;
  currentIdx: number;
  onNavigate: (idx: number) => void;
}) {
  return (
    <>
      <span className="text-muted-foreground text-right pr-1 py-0.5">{number}.</span>
      <MoveCell review={white} isActive={white?.moveIndex === currentIdx} onNavigate={onNavigate} />
      <MoveCell review={black} isActive={black?.moveIndex === currentIdx} onNavigate={onNavigate} />
    </>
  );
}

function MoveCell({ review, isActive, onNavigate }: {
  review?: MoveReview;
  isActive: boolean;
  onNavigate: (idx: number) => void;
}) {
  if (!review) return <span />;
  const dot = review.moveQuality ? QUALITY_CONFIG[review.moveQuality]?.dot : "bg-zinc-600";
  return (
    <button
      onClick={() => onNavigate(review.moveIndex)}
      className={`flex items-center gap-1.5 text-left px-1 py-0.5 rounded transition-colors ${isActive ? "bg-primary/20 text-primary font-bold" : "hover:bg-secondary/60 text-foreground"}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {review.san}
    </button>
  );
}
