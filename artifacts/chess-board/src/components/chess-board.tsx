import { useState } from "react";
import { Chess } from "chess.js";
import type { BoardTheme } from "@/hooks/use-preferences";

// ── Piece symbols ──────────────────────────────────────────────────────────────
const SYM: Record<string, string> = {
  P:"♙",N:"♘",B:"♗",R:"♖",Q:"♕",K:"♔",
  p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚",
};

// ── Square center in SVG viewBox (0-100) ─────────────────────────────────────
function sqCenter(sq: string, flipped: boolean) {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  return { x: col * 12.5 + 6.25, y: row * 12.5 + 6.25 };
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BoardArrow {
  from: string;
  to: string;
  color?: string;
}

export interface ChessBoardProps {
  fen: string;
  theme: BoardTheme;
  onMove?: (from: string, to: string, promotion?: string) => void;
  disabled?: boolean;
  lastMove?: { from: string; to: string } | null;
  flipped?: boolean;
  arrows?: BoardArrow[];
}

// ── Unified ChessBoard ────────────────────────────────────────────────────────
export function ChessBoard({
  fen,
  theme,
  onMove,
  disabled = false,
  lastMove = null,
  flipped = false,
  arrows = [],
}: ChessBoardProps) {
  const chess = new Chess(fen);
  const rawBoard = chess.board();
  const board = flipped
    ? [...rawBoard].reverse().map((r) => [...r].reverse())
    : rawBoard;

  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [hoveredSq, setHoveredSq] = useState<string | null>(null);

  const readOnly = !onMove;

  const toSq = (i: number, j: number) => {
    const file = String.fromCharCode(97 + (flipped ? 7 - j : j));
    const rank = flipped ? i + 1 : 8 - i;
    return `${file}${rank}`;
  };

  const handleClick = (sq: string) => {
    if (readOnly || disabled || promo) return;
    if (selected) {
      if (legalTargets.includes(sq)) {
        const piece = chess.get(selected as any);
        const isP =
          piece?.type === "p" &&
          ((piece.color === "w" && sq[1] === "8") || (piece.color === "b" && sq[1] === "1"));
        if (isP) {
          setPromo({ from: selected, to: sq });
          setSelected(null);
          setLegalTargets([]);
        } else {
          onMove!(selected, sq);
          setSelected(null);
          setLegalTargets([]);
        }
      } else {
        const p = chess.get(sq as any);
        if (p && p.color === chess.turn()) {
          setSelected(sq);
          setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to));
        } else {
          setSelected(null);
          setLegalTargets([]);
        }
      }
    } else {
      const p = chess.get(sq as any);
      if (p && p.color === chess.turn()) {
        setSelected(sq);
        setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to));
      }
    }
  };

  // Yellow last-move arrow + any extra arrows (e.g. green best-move in analysis)
  const allArrows: BoardArrow[] = [
    ...(lastMove ? [{ from: lastMove.from, to: lastMove.to, color: "rgba(255,210,0,0.88)" }] : []),
    ...arrows,
  ];

  return (
    <div className="relative w-full h-full">

      {/* Promotion modal */}
      {promo && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center rounded">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3">
            <p className="text-sm font-medium">Promote pawn to:</p>
            <div className="flex gap-3">
              {["q", "r", "b", "n"].map((p) => (
                <button
                  key={p}
                  className="w-14 h-14 text-4xl bg-muted hover:bg-primary/20 rounded-lg transition-colors"
                  onClick={() => { onMove!(promo.from, promo.to, p); setPromo(null); }}
                >
                  {SYM[chess.turn() === "w" ? p.toUpperCase() : p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Board grid */}
      <div className="w-full h-full flex flex-col border border-border rounded overflow-hidden shadow-xl">
        {board.map((row, i) => (
          <div key={i} className="flex-1 flex">
            {row.map((square, j) => {
              const light = (i + j) % 2 === 0;
              const sq = toSq(i, j);
              const sel = selected === sq;
              const tgt = legalTargets.includes(sq);
              const lm = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const hovered = hoveredSq === sq;
              const pk = square
                ? square.color === "w" ? square.type.toUpperCase() : square.type
                : null;

              const bg = sel
                ? theme.highlight
                : lm && !sel
                  ? light ? theme.lmLight : theme.lmDark
                  : light ? theme.light : theme.dark;

              const cursor = readOnly || disabled || !!promo
                ? "cursor-default"
                : tgt
                  ? "cursor-pointer"
                  : square && square.color === chess.turn()
                    ? "cursor-grab"
                    : "cursor-default";

              const showRank = flipped ? j === 7 : j === 0;
              const showFile = flipped ? i === 0 : i === 7;
              const rankLabel = flipped ? String(i + 1) : String(8 - i);
              const fileLabel = flipped
                ? String.fromCharCode(104 - j)
                : String.fromCharCode(97 + j);

              return (
                <div
                  key={j}
                  onClick={() => handleClick(sq)}
                  onMouseEnter={() => !readOnly && setHoveredSq(sq)}
                  onMouseLeave={() => !readOnly && setHoveredSq(null)}
                  className={`flex-1 flex items-center justify-center relative select-none transition-colors duration-100 ${cursor}`}
                  style={{ background: bg }}
                >
                  {/* Legal move dot */}
                  {tgt && !square && (
                    <div
                      className="absolute inset-[30%] rounded-full pointer-events-none z-10"
                      style={{ background: theme.dotColor }}
                    />
                  )}
                  {/* Capture ring */}
                  {tgt && square && (
                    <div
                      className="absolute inset-0 pointer-events-none z-10"
                      style={{ boxShadow: `inset 0 0 0 3px ${theme.ringColor}` }}
                    />
                  )}
                  {/* Hover glow */}
                  {hovered && !sel && !tgt && square && square.color === chess.turn() && !disabled && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    />
                  )}
                  {/* Piece */}
                  {square && (
                    <span
                      className={`text-[clamp(1.1rem,4vw,3.2rem)] leading-none drop-shadow-md select-none relative z-10
                        ${square.color === "w"
                          ? "text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.5)]"
                          : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.5)]"}`}
                    >
                      {pk ? SYM[pk] : ""}
                    </span>
                  )}
                  {/* Rank label */}
                  {showRank && (
                    <span
                      className="absolute top-0.5 left-0.5 text-[9px] font-bold leading-none z-20"
                      style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}
                    >
                      {rankLabel}
                    </span>
                  )}
                  {/* File label */}
                  {showFile && (
                    <span
                      className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none z-20"
                      style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}
                    >
                      {fileLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* SVG arrow overlay */}
      {allArrows.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            {allArrows.map((a, idx) => (
              <marker
                key={idx}
                id={`ah-${idx}`}
                markerWidth="4"
                markerHeight="4"
                refX="2"
                refY="2"
                orient="auto"
              >
                <path d="M0,0 L4,2 L0,4 Z" fill={a.color ?? "rgba(255,210,0,0.88)"} />
              </marker>
            ))}
          </defs>
          {allArrows.map((a, idx) => {
            const from = sqCenter(a.from, flipped);
            const to = sqCenter(a.to, flipped);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const ux = dx / len;
            const uy = dy / len;
            return (
              <line
                key={idx}
                x1={from.x + ux * 2.5}
                y1={from.y + uy * 2.5}
                x2={to.x - ux * 3.5}
                y2={to.y - uy * 3.5}
                stroke={a.color ?? "rgba(255,210,0,0.88)"}
                strokeWidth="2.8"
                strokeLinecap="round"
                markerEnd={`url(#ah-${idx})`}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
