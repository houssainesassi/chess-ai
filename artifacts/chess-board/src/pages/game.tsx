import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { Flag, RotateCcw, Mic, MicOff, Bot, List, X, ArrowLeft, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { usePreferences, type BoardTheme } from "@/hooks/use-preferences";
import { DraggableCameraPopup } from "@/components/camera-overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Difficulty ────────────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { label: "Beginner",     depth: 1  },
  { label: "Easy",         depth: 3  },
  { label: "Intermediate", depth: 6  },
  { label: "Hard",         depth: 10 },
  { label: "Expert",       depth: 14 },
  { label: "Master",       depth: 18 },
];

// ── Pieces ────────────────────────────────────────────────────────────────────

const SYM: Record<string, string> = {
  P:"♙",N:"♘",B:"♗",R:"♖",Q:"♕",K:"♔",
  p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚",
};

// ── Chess board ───────────────────────────────────────────────────────────────

function ChessBoard({
  fen, onMove, disabled, lastMove, theme,
}: {
  fen: string;
  onMove: (from: string, to: string, promotion?: string) => void;
  disabled: boolean;
  lastMove: { from: string; to: string } | null;
  theme: BoardTheme;
}) {
  const chess = new Chess(fen);
  const board = chess.board();
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);

  const [hoveredSq, setHoveredSq] = useState<string | null>(null);

  const getCursor = (sq: string, square: any) => {
    if (disabled || promo) return "cursor-default";
    if (selected && legalTargets.includes(sq)) return "cursor-pointer";
    if (square && square.color === chess.turn()) return "cursor-grab";
    return "cursor-default";
  };

  const handleClick = (sq: string) => {
    if (disabled || promo) return;
    if (selected) {
      if (legalTargets.includes(sq)) {
        const piece = chess.get(selected as any);
        const isPromo = piece?.type === "p" &&
          ((piece.color === "w" && sq[1] === "8") || (piece.color === "b" && sq[1] === "1"));
        if (isPromo) { setPromo({ from: selected, to: sq }); setSelected(null); setLegalTargets([]); }
        else { onMove(selected, sq); setSelected(null); setLegalTargets([]); }
      } else {
        const p = chess.get(sq as any);
        if (p && p.color === chess.turn()) { setSelected(sq); setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to)); }
        else { setSelected(null); setLegalTargets([]); }
      }
    } else {
      const p = chess.get(sq as any);
      if (p && p.color === chess.turn()) { setSelected(sq); setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to)); }
    }
  };

  return (
    <div className="relative w-full h-full">
      {promo && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center rounded">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3">
            <p className="text-sm font-medium">Promote pawn to:</p>
            <div className="flex gap-3">
              {["q","r","b","n"].map((p) => (
                <button key={p} className="w-14 h-14 text-4xl bg-muted hover:bg-primary/20 rounded-lg transition-colors"
                  onClick={() => { onMove(promo.from, promo.to, p); setPromo(null); }}>
                  {SYM[chess.turn() === "w" ? p.toUpperCase() : p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="w-full h-full flex flex-col border border-border rounded overflow-hidden shadow-xl">
        {board.map((row, i) => (
          <div key={i} className="flex-1 flex">
            {row.map((square, j) => {
              const light = (i + j) % 2 === 0;
              const file = String.fromCharCode(97 + j);
              const rank = 8 - i;
              const sq = `${file}${rank}`;
              const sel = selected === sq;
              const tgt = legalTargets.includes(sq);
              const lm = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const pk = square ? (square.color === "w" ? square.type.toUpperCase() : square.type) : null;
              const bgColor = sel ? theme.highlight : lm && !sel ? (light ? theme.lmLight : theme.lmDark) : (light ? theme.light : theme.dark);
              const hovered = hoveredSq === sq;
              return (
                <div key={j}
                  onClick={() => handleClick(sq)}
                  onMouseEnter={() => setHoveredSq(sq)}
                  onMouseLeave={() => setHoveredSq(null)}
                  className={`flex-1 flex items-center justify-center relative select-none transition-all duration-150 ${getCursor(sq, square)}`}
                  style={{ background: bgColor }}>
                  {tgt && !square && (
                    <div className="absolute inset-[32%] rounded-full pointer-events-none" style={{ background: theme.dotColor }} />
                  )}
                  {tgt && square && (
                    <div className="absolute inset-0 rounded-none pointer-events-none" style={{ boxShadow: `inset 0 0 0 3px ${theme.ringColor}` }} />
                  )}
                  {hovered && !sel && !tgt && !disabled && square && square.color === chess.turn() && (
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(255,255,255,0.07)" }} />
                  )}
                  {square && (
                    <span className={`text-[clamp(1.2rem,4vw,3.5rem)] leading-none drop-shadow-md select-none
                      ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]"}`}>
                      {pk ? SYM[pk] : ""}
                    </span>
                  )}
                  {j === 0 && <span className="absolute top-0.5 left-0.5 text-[9px] font-bold leading-none" style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}>{rank}</span>}
                  {i === 7 && <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none" style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}>{file}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Voice ─────────────────────────────────────────────────────────────────────

function parseVoice(text: string): { from: string; to: string } | null {
  const t = text.toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bto\b/g, " ")
    .replace(/\bmove\b/g, " ")
    .replace(/\bfrom\b/g, " ")
    .trim();
  const m = t.match(/([a-h]\s*[1-8])[\s,]+([a-h]\s*[1-8])/);
  if (!m) return null;
  const from = m[1].replace(/\s/g, "");
  const to = m[2].replace(/\s/g, "");
  return { from, to };
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiPost(path: string, body?: any) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`); }
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { theme, playMove, playCheck, playGameEnd } = usePreferences();

  const [gameState, setGameState] = useState<any>(null);
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[2]);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showMoves, setShowMoves] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [handActive, setHandActive] = useState(true);
  const [hoveredSqFromCamera, setHoveredSqFromCamera] = useState<string | null>(null);
  const [cameraSelection, setCameraSelection] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const handleMoveRef = useRef<((from: string, to: string) => void) | null>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([fetch("/api/game/state"), fetch("/api/game/history")]);
      setGameState(await s.json());
      setMoveHistory((await h.json()).moves || []);
    } catch { toast({ title: "Failed to load game", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (moveListRef.current) moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
  }, [moveHistory]);

  const triggerAiMove = useCallback(async () => {
    setAiThinking(true);
    try {
      const res = await apiPost("/api/game/ai-move", { depth: difficulty.depth });
      setGameState(res.gameState);
      if (res.gameState.isGameOver) playGameEnd(false);
      else if (res.gameState.isCheck) playCheck();
      else playMove(false);
      await refresh();
    } catch (err: any) {
      toast({ title: err.message || "AI move failed", variant: "destructive" });
    } finally { setAiThinking(false); }
  }, [difficulty.depth, refresh, playMove, playCheck, playGameEnd]);

  const handleMove = useCallback(async (from: string, to: string, promotion?: string) => {
    if (moving || aiThinking || !gameState) return;
    const chess = new Chess(gameState.fen);
    if (chess.turn() !== playerColor) return;
    const isCapture = !!chess.get(to as any);
    setMoving(true);
    try {
      const res = await apiPost("/api/game/move", { move: promotion ? `${from}${to}${promotion}` : `${from}${to}`, source: "ui" });
      setGameState(res.gameState);
      // Sound feedback
      if (res.gameState.isGameOver) playGameEnd(res.gameState.isCheckmate && chess.turn() !== playerColor);
      else if (res.gameState.isCheck) playCheck();
      else playMove(isCapture);
      await refresh();
      if (!res.gameState.isGameOver) setTimeout(triggerAiMove, 300);
    } catch { toast({ title: "Invalid move", variant: "destructive" }); }
    finally { setMoving(false); }
  }, [moving, aiThinking, gameState, playerColor, triggerAiMove, refresh, playMove, playCheck, playGameEnd]);

  const handleUndo = async () => {
    if (aiThinking || moving) return;
    try {
      await apiPost("/api/game/undo");
      const h = await fetch("/api/game/history").then(r => r.json());
      if (h.moves.length >= 1) await apiPost("/api/game/undo");
      await refresh();
    } catch { toast({ title: "Cannot undo", variant: "destructive" }); }
  };

  const startNewGame = async (color: "w" | "b") => {
    try {
      await apiPost("/api/game/reset");
      setPlayerColor(color);
      setGameStarted(true);
      await refresh();
      if (color === "b") setTimeout(triggerAiMove, 400);
    } catch { toast({ title: "Failed to start", variant: "destructive" }); }
  };

  // Keep ref in sync so voice always calls the latest handleMove
  useEffect(() => { handleMoveRef.current = handleMove; }, [handleMove]);

  const handleCameraSquare = useCallback((sq: string) => {
    if (cameraSelection) {
      handleMoveRef.current?.(cameraSelection, sq);
      setCameraSelection(null);
      toast({ title: `${cameraSelection.toUpperCase()} → ${sq.toUpperCase()}` });
    } else {
      setCameraSelection(sq);
      toast({ title: `${sq.toUpperCase()} selected`, description: "Point at destination square" });
    }
  }, [cameraSelection, toast]);

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice control not supported", description: "Use Chrome or Edge for voice moves.", variant: "destructive" });
      return;
    }
    if (voiceActive) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setVoiceActive(false);
      setVoiceTranscript("");
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript;
      setVoiceTranscript(text);
      if (last.isFinal) {
        setVoiceTranscript("");
        const p = parseVoice(text);
        if (p) {
          handleMoveRef.current?.(p.from, p.to);
          toast({ title: `Voice move: ${p.from.toUpperCase()} → ${p.to.toUpperCase()}` });
        }
      }
    };
    r.onerror = (e: any) => {
      const msg = e.error === "not-allowed" ? "Microphone permission denied" : "Voice error — try again";
      toast({ title: msg, variant: "destructive" });
      setVoiceActive(false);
      recognitionRef.current = null;
    };
    r.onend = () => {
      if (recognitionRef.current === r) {
        try { r.start(); } catch (_) {}
      }
    };
    r.start();
    recognitionRef.current = r;
    setVoiceActive(true);
    toast({ title: "Voice active 🎙️", description: "Say \"e2 to e4\" to move" });
  };
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  if (loading || !gameState) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>;

  // ── Setup screen ────────────────────────────────────────────────────────────

  if (!gameStarted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 overflow-auto">
        <button onClick={() => setLocation("/lobby")} className="self-start flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to lobby
        </button>
        <div className="text-center space-y-2">
          <img src="/icon.png" alt="Smart Chess Board" className="w-20 h-20 rounded-2xl mx-auto mb-2 object-cover" />
          <h1 className="text-3xl font-bold">Play vs Stockfish</h1>
          <p className="text-muted-foreground text-sm">Choose your settings and start playing</p>
        </div>
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            <Select value={difficulty.label} onValueChange={(v) => setDifficulty(DIFFICULTIES.find(d => d.label === v) || DIFFICULTIES[2])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map(d => <SelectItem key={d.label} value={d.label}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Play as</label>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-16 flex flex-col gap-1" onClick={() => startNewGame("w")}>
                <span className="text-3xl">♙</span><span className="text-xs">White</span>
              </Button>
              <Button variant="outline" className="h-16 flex flex-col gap-1" onClick={() => startNewGame("b")}>
                <span className="text-3xl">♟</span><span className="text-xs">Black</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Game screen ─────────────────────────────────────────────────────────────

  const chess = new Chess(gameState.fen);
  const isPlayerTurn = chess.turn() === playerColor && !gameState.isGameOver;
  const gameOver = gameState.isCheckmate || gameState.isDraw || gameState.isStalemate;
  const iWon = gameState.isCheckmate && !isPlayerTurn;
  const aiColor = playerColor === "w" ? "Black" : "White";
  const myColor = playerColor === "w" ? "White" : "Black";

  const statusText = gameState.isCheckmate
    ? (iWon ? "You won! 🎉" : "Checkmate")
    : gameState.isDraw ? "Draw"
    : gameState.isCheck ? "Check!"
    : aiThinking ? "AI thinking..."
    : isPlayerTurn ? "Your turn"
    : "";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">

      {/* ── Top bar: opponent ── */}
      <div className="h-14 shrink-0 flex items-center px-3 gap-3 bg-card border-b border-border">
        <button onClick={() => setGameStarted(false)} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-bold text-sm leading-tight">Stockfish</span>
          <span className="text-xs text-muted-foreground leading-tight">{difficulty.label} · {aiColor}</span>
        </div>
        {aiThinking && <Badge variant="secondary" className="animate-pulse text-xs shrink-0">Thinking…</Badge>}
        {gameOver && (
          <Badge variant={iWon ? "default" : "destructive"} className="shrink-0">
            {gameState.isCheckmate ? (iWon ? "You won" : "You lost") : "Draw"}
          </Badge>
        )}
      </div>

      {/* ── Board fills remaining space ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-1 bg-background">
        <div className="h-full aspect-square max-w-full">
          <ChessBoard
            fen={gameState.fen}
            onMove={handleMove}
            disabled={!isPlayerTurn || moving || aiThinking}
            lastMove={gameState.lastMove}
            theme={theme}
          />
        </div>
      </div>

      {/* ── Voice transcript ── */}
      {voiceActive && voiceTranscript && (
        <div className="shrink-0 bg-primary/10 border-t border-primary/20 px-4 py-1.5 flex items-center gap-2 text-sm text-primary">
          <Mic className="w-3 h-3 animate-pulse shrink-0" />
          <span className="italic truncate">"{voiceTranscript}"</span>
        </div>
      )}

      {/* ── Bottom bar: me + controls ── */}
      <div className="shrink-0 bg-card border-t border-border">
        <div className="h-14 flex items-center px-3 gap-3">
          <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary text-sm shrink-0">
            {(user?.username || "Y").charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-bold text-sm leading-tight">{user?.username || "You"}</span>
            <span className="text-xs text-muted-foreground leading-tight">{myColor}</span>
          </div>
          {statusText && <Badge variant={gameState.isCheck && !gameOver ? "destructive" : isPlayerTurn ? "default" : "secondary"} className="shrink-0 text-xs">{statusText}</Badge>}

          {/* Controls */}
          <div className="flex items-center gap-1 ml-1">
            {!gameOver && (
              <>
                <button onClick={handleUndo} disabled={moveHistory.length === 0 || aiThinking || moving}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-40 transition-colors" title="Undo">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={() => setGameStarted(false)}
                  className="p-2 rounded-lg hover:bg-muted text-destructive transition-colors" title="Resign">
                  <Flag className="w-4 h-4" />
                </button>
                <button onClick={toggleVoice}
                  className={`p-2 rounded-lg transition-colors ${voiceActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Voice">
                  {voiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button onClick={() => setCameraOpen(v => !v)}
                  className={`p-2 rounded-lg transition-colors ${cameraOpen ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Hand camera">
                  <Camera className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={() => setShowMoves(v => !v)}
              className={`p-2 rounded-lg transition-colors ${showMoves ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Move list">
              <List className="w-4 h-4" />
            </button>
            {gameOver && (
              <Button size="sm" className="ml-1" onClick={() => startNewGame(playerColor)}>Again</Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Camera popup ── */}
      {cameraOpen && (
        <DraggableCameraPopup
          onSquareSelect={handleCameraSquare}
          flipped={false}
          handActive={handActive}
          onHoverChange={setHoveredSqFromCamera}
          onClose={() => setCameraOpen(false)}
          hoveredSq={hoveredSqFromCamera}
        />
      )}

      {/* ── Move list overlay ── */}
      {showMoves && (
        <div className="absolute bottom-[57px] right-0 w-64 max-h-72 bg-card border border-border rounded-tl-xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-sm font-bold">Moves ({Math.ceil(moveHistory.length / 2)})</span>
            <button onClick={() => setShowMoves(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="overflow-auto p-2 text-sm font-mono" ref={moveListRef}>
            {moveHistory.length === 0 ? (
              <div className="text-muted-foreground text-xs text-center py-4">No moves yet</div>
            ) : (
              Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                <div key={i} className="flex gap-1 px-1 py-0.5 hover:bg-muted/50 rounded text-xs">
                  <span className="w-6 text-muted-foreground text-right">{i + 1}.</span>
                  <span className="flex-1 font-medium">{moveHistory[i * 2]?.san}</span>
                  <span className="flex-1 text-muted-foreground">{moveHistory[i * 2 + 1]?.san || ""}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
