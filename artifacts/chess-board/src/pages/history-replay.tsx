import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  BarChart2, Star, Volume2, VolumeX, Loader2, RefreshCw,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── Quality meta ──────────────────────────────────────────────────────────────

const QUALITY_META: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  best:       { label: "Best",        color: "text-emerald-400", icon: "★",  bg: "bg-emerald-500/20" },
  excellent:  { label: "Excellent",   color: "text-teal-400",    icon: "✦",  bg: "bg-teal-500/20" },
  good:       { label: "Good",        color: "text-blue-400",    icon: "●",  bg: "bg-blue-500/20" },
  inaccuracy: { label: "Inaccuracy",  color: "text-yellow-400",  icon: "▲",  bg: "bg-yellow-500/20" },
  mistake:    { label: "Mistake",     color: "text-orange-400",  icon: "✖",  bg: "bg-orange-500/20" },
  blunder:    { label: "Blunder",     color: "text-red-400",     icon: "??", bg: "bg-red-500/20" },
};

// ── Piece symbols ─────────────────────────────────────────────────────────────

const PIECE_SYMBOLS: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

// ── Eval bar ──────────────────────────────────────────────────────────────────

function EvalBar({ score, isMate, mateIn }: { score: number; isMate?: boolean; mateIn?: number }) {
  const clamp = Math.max(-800, Math.min(800, score));
  const whitePct = ((clamp + 800) / 1600) * 100;

  const label = isMate
    ? (mateIn && mateIn > 0 ? `M${mateIn}` : mateIn && mateIn < 0 ? `-M${Math.abs(mateIn)}` : "M")
    : score === 0
    ? "0.0"
    : `${score > 0 ? "+" : ""}${(score / 100).toFixed(1)}`;

  return (
    <div className="flex flex-row lg:flex-col w-full lg:w-6 h-6 lg:h-full border border-border rounded-sm overflow-hidden relative select-none">
      <div className="bg-[#1a1a1a] transition-all duration-500" style={{ width: `${100 - whitePct}%`, height: "100%" }} />
      <div className="bg-white transition-all duration-500" style={{ width: `${whitePct}%`, height: "100%" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[9px] font-bold leading-none mix-blend-difference ${score >= 0 ? "text-black" : "text-white"}`}>{label}</span>
      </div>
    </div>
  );
}

// ── Review board with arrow overlay ──────────────────────────────────────────

function ReviewBoard({
  fen,
  lastMove,
  bestMoveUci,
}: {
  fen: string;
  lastMove: { from: string; to: string } | null;
  bestMoveUci?: string;
}) {
  const chess = new Chess(fen);
  const board = chess.board();

  const arrow = bestMoveUci && bestMoveUci.length >= 4 ? {
    from: bestMoveUci.slice(0, 2),
    to: bestMoveUci.slice(2, 4),
  } : null;

  const sqCenter = (sq: string) => {
    const file = sq.charCodeAt(0) - 97;
    const rank = 8 - parseInt(sq[1]);
    return { x: file * 12.5 + 6.25, y: rank * 12.5 + 6.25 };
  };

  return (
    <div className="relative w-full aspect-square">
      <div className="w-full h-full flex flex-col border-2 border-border rounded overflow-hidden shadow-xl">
        {board.map((row, i) => (
          <div key={i} className="flex-1 flex">
            {row.map((square, j) => {
              const isLight = (i + j) % 2 === 0;
              const file = String.fromCharCode(97 + j);
              const rank = 8 - i;
              const sq = `${file}${rank}`;
              const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const isArrowTo = arrow?.to === sq;
              const isArrowFrom = arrow?.from === sq;
              const pieceKey = square
                ? square.color === "w" ? square.type.toUpperCase() : square.type.toLowerCase()
                : null;

              return (
                <div
                  key={j}
                  className={`flex-1 flex items-center justify-center relative select-none
                    ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                    ${isLast ? "!bg-yellow-300/50" : ""}
                    ${isArrowTo ? "after:absolute after:inset-0 after:bg-green-400/25" : ""}
                    ${isArrowFrom ? "after:absolute after:inset-0 after:bg-green-400/15" : ""}`}
                >
                  {square && (
                    <span className={`text-[clamp(1rem,5vw,3rem)] leading-none drop-shadow-md select-none z-10 relative
                      ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]"}`}>
                      {pieceKey ? PIECE_SYMBOLS[pieceKey] : ""}
                    </span>
                  )}
                  {j === 0 && <span className={`absolute top-0.5 left-0.5 text-[10px] font-bold z-20 ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{rank}</span>}
                  {i === 7 && <span className={`absolute bottom-0.5 right-0.5 text-[10px] font-bold z-20 ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{file}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {arrow && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="arrowhead" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(34,197,94,0.9)" />
            </marker>
          </defs>
          {(() => {
            const from = sqCenter(arrow.from);
            const to = sqCenter(arrow.to);
            const dx = to.x - from.x; const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len; const uy = dy / len;
            return (
              <line
                x1={from.x + ux * 3} y1={from.y + uy * 3}
                x2={to.x - ux * 4} y2={to.y - uy * 4}
                stroke="rgba(34,197,94,0.8)" strokeWidth="2.5"
                markerEnd="url(#arrowhead)"
              />
            );
          })()}
        </svg>
      )}
    </div>
  );
}

// ── Eval graph ────────────────────────────────────────────────────────────────

function EvalGraph({ reviews, currentIndex, onSeek }: {
  reviews: any[];
  currentIndex: number;
  onSeek: (i: number) => void;
}) {
  const data = reviews.map((r: any, i: number) => ({
    name: `${Math.ceil((i + 1) / 2)}${i % 2 === 0 ? "w" : "b"}`,
    score: r.evaluationScore != null ? Math.max(-800, Math.min(800, r.evaluationScore)) : 0,
    quality: r.moveQuality,
    san: r.san,
    index: i,
  }));

  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={data} onClick={(e: any) => { if (e?.activePayload?.[0]) onSeek(e.activePayload[0].payload.index); }} style={{ cursor: "pointer" }}>
        <XAxis dataKey="name" hide />
        <YAxis domain={[-800, 800]} hide />
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            const label = `${d.score >= 0 ? "+" : ""}${(d.score / 100).toFixed(1)}`;
            return (
              <div className="bg-card border border-border rounded px-2 py-1 text-xs shadow">
                <div className="font-bold">{d.san}</div>
                <div className="text-muted-foreground">{label}</div>
                {d.quality && QUALITY_META[d.quality] && (
                  <div className={QUALITY_META[d.quality].color}>{QUALITY_META[d.quality].label}</div>
                )}
              </div>
            );
          }}
        />
        <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
        {currentIndex >= 0 && data[currentIndex] && (
          <ReferenceLine x={data[currentIndex].name} stroke="#818cf8" strokeWidth={1.5} />
        )}
        <Line type="monotone" dataKey="score" stroke="#60a5fa" strokeWidth={2}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            const q = payload.quality;
            if (!q || q === "best" || q === "excellent" || q === "good") return <></>;
            const colors: Record<string, string> = { inaccuracy: "#facc15", mistake: "#fb923c", blunder: "#f87171" };
            return <circle key={`dot-${payload.index}`} cx={cx} cy={cy} r={4} fill={colors[q] || "#888"} stroke="white" strokeWidth={1} />;
          }}
          activeDot={{ r: 5, fill: "#818cf8" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Player accuracy ───────────────────────────────────────────────────────────

function calcAccuracy(reviews: any[], color: "w" | "b") {
  const mine = reviews.filter((_: any, i: number) => i % 2 === (color === "w" ? 0 : 1));
  if (mine.length === 0) return 100;
  const total = mine.reduce((acc: number, r: any) => acc + Math.max(0, 100 - (r.centipawnLoss ?? 0) * 0.1), 0);
  return Math.round(total / mine.length);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HistoryReplayPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();

  const [fens, setFens] = useState<string[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [cursor, setCursor] = useState(0);

  const [analyzing, setAnalyzing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [voiceCommentary, setVoiceCommentary] = useState(false);

  const moveListRef = useRef<HTMLDivElement>(null);

  // Load game
  useEffect(() => {
    const loadGame = async () => {
      const movesRaw: any[] = [];
      let loaded = false;

      if (id) {
        try {
          const res = await fetch(`/api/games/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            if (data.pgn) {
              try {
                const chess = new Chess();
                chess.loadPgn(data.pgn);
                const history = chess.history({ verbose: true });
                history.forEach((m: any) => movesRaw.push({ san: m.san, from: m.from, to: m.to, color: m.color }));
                loaded = true;
              } catch {}
            } else if (data.moves?.length) {
              data.moves.forEach((m: any) => movesRaw.push(m));
              loaded = true;
            }
          }
        } catch {}
      }

      if (!loaded) {
        try {
          const res = await fetch("/api/game/history");
          const hist = await res.json();
          (hist.moves || []).forEach((m: any) => movesRaw.push(m));
        } catch {}
      }

      const chess = new Chess();
      const fenList: string[] = [chess.fen()];
      movesRaw.forEach((m: any) => {
        try { chess.move(m.san || m); } catch {}
        fenList.push(chess.fen());
      });

      setFens(fenList);
      setMoves(movesRaw);
      setCursor(fenList.length - 1);
    };
    loadGame();
  }, [id, token]);

  // Start analysis
  const startAnalysis = async () => {
    if (moves.length === 0 || analyzing) return;
    setAnalysisStarted(true);
    setAnalyzing(true);
    setReviews([]);
    try {
      const sanMoves = moves.map((m: any) => m.san || m);
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moves: sanMoves }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch {
      setReviews([]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Voice commentary
  useEffect(() => {
    if (!voiceCommentary || cursor === 0) return;
    const review = reviews[cursor - 1];
    if (!review) return;
    const text = `${review.reviewTitle || review.san}. ${review.reviewCommentary || ""}`.trim();
    if (!text) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
    return () => { window.speechSynthesis.cancel(); };
  }, [cursor, voiceCommentary, reviews]);

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCursor((c) => Math.min(fens.length - 1, c + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fens.length]);

  // Scroll active move into view
  useEffect(() => {
    document.getElementById(`move-${cursor - 1}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [cursor]);

  const currentFen = fens[cursor] || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const currentReview = cursor > 0 ? reviews[cursor - 1] : null;
  const lastMove = cursor > 0 && moves[cursor - 1]
    ? { from: moves[cursor - 1].from, to: moves[cursor - 1].to }
    : null;

  const whiteAcc = calcAccuracy(reviews, "w");
  const blackAcc = calcAccuracy(reviews, "b");
  const countQuality = (q: string) => reviews.filter((r: any) => r.moveQuality === q).length;

  return (
    <div className="p-2 md:p-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[auto_1fr_320px] gap-4 items-start">

      {/* Eval bar */}
      <div className="hidden lg:flex h-[min(80vh,600px)] items-stretch">
        {currentReview ? (
          <EvalBar score={currentReview.evaluationScore ?? 0} isMate={currentReview.isMate} mateIn={currentReview.mateIn} />
        ) : (
          <div className="w-6 h-full bg-gradient-to-b from-[#1a1a1a] to-white border border-border rounded-sm" />
        )}
      </div>

      {/* Board + controls */}
      <div className="flex flex-col gap-3 min-w-0">
        <ReviewBoard
          fen={currentFen}
          lastMove={lastMove}
          bestMoveUci={currentReview?.topMoves?.[0]?.move}
        />

        {/* Navigation */}
        <div className="flex gap-2 justify-center items-center flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setCursor(0)} disabled={cursor === 0}><ChevronsLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground px-2">{cursor}/{fens.length - 1}</span>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => Math.min(fens.length - 1, c + 1))} disabled={cursor === fens.length - 1}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(fens.length - 1)} disabled={cursor === fens.length - 1}><ChevronsRight className="w-4 h-4" /></Button>
          <Button
            variant={voiceCommentary ? "default" : "outline"}
            size="icon"
            onClick={() => { setVoiceCommentary((v) => !v); if (voiceCommentary) window.speechSynthesis.cancel(); }}
            title="Voice commentary"
          >
            {voiceCommentary ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">Use ← → arrow keys to navigate</p>

        {/* Pre-analysis call to action */}
        {!analysisStarted && moves.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 text-center space-y-3">
            <BarChart2 className="w-8 h-8 text-primary mx-auto" />
            <h3 className="font-bold">Analyze this game</h3>
            <p className="text-sm text-muted-foreground">
              Stockfish will evaluate every move, identify blunders and brilliancies, and explain what went wrong or right.
            </p>
            <p className="text-xs text-muted-foreground">About 1–3 minutes for {moves.length} moves</p>
            <Button onClick={startAnalysis} className="gap-2 w-full max-w-xs mx-auto">
              <BarChart2 className="w-4 h-4" /> Start Analysis
            </Button>
          </div>
        )}

        {/* Analysis progress */}
        {analyzing && (
          <div className="bg-card border border-border rounded-xl p-5 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <h3 className="font-bold">Analyzing {moves.length} moves...</h3>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse w-full" />
            </div>
            <p className="text-xs text-muted-foreground">Stockfish is thinking at depth 12 for each position</p>
          </div>
        )}

        {/* Accuracy summary */}
        {reviews.length > 0 && !analyzing && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="font-bold text-sm text-center">Game Report</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "White", acc: whiteAcc },
                { label: "Black", acc: blackAcc },
              ].map(({ label, acc }) => (
                <div key={label} className="text-center">
                  <div className={`text-3xl font-bold ${acc >= 85 ? "text-emerald-400" : acc >= 70 ? "text-yellow-400" : "text-red-400"}`}>{acc}%</div>
                  <div className="text-xs text-muted-foreground">{label} Accuracy</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(["best", "excellent", "good", "inaccuracy", "mistake", "blunder"] as const).map((q) => {
                const meta = QUALITY_META[q];
                const cnt = countQuality(q);
                if (cnt === 0) return null;
                return (
                  <div key={q} className={`${meta.bg} rounded-lg p-2`}>
                    <div className={`text-xl font-bold ${meta.color}`}>{cnt}</div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right: analysis card + eval graph + move list */}
      <div className="flex flex-col gap-3">

        {/* Current move analysis */}
        {currentReview && !analyzing ? (
          <Card className="bg-card border-border p-4 space-y-4 animate-in fade-in duration-200">
            {/* Quality header */}
            {currentReview.moveQuality && (() => {
              const meta = QUALITY_META[currentReview.moveQuality];
              return (
                <div className={`flex items-center gap-3 ${meta.bg} rounded-xl px-4 py-3`}>
                  <span className={`text-2xl leading-none font-bold ${meta.color}`}>{meta.icon}</span>
                  <div className="flex-1">
                    <div className={`font-bold ${meta.color}`}>{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{currentReview.san}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">
                      {currentReview.isMate
                        ? (currentReview.mateIn > 0 ? `M${currentReview.mateIn}` : `-M${Math.abs(currentReview.mateIn)}`)
                        : `${currentReview.evaluationScore >= 0 ? "+" : ""}${(currentReview.evaluationScore / 100).toFixed(2)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">eval</div>
                  </div>
                </div>
              );
            })()}

            {/* Title */}
            {currentReview.reviewTitle && (
              <h3 className="font-bold text-base">{currentReview.reviewTitle}</h3>
            )}

            {/* Commentary */}
            {currentReview.reviewCommentary && (
              <p className="text-sm text-muted-foreground leading-relaxed">{currentReview.reviewCommentary}</p>
            )}

            {/* Best move */}
            {currentReview.bestMoveSan && currentReview.bestMoveSan !== currentReview.san && (
              <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-3 space-y-1">
                <div className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Best move was
                </div>
                <div className="font-bold font-mono text-lg">{currentReview.bestMoveSan}</div>
                <div className="text-xs text-muted-foreground">The green arrow on the board shows this move</div>
              </div>
            )}

            {/* Centipawn loss */}
            {(currentReview.centipawnLoss ?? 0) > 20 && (
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Centipawn loss</span>
                <span className="font-mono font-bold text-orange-400">−{(currentReview.centipawnLoss / 100).toFixed(2)}</span>
              </div>
            )}

            {/* Top engine moves */}
            {currentReview.topMoves?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Engine top lines</div>
                {currentReview.topMoves.slice(0, 3).map((m: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-muted/50 rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-mono font-bold">{m.san}</span>
                    <span className={`font-mono ${parseFloat(m.evaluation) > 0 ? "text-emerald-400" : parseFloat(m.evaluation) < 0 ? "text-red-400" : "text-muted-foreground"}`}>{m.evaluation}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : cursor === 0 ? (
          <Card className="bg-card border-border p-4 text-center text-sm text-muted-foreground">
            Starting position — click a move or use arrow keys
          </Card>
        ) : analysisStarted && !analyzing && !currentReview ? (
          <Card className="bg-card border-border p-4 text-center text-sm text-muted-foreground">No analysis for this position</Card>
        ) : null}

        {/* Eval graph */}
        {reviews.length > 0 && (
          <Card className="bg-card border-border p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <BarChart2 className="w-3 h-3" /> Evaluation
            </div>
            <EvalGraph reviews={reviews} currentIndex={cursor - 1} onSeek={(i) => setCursor(i + 1)} />
          </Card>
        )}

        {/* Move list */}
        <Card className="bg-card border-border flex flex-col" style={{ maxHeight: "380px" }}>
          <div className="p-3 border-b border-border flex justify-between items-center shrink-0">
            <span className="font-bold text-sm">Moves</span>
            {analysisStarted && !analyzing && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={startAnalysis} title="Re-analyze">
                <RefreshCw className="w-3 h-3" />
              </Button>
            )}
          </div>
          <div className="overflow-auto p-2" ref={moveListRef}>
            {moves.length > 0 ? (
              <div className="text-sm font-mono">
                {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
                  const wIdx = i * 2;
                  const bIdx = i * 2 + 1;
                  const wMove = moves[wIdx];
                  const bMove = moves[bIdx];
                  const wReview = reviews[wIdx];
                  const bReview = reviews[bIdx];

                  return (
                    <div key={i} className="flex items-stretch gap-0.5 mb-0.5">
                      <span className="w-7 text-muted-foreground text-right py-1 pr-1 shrink-0 text-xs self-center">{i + 1}.</span>
                      {[
                        { move: wMove, review: wReview, active: cursor === wIdx + 1, idx: wIdx },
                        { move: bMove, review: bReview, active: cursor === bIdx + 1, idx: bIdx },
                      ].map(({ move, review, active, idx }) =>
                        move ? (
                          <button
                            key={idx}
                            id={`move-${idx}`}
                            onClick={() => setCursor(idx + 1)}
                            className={`flex-1 flex items-center gap-1 px-1.5 py-1 rounded text-left text-xs transition-colors hover:bg-muted
                              ${active ? "bg-primary/20 text-primary font-bold" : ""}`}
                          >
                            {review?.moveQuality && QUALITY_META[review.moveQuality] && (
                              <span
                                className={`text-[10px] shrink-0 leading-none ${QUALITY_META[review.moveQuality].color}`}
                                title={QUALITY_META[review.moveQuality].label}
                              >
                                {QUALITY_META[review.moveQuality].icon}
                              </span>
                            )}
                            <span>{move.san || move}</span>
                          </button>
                        ) : <div key={idx} className="flex-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-6">No recorded moves</div>
            )}
          </div>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => setLocation("/history")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to History
        </Button>
      </div>
    </div>
  );
}
