import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { ArrowLeft, ChevronLeft, ChevronRight, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";

const PIECE_SYMBOLS: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

function ReplayBoard({ fen }: { fen: string }) {
  const chess = new Chess(fen);
  const board = chess.board();

  return (
    <div className="w-full max-w-md aspect-square flex flex-col border-2 border-border rounded overflow-hidden shadow-lg">
      {board.map((row, i) => (
        <div key={i} className="flex-1 flex">
          {row.map((square, j) => {
            const isLight = (i + j) % 2 === 0;
            const file = String.fromCharCode(97 + j);
            const rank = 8 - i;
            const pieceKey = square
              ? square.color === "w"
                ? square.type.toUpperCase()
                : square.type.toLowerCase()
              : null;

            return (
              <div
                key={j}
                className={`flex-1 flex items-center justify-center relative select-none
                  ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}`}
              >
                {square && (
                  <span
                    className={`text-[clamp(1rem,4.5vw,2.5rem)] leading-none drop-shadow-md
                      ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.3)]"}`}
                  >
                    {pieceKey ? PIECE_SYMBOLS[pieceKey] : ""}
                  </span>
                )}
                {j === 0 && (
                  <span className={`absolute top-0.5 left-0.5 text-[9px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{rank}</span>
                )}
                {i === 7 && (
                  <span className={`absolute bottom-0 right-0.5 text-[9px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{file}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const qualityColor: Record<string, string> = {
  best: "bg-blue-500",
  excellent: "bg-green-500",
  good: "bg-green-400",
  inaccuracy: "bg-yellow-500",
  mistake: "bg-orange-500",
  blunder: "bg-red-600",
};

const qualityEmoji: Record<string, string> = {
  best: "✨",
  excellent: "👑",
  good: "✅",
  inaccuracy: "⚠️",
  mistake: "❌",
  blunder: "💣",
};

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

export default function HistoryReplayPage() {
  const { id } = useParams();
  const { token } = useAuth();

  const [game, setGame] = useState<any>(null);
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [fen, setFen] = useState(new Chess().fen());
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [voiceCommentary, setVoiceCommentary] = useState(false);
  const moveListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadGame() {
      try {
        const res = await fetch(`/api/games/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setGame(data);

        const temp = new Chess();
        let history: any[] = [];

        if (data.pgn && data.pgn.trim()) {
          try {
            temp.loadPgn(data.pgn);
            history = temp.history({ verbose: true });
          } catch { /* ignore */ }
        } else if (Array.isArray(data.moves) && data.moves.length > 0) {
          for (const uci of data.moves) {
            const from = uci.slice(0, 2);
            const to = uci.slice(2, 4);
            const promotion = uci.length === 5 ? uci[4] : undefined;
            const move = temp.move({ from, to, promotion });
            if (move) history.push(move);
          }
        }

        setMoveHistory(history);

        if (history.length > 0) {
          const replay = new Chess();
          history.forEach((m) => replay.move(m.san));
          setFen(replay.fen());
          setCurrentMoveIndex(history.length - 1);
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (token && id) loadGame();
  }, [id, token]);

  // Re-calculate FEN + fetch analysis on move change
  useEffect(() => {
    if (!game || moveHistory.length === 0) return;

    const replay = new Chess();
    for (let i = 0; i <= currentMoveIndex; i++) {
      if (moveHistory[i]) replay.move(moveHistory[i].san);
    }
    const newFen = replay.fen();
    setFen(newFen);

    const timer = setTimeout(async () => {
      setAnalyzing(true);
      try {
        const prevFen = (() => {
          if (currentMoveIndex < 0) return undefined;
          const prev = new Chess();
          for (let i = 0; i < currentMoveIndex; i++) {
            if (moveHistory[i]) prev.move(moveHistory[i].san);
          }
          return prev.fen();
        })();

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: newFen,
            depth: 12,
            previousFen: prevFen,
            lastMove: currentMoveIndex >= 0 ? moveHistory[currentMoveIndex]?.san : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalysis(data);

          if (voiceCommentary) {
            const quality = data.moveQuality || "good";
            const emoji = qualityEmoji[quality] || "";
            const comment = `${emoji} ${data.reviewTitle || quality}. ${data.reviewCommentary || ""}`.trim();
            speak(comment);
          }
        }
      } catch { /* ignore */ } finally {
        setAnalyzing(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [currentMoveIndex, game, moveHistory, voiceCommentary]);

  // Scroll highlighted move into view
  useEffect(() => {
    const el = moveListRef.current?.querySelector(`[data-move="${currentMoveIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentMoveIndex]);

  const goToMove = (index: number) => {
    setCurrentMoveIndex(Math.max(-1, Math.min(moveHistory.length - 1, index)));
  };

  const toggleVoiceCommentary = () => {
    const next = !voiceCommentary;
    setVoiceCommentary(next);
    if (!next) window.speechSynthesis?.cancel();
    else if (analysis) {
      const comment = `${analysis.reviewTitle || ""}. ${analysis.reviewCommentary || ""}`.trim();
      if (comment) speak(comment);
    }
  };

  const evaluationScore = analysis?.evaluationScore ? analysis.evaluationScore / 100 : 0;
  const evalPercentage = Math.max(5, Math.min(95, 50 + evaluationScore * 5));

  if (!game) {
    return <div className="p-8 text-center text-muted-foreground">Loading game replay...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/history">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Game Analysis</h1>
        <Button
          variant={voiceCommentary ? "default" : "outline"}
          size="sm"
          onClick={toggleVoiceCommentary}
          className="ml-auto"
          title={voiceCommentary ? "Disable voice commentary" : "Enable AI voice commentary"}
        >
          {voiceCommentary ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
          {voiceCommentary ? "Commentary On" : "Commentary Off"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col items-center gap-4">
          {/* Eval bar */}
          <div className="w-full max-w-md flex items-center h-3 bg-muted rounded overflow-hidden shadow-inner">
            <div
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${evalPercentage}%` }}
            />
            <div
              className="h-full bg-[#1a1a1a] transition-all duration-500"
              style={{ width: `${100 - evalPercentage}%` }}
            />
          </div>
          {analysis && (
            <div className="w-full max-w-md flex justify-between text-xs text-muted-foreground px-1">
              <span className="font-mono text-white">White {evaluationScore > 0 ? `+${evaluationScore.toFixed(1)}` : ""}</span>
              <span className="font-mono">{evaluationScore < 0 ? `+${Math.abs(evaluationScore).toFixed(1)}` : ""} Black</span>
            </div>
          )}

          <ReplayBoard fen={fen} />

          {/* Navigation */}
          <div className="w-full max-w-md flex justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => goToMove(-1)} disabled={currentMoveIndex < 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex < 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="flex items-center px-4 text-sm text-muted-foreground font-mono min-w-[80px] justify-center">
              {currentMoveIndex < 0 ? "Start" : `Move ${currentMoveIndex + 1}/${moveHistory.length}`}
            </span>
            <Button variant="outline" size="icon" onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex >= moveHistory.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => goToMove(moveHistory.length - 1)} disabled={currentMoveIndex >= moveHistory.length - 1}>
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Analysis panel */}
          {(analysis || analyzing) && (
            <Card className="w-full max-w-md bg-card border-border">
              <CardContent className="p-4">
                {analyzing ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Analyzing position...
                  </div>
                ) : analysis ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={`${qualityColor[analysis.moveQuality] || "bg-gray-500"} text-white`}>
                        {qualityEmoji[analysis.moveQuality] || ""} {(analysis.moveQuality || "good").toUpperCase()}
                      </Badge>
                      <span className="font-mono font-bold text-sm">{analysis.evaluation}</span>
                      {voiceCommentary && <Volume2 className="w-3 h-3 text-primary ml-auto" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{analysis.reviewTitle}</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{analysis.reviewCommentary}</p>
                    </div>
                    {analysis.bestMoveSan && (
                      <div className="text-xs border-t border-border pt-2 mt-2">
                        <span className="text-muted-foreground">Best move: </span>
                        <span className="font-mono font-semibold text-primary">{analysis.bestMoveSan}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Move list */}
        <div className="h-[640px] flex flex-col">
          <Card className="bg-card border-border flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-border font-bold text-sm flex justify-between items-center">
              <span>Move List</span>
              <span className="text-muted-foreground font-normal">{Math.ceil(moveHistory.length / 2)} moves</span>
            </div>
            <div className="flex-1 overflow-auto p-2" ref={moveListRef}>
              {moveHistory.length > 0 ? (
                <div className="space-y-0.5 text-sm font-mono">
                  {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                    <div key={i} className="flex items-center gap-1 px-1">
                      <span className="w-7 text-muted-foreground text-right shrink-0">{i + 1}.</span>
                      {[i * 2, i * 2 + 1].map((idx) => {
                        const move = moveHistory[idx];
                        if (!move) return <span key={idx} className="flex-1" />;
                        const isActive = currentMoveIndex === idx;
                        return (
                          <button
                            key={idx}
                            data-move={idx}
                            className={`flex-1 text-left px-2 py-0.5 rounded transition-colors hover:bg-muted/70
                              ${isActive ? "bg-primary/20 text-primary font-semibold" : "text-foreground"}`}
                            onClick={() => goToMove(idx)}
                          >
                            {move.san}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground text-sm">No moves recorded</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
