import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { ArrowLeft, Flag, RotateCcw, Mic, MicOff, Bot, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Difficulty settings ───────────────────────────────────────────────────────

const DIFFICULTIES = [
  { label: "Beginner",     depth: 1,  color: "text-green-400" },
  { label: "Easy",         depth: 3,  color: "text-green-500" },
  { label: "Intermediate", depth: 6,  color: "text-yellow-400" },
  { label: "Hard",         depth: 10, color: "text-orange-400" },
  { label: "Expert",       depth: 14, color: "text-red-400" },
  { label: "Master",       depth: 18, color: "text-purple-400" },
];

// ── Piece symbols ─────────────────────────────────────────────────────────────

const PIECE_SYMBOLS: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

// ── Chess board ───────────────────────────────────────────────────────────────

function ChessBoard({
  fen,
  onMove,
  disabled,
  lastMove,
}: {
  fen: string;
  onMove: (from: string, to: string, promotion?: string) => void;
  disabled: boolean;
  lastMove: { from: string; to: string } | null;
}) {
  const chess = new Chess(fen);
  const board = chess.board();
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);

  const handleClick = (sq: string) => {
    if (disabled || promotionPending) return;

    if (selected) {
      if (legalTargets.includes(sq)) {
        // Check if promotion
        const piece = chess.get(selected as any);
        const isPromotion =
          piece?.type === "p" &&
          ((piece.color === "w" && sq[1] === "8") || (piece.color === "b" && sq[1] === "1"));

        if (isPromotion) {
          setPromotionPending({ from: selected, to: sq });
          setSelected(null);
          setLegalTargets([]);
        } else {
          onMove(selected, sq);
          setSelected(null);
          setLegalTargets([]);
        }
      } else {
        const piece = chess.get(sq as any);
        if (piece && piece.color === chess.turn()) {
          setSelected(sq);
          const moves = chess.moves({ square: sq as any, verbose: true });
          setLegalTargets(moves.map((m: any) => m.to));
        } else {
          setSelected(null);
          setLegalTargets([]);
        }
      }
    } else {
      const piece = chess.get(sq as any);
      if (piece && piece.color === chess.turn()) {
        setSelected(sq);
        const moves = chess.moves({ square: sq as any, verbose: true });
        setLegalTargets(moves.map((m: any) => m.to));
      }
    }
  };

  return (
    <div className="relative w-full aspect-square">
      {/* Promotion dialog */}
      {promotionPending && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center rounded">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3">
            <p className="text-sm font-medium">Choose promotion piece</p>
            <div className="flex gap-3">
              {["q", "r", "b", "n"].map((p) => {
                const sym = chess.turn() === "w" ? p.toUpperCase() : p;
                return (
                  <button
                    key={p}
                    className="w-14 h-14 text-4xl bg-muted hover:bg-primary/20 rounded-lg transition-colors"
                    onClick={() => {
                      onMove(promotionPending.from, promotionPending.to, p);
                      setPromotionPending(null);
                    }}
                  >
                    {PIECE_SYMBOLS[sym]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="w-full h-full flex flex-col border-2 border-border rounded overflow-hidden shadow-xl">
        {board.map((row, i) => (
          <div key={i} className="flex-1 flex">
            {row.map((square, j) => {
              const isLight = (i + j) % 2 === 0;
              const file = String.fromCharCode(97 + j);
              const rank = 8 - i;
              const sq = `${file}${rank}`;
              const isSelected = selected === sq;
              const isTarget = legalTargets.includes(sq);
              const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const pieceKey = square
                ? square.color === "w"
                  ? square.type.toUpperCase()
                  : square.type.toLowerCase()
                : null;

              return (
                <div
                  key={j}
                  onClick={() => handleClick(sq)}
                  className={`flex-1 flex items-center justify-center cursor-pointer relative select-none transition-colors
                    ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                    ${isSelected ? "!bg-yellow-400/80" : ""}
                    ${isLastMove && !isSelected ? "!bg-yellow-300/40" : ""}
                    ${isTarget && !square ? "after:absolute after:inset-[30%] after:rounded-full after:bg-black/20" : ""}
                    ${isTarget && square ? "!ring-2 !ring-inset !ring-yellow-400" : ""}`}
                >
                  {square && (
                    <span
                      className={`text-[clamp(1rem,5vw,3rem)] leading-none drop-shadow-md select-none
                        ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]"}`}
                    >
                      {pieceKey ? PIECE_SYMBOLS[pieceKey] : ""}
                    </span>
                  )}
                  {j === 0 && (
                    <span className={`absolute top-0.5 left-0.5 text-[10px] font-bold leading-none ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{rank}</span>
                  )}
                  {i === 7 && (
                    <span className={`absolute bottom-0.5 right-0.5 text-[10px] font-bold leading-none ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{file}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Voice command parser ──────────────────────────────────────────────────────

function parseVoiceCommand(text: string): { from: string; to: string } | null {
  const lower = text.toLowerCase().trim();
  const squarePair = lower.match(/([a-h][1-8])\s+(?:to\s+)?([a-h][1-8])/);
  if (squarePair) return { from: squarePair[1], to: squarePair[2] };
  return null;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(path: string, body?: any) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [gameState, setGameState] = useState<any>(null);
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[2]); // Intermediate default
  const [gameStarted, setGameStarted] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");

  const recognitionRef = useRef<any>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [stateRes, histRes] = await Promise.all([
        fetch("/api/game/state"),
        fetch("/api/game/history"),
      ]);
      const state = await stateRes.json();
      const hist = await histRes.json();
      setGameState(state);
      setMoveHistory(hist.moves || []);
    } catch {
      toast({ title: "Failed to load game state", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, []);

  // Scroll move list to bottom
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [moveHistory]);

  const triggerAiMove = useCallback(async () => {
    setAiThinking(true);
    try {
      const res = await apiPost("/api/game/ai-move", { depth: difficulty.depth });
      setGameState(res.gameState);
      await refresh();
    } catch (err: any) {
      toast({ title: err.message || "AI move failed", variant: "destructive" });
    } finally {
      setAiThinking(false);
    }
  }, [difficulty.depth, refresh]);

  const handleMove = useCallback(async (from: string, to: string, promotion?: string) => {
    if (moving || aiThinking) return;
    const state = gameState;
    if (!state || state.isGameOver) return;

    // Only allow move if it's the player's turn
    const chess = new Chess(state.fen);
    if (chess.turn() !== playerColor) return;

    setMoving(true);
    try {
      const moveStr = promotion ? `${from}${to}${promotion}` : `${from}${to}`;
      const res = await apiPost("/api/game/move", { move: moveStr, source: "ui" });
      setGameState(res.gameState);
      await refresh();

      // Trigger AI response if game not over
      if (!res.gameState.isGameOver) {
        setTimeout(triggerAiMove, 300);
      }
    } catch {
      toast({ title: "Invalid move", variant: "destructive" });
    } finally {
      setMoving(false);
    }
  }, [moving, aiThinking, gameState, playerColor, triggerAiMove, refresh]);

  const handleUndo = async () => {
    if (aiThinking || moving) return;
    try {
      // Undo player move
      await apiPost("/api/game/undo");
      // Undo AI move too if history has at least 2 moves
      const hist = await fetch("/api/game/history").then((r) => r.json());
      if (hist.moves.length >= 1) {
        await apiPost("/api/game/undo");
      }
      await refresh();
    } catch {
      toast({ title: "Cannot undo", variant: "destructive" });
    }
  };

  const startNewGame = async (color: "w" | "b") => {
    try {
      await apiPost("/api/game/reset");
      setPlayerColor(color);
      setGameStarted(true);
      await refresh();

      // If player chose black, AI makes first move
      if (color === "b") {
        setTimeout(triggerAiMove, 400);
      }
    } catch {
      toast({ title: "Failed to start game", variant: "destructive" });
    }
  };

  // ── Voice ───────────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice not supported in this browser", variant: "destructive" });
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
        const parsed = parseVoiceCommand(text);
        if (parsed) {
          handleMove(parsed.from, parsed.to);
          toast({ title: `Voice: ${text}`, description: `${parsed.from} → ${parsed.to}` });
        }
      }
    };
    r.onerror = () => { setVoiceActive(false); recognitionRef.current = null; };
    r.start();
    recognitionRef.current = r;
    setVoiceActive(true);
    toast({ title: "Voice on", description: "Say 'e2 to e4' to move" });
  };

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading || !gameState) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  // Pre-game setup screen
  if (!gameStarted) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[70vh] gap-8">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-10 h-10 text-purple-500" />
          </div>
          <h1 className="text-3xl font-bold">Play vs Stockfish</h1>
          <p className="text-muted-foreground">Configure your game before playing</p>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            <Select
              value={difficulty.label}
              onValueChange={(v) => setDifficulty(DIFFICULTIES.find((d) => d.label === v) || DIFFICULTIES[2])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d.label} value={d.label}>
                    <span className={d.color}>{d.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Play as</label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-16 flex flex-col gap-1 text-lg"
                onClick={() => startNewGame("w")}
              >
                <span className="text-3xl">♙</span>
                <span className="text-xs font-medium">White</span>
              </Button>
              <Button
                variant="outline"
                className="h-16 flex flex-col gap-1 text-lg"
                onClick={() => startNewGame("b")}
              >
                <span className="text-3xl">♟</span>
                <span className="text-xs font-medium">Black</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chess = new Chess(gameState.fen);
  const isPlayerTurn = chess.turn() === playerColor && !gameState.isGameOver;
  const isAiTurn = chess.turn() !== playerColor && !gameState.isGameOver;

  const statusText = gameState.isCheckmate
    ? (isPlayerTurn ? "Checkmate — You lost" : "Checkmate — You won! 🎉")
    : gameState.isDraw
    ? "Draw"
    : gameState.isCheck
    ? "Check!"
    : aiThinking
    ? "AI is thinking..."
    : isPlayerTurn
    ? "Your turn"
    : "AI thinking...";

  const statusVariant: any = gameState.isCheckmate
    ? "destructive"
    : gameState.isDraw
    ? "secondary"
    : gameState.isCheck
    ? "destructive"
    : isPlayerTurn
    ? "default"
    : "secondary";

  const aiPlayer = playerColor === "w" ? "Black" : "White";
  const humanPlayer = playerColor === "w" ? "White" : "Black";

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      {/* Board column */}
      <div className="flex flex-col items-center gap-3">
        {/* AI player row */}
        <div className="w-full flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-500/20 text-purple-500 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Stockfish</div>
              <div className="text-xs text-muted-foreground">{difficulty.label} · {aiPlayer}</div>
            </div>
          </div>
          {aiThinking && <Badge variant="secondary" className="animate-pulse">Thinking...</Badge>}
          {gameState.capturedPieces && (
            <div className="text-sm hidden sm:block">
              {playerColor === "w" ? gameState.capturedPieces.black?.join("") : gameState.capturedPieces.white?.join("")}
            </div>
          )}
        </div>

        <ChessBoard
          fen={gameState.fen}
          onMove={handleMove}
          disabled={!isPlayerTurn || moving || aiThinking}
          lastMove={gameState.lastMove}
        />

        {/* Voice transcript */}
        {voiceActive && voiceTranscript && (
          <div className="w-full bg-primary/10 border border-primary/20 rounded px-4 py-2 text-sm text-primary flex items-center gap-2">
            <Mic className="w-4 h-4 animate-pulse shrink-0" />
            <span className="italic truncate">"{voiceTranscript}"</span>
          </div>
        )}

        {/* Human player row */}
        <div className="w-full flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">
              {(user?.username || "Y").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm">{user?.username || "You"}</div>
              <div className="text-xs text-muted-foreground">{humanPlayer}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gameState.capturedPieces && (
              <div className="text-sm hidden sm:block">
                {playerColor === "w" ? gameState.capturedPieces.white?.join("") : gameState.capturedPieces.black?.join("")}
              </div>
            )}
            <Badge variant={statusVariant}>{statusText}</Badge>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-3">
        {/* Controls */}
        <Card className="bg-card border-border p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            Controls
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={moveHistory.length === 0 || aiThinking || moving}>
              <RotateCcw className="w-3 h-3 mr-1" /> Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { setGameStarted(false); }}
            >
              <Flag className="w-3 h-3 mr-1" /> Resign
            </Button>
            <Button
              variant={voiceActive ? "default" : "outline"}
              size="sm"
              className="col-span-2"
              onClick={toggleVoice}
            >
              {voiceActive ? <Mic className="w-3 h-3 mr-1" /> : <MicOff className="w-3 h-3 mr-1" />}
              {voiceActive ? "Voice On" : "Voice Off"}
            </Button>
          </div>
        </Card>

        {/* Game over card */}
        {(gameState.isCheckmate || gameState.isDraw || gameState.isStalemate) && (
          <Card className="bg-card border-border p-4 text-center space-y-3">
            <h3 className="font-bold text-lg">
              {gameState.isCheckmate
                ? (isPlayerTurn ? "You lost" : "You won! 🎉")
                : "Draw!"}
            </h3>
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={() => startNewGame(playerColor)}>
                Play Again
              </Button>
              <Button variant="outline" className="flex-1" size="sm" onClick={() => setGameStarted(false)}>
                New Setup
              </Button>
            </div>
          </Card>
        )}

        {/* Move history */}
        <Card className="bg-card border-border flex flex-col" style={{ flex: 1, minHeight: 0, maxHeight: "400px" }}>
          <div className="p-3 border-b border-border flex justify-between items-center shrink-0">
            <span className="font-bold text-sm">Move History</span>
            <span className="text-xs text-muted-foreground">{Math.ceil(moveHistory.length / 2)} moves</span>
          </div>
          <div className="flex-1 overflow-auto p-2" ref={moveListRef}>
            {moveHistory.length > 0 ? (
              <div className="text-sm font-mono space-y-0.5">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => {
                  const white = moveHistory[i * 2];
                  const black = moveHistory[i * 2 + 1];
                  return (
                    <div key={i} className="flex gap-1 px-1 py-0.5 rounded hover:bg-muted/50">
                      <span className="w-7 text-muted-foreground text-right">{i + 1}.</span>
                      <span className="flex-1 font-medium">{white?.san}</span>
                      <span className="flex-1 text-muted-foreground">{black?.san || ""}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Make your first move
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
