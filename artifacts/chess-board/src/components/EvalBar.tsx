import { cn } from "@/lib/utils";

interface EvalBarProps {
  evaluationScore: number;
  isMate: boolean;
  mateIn?: number | null;
  evaluation: string;
  turn: "w" | "b";
}

export function EvalBar({ evaluationScore, isMate, mateIn, evaluation, turn }: EvalBarProps) {
  const clampedScore = Math.max(-10, Math.min(10, evaluationScore));
  const whitePercent = isMate
    ? (mateIn && mateIn > 0 ? 100 : 0)
    : Math.round(((clampedScore + 10) / 20) * 100);

  const isWhiteWinning = evaluationScore > 0.3;
  const isBlackWinning = evaluationScore < -0.3;
  const isClose = !isWhiteWinning && !isBlackWinning && !isMate;

  const advantageLabel = isMate
    ? (mateIn && mateIn > 0 ? "White wins" : "Black wins")
    : isWhiteWinning
    ? "White is better"
    : isBlackWinning
    ? "Black is better"
    : "Equal";

  const scoreLabel = isMate && mateIn !== undefined && mateIn !== null
    ? (mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`)
    : evaluation;

  return (
    <div className="flex flex-col items-center gap-1 select-none shrink-0" data-testid="eval-bar">
      {/* Score label at top */}
      <div className="text-xs font-mono font-bold text-muted-foreground tracking-tight">
        {scoreLabel}
      </div>

      {/* Bar */}
      <div
        className="w-5 rounded-sm overflow-hidden border border-border/60 shadow-inner relative"
        style={{ height: 280 }}
        title={`Evaluation: ${scoreLabel} — ${advantageLabel}`}
      >
        {/* Black portion (top) */}
        <div
          className={cn(
            "w-full transition-all duration-700 ease-in-out",
            "bg-[#1a1a1a]"
          )}
          style={{ height: `${100 - whitePercent}%` }}
        />
        {/* White portion (bottom) */}
        <div
          className={cn(
            "w-full transition-all duration-700 ease-in-out",
            "bg-[#f0f0f0]"
          )}
          style={{ height: `${whitePercent}%` }}
        />
      </div>

      {/* Advantage label */}
      <div className={cn(
        "text-[9px] font-semibold text-center leading-tight",
        isMate ? "text-yellow-400" :
        isWhiteWinning ? "text-white" :
        isBlackWinning ? "text-zinc-400" :
        "text-muted-foreground"
      )}
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 60, whiteSpace: "nowrap" }}
      >
        {advantageLabel}
      </div>
    </div>
  );
}
