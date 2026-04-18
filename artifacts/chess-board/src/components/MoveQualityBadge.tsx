import { cn } from "@/lib/utils";
import type { MoveQuality } from "@workspace/api-client-react";

interface MoveQualityBadgeProps {
  quality: MoveQuality;
  className?: string;
}

const QUALITY_CONFIG: Record<MoveQuality, { label: string; color: string; symbol: string }> = {
  best:       { label: "Best Move",   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", symbol: "!!" },
  excellent:  { label: "Excellent",   color: "text-green-400 bg-green-400/10 border-green-400/30",       symbol: "!" },
  good:       { label: "Good Move",   color: "text-blue-400 bg-blue-400/10 border-blue-400/30",          symbol: "+" },
  inaccuracy: { label: "Inaccuracy",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",    symbol: "?!" },
  mistake:    { label: "Mistake",     color: "text-orange-400 bg-orange-400/10 border-orange-400/30",    symbol: "?" },
  blunder:    { label: "Blunder",     color: "text-red-500 bg-red-500/10 border-red-500/30",             symbol: "??" },
};

export function MoveQualityBadge({ quality, className }: MoveQualityBadgeProps) {
  const config = QUALITY_CONFIG[quality];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold",
        config.color,
        className
      )}
      data-testid={`move-quality-badge-${quality}`}
    >
      <span className="font-mono font-bold">{config.symbol}</span>
      {config.label}
    </span>
  );
}
