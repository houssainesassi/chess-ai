import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { Flag, RotateCcw, Mic, MicOff, Bot, List, X, ArrowLeft, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { usePreferences } from "@/hooks/use-preferences";
import { ChessBoard } from "@/components/chess-board";
import { CameraPopup } from "@/components/camera-overlay";
import { useMemeAudio, countMaterial } from "@/hooks/use-meme-audio";
import { SpeakerAnimation, MemeReactionToast, useMemeReaction } from "@/components/meme-reaction";
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
  const { theme, playMove, playCheck, playGameEnd, commentatorMode } = usePreferences();
  const { play: playMeme, isPlaying: memeIsPlaying } = useMemeAudio();
  const { reactionState, showReaction } = useMemeReaction();

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

  const recognitionRef = useRef<any>(null);
  const handleMoveRef = useRef<((from: string, to: string, promotion?: string) => void) | null>(null);
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
    // Snapshot player material BEFORE the AI moves (blunder detection)
    const matBefore = gameState ? countMaterial(gameState.fen, playerColor) : -1;
    setAiThinking(true);
    try {
      const res = await apiPost("/api/game/ai-move", { depth: difficulty.depth });
      setGameState(res.gameState);

      // ── Meme reactions for AI move result ──────────────────────────────────
      const matAfter = countMaterial(res.gameState.fen, playerColor);
      if (matBefore >= 0 && matBefore - matAfter >= 3) {
        // Player lost ≥3 material points → previous move was a blunder
        playMeme("blunder");
        if (commentatorMode) showReaction("blunder");
      } else if (res.gameState.isGameOver && res.gameState.isCheckmate) {
        // AI checkmated the player → player loses
        playMeme("checkmate");
        playMeme("lose");
        if (commentatorMode) showReaction("lose");
      } else if (res.gameState.isCheck) {
        playMeme("check");
        if (commentatorMode) showReaction("check");
      }
      // ──────────────────────────────────────────────────────────────────────

      if (res.gameState.isGameOver) playGameEnd(false);
      else if (res.gameState.isCheck) playCheck();
      else playMove(false);
      await refresh();
    } catch (err: any) {
      toast({ title: err.message || "AI move failed", variant: "destructive" });
    } finally { setAiThinking(false); }
  }, [difficulty.depth, gameState, playerColor, refresh, playMove, playCheck, playGameEnd, playMeme, commentatorMode, showReaction]);

  const handleMove = useCallback(async (from: string, to: string, promotion?: string) => {
    if (moving || aiThinking || !gameState) return;
    const chess = new Chess(gameState.fen);
    if (chess.turn() !== playerColor) return;

    // ── Pre-move meme detection ───────────────────────────────────────────────
    const targetPiece  = chess.get(to as any);
    const movingPiece  = chess.get(from as any);
    const isQueenCapture = !!targetPiece && targetPiece.type === "q";
    // Promotion: explicit promo param OR pawn reaching the last rank
    const isPromotion  = !!promotion || (
      movingPiece?.type === "p" && (to[1] === "8" || to[1] === "1")
    );
    const isCapture    = !!targetPiece;
    // ─────────────────────────────────────────────────────────────────────────

    setMoving(true);
    try {
      const res = await apiPost("/api/game/move", { move: promotion ? `${from}${to}${promotion}` : `${from}${to}`, source: "ui" });
      setGameState(res.gameState);

      // ── Meme reactions for player move result ─────────────────────────────
      if (isQueenCapture) {
        playMeme("queen-capture");
        if (commentatorMode) showReaction("queen-capture");
      } else if (isPromotion) {
        playMeme("promotion");
        if (commentatorMode) showReaction("promotion");
      } else if (res.gameState.isGameOver && res.gameState.isCheckmate) {
        // Player checkmated the AI → player wins
        playMeme("checkmate");
        playMeme("win");
        if (commentatorMode) showReaction("win");
      } else if (res.gameState.isCheck) {
        playMeme("check");
        if (commentatorMode) showReaction("check");
      }
      // ─────────────────────────────────────────────────────────────────────

      // Regular sound feedback (always plays regardless of meme mode)
      if (res.gameState.isGameOver) playGameEnd(res.gameState.isCheckmate && chess.turn() !== playerColor);
      else if (res.gameState.isCheck) playCheck();
      else playMove(isCapture);

      await refresh();
      if (!res.gameState.isGameOver) setTimeout(triggerAiMove, 300);
    } catch {
      // Invalid move
      playMeme("illegal-move");
      if (commentatorMode) showReaction("illegal-move");
      toast({ title: "Invalid move", variant: "destructive" });
    }
    finally { setMoving(false); }
  }, [moving, aiThinking, gameState, playerColor, triggerAiMove, refresh, playMove, playCheck, playGameEnd, playMeme, commentatorMode, showReaction]);

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

  const handleCameraMove = useCallback((uciMove: string, _source: "hand" | "eye") => {
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promo = uciMove.length > 4 ? uciMove[4] : undefined;
    handleMoveRef.current?.(from, to, promo);
  }, []);

  const isCameraMoveLocked = useCallback(() => {
    return moving || aiThinking || !gameState;
  }, [moving, aiThinking, gameState]);

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

  // Shared player/opponent cards + controls (used in both mobile and desktop sidebar)
  const OpponentCard = (
    <div className="flex items-center gap-3 px-3 h-14 shrink-0">
      <button onClick={() => setGameStarted(false)} className="text-muted-foreground hover:text-foreground transition-colors mr-1 shrink-0">
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
  );

  const ControlButtons = (
    <div className="flex items-center gap-1">
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
            className={`p-2 rounded-lg transition-colors ${voiceActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Voice control">
            {voiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
          <button onClick={() => setCameraOpen(v => !v)}
            className={`p-2 rounded-lg transition-colors ${cameraOpen ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Hand/eye camera">
            <Camera className="w-4 h-4" />
          </button>
        </>
      )}
      {gameOver && (
        <Button size="sm" onClick={() => startNewGame(playerColor)}>Play Again</Button>
      )}
    </div>
  );

  const MovesList = (
    <div className="overflow-auto p-2 font-mono" ref={moveListRef}>
      {moveHistory.length === 0 ? (
        <div className="text-muted-foreground text-xs text-center py-6">No moves yet</div>
      ) : (
        Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
          <div key={i} className="flex gap-1 px-1 py-0.5 hover:bg-muted/50 rounded text-xs">
            <span className="w-6 text-muted-foreground text-right shrink-0">{i + 1}.</span>
            <span className="flex-1 font-medium">{moveHistory[i * 2]?.san}</span>
            <span className="flex-1 text-muted-foreground">{moveHistory[i * 2 + 1]?.san || ""}</span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">

      {/* ════════════════════════════════════════════════════════════
          BOARD COLUMN — full width on mobile, fills height on desktop
          ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#1a1a1a] lg:bg-background">

        {/* Top bar: opponent — visible on mobile only */}
        <div className="lg:hidden border-b border-border bg-card shrink-0">
          {OpponentCard}
        </div>

        {/* Board: square, centred, fills remaining height */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-2 lg:p-4">
          <div
            className="relative"
            style={{ height: "min(100%, calc(100vw - 8px))", aspectRatio: "1 / 1", maxHeight: "min(calc(100vh - 130px), calc(100vw - 8px))" }}
          >
            <ChessBoard
              fen={gameState.fen}
              onMove={handleMove}
              disabled={!isPlayerTurn || moving || aiThinking}
              lastMove={gameState.lastMove}
              theme={theme}
            />
          </div>
        </div>

        {/* Voice transcript bar */}
        {voiceActive && voiceTranscript && (
          <div className="shrink-0 bg-primary/10 border-t border-primary/20 px-4 py-1.5 flex items-center gap-2 text-sm text-primary">
            <Mic className="w-3 h-3 animate-pulse shrink-0" />
            <span className="italic truncate">"{voiceTranscript}"</span>
          </div>
        )}

        {/* Bottom bar: me + controls — visible on mobile only */}
        <div className="lg:hidden shrink-0 bg-card border-t border-border">
          <div className="h-14 flex items-center px-3 gap-3">
            <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary text-sm shrink-0">
              {(user?.username || "Y").charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-bold text-sm leading-tight">{user?.username || "You"}</span>
              <span className="text-xs text-muted-foreground leading-tight">{myColor}</span>
            </div>
            {statusText && (
              <Badge variant={gameState.isCheck && !gameOver ? "destructive" : isPlayerTurn ? "default" : "secondary"} className="shrink-0 text-xs">
                {statusText}
              </Badge>
            )}
            <div className="flex items-center gap-1 ml-1">
              {ControlButtons}
              <button onClick={() => setShowMoves(v => !v)}
                className={`p-2 rounded-lg transition-colors ${showMoves ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          DESKTOP SIDEBAR — hidden on mobile, shown on lg+
          ════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 bg-card border-l border-border">

        {/* Opponent card */}
        <div className="border-b border-border shrink-0">
          {OpponentCard}
        </div>

        {/* Status badge */}
        {statusText && (
          <div className="px-3 py-2 border-b border-border shrink-0">
            <Badge
              variant={gameState.isCheck && !gameOver ? "destructive" : isPlayerTurn ? "default" : "secondary"}
              className="w-full justify-center text-sm py-1"
            >
              {statusText}
            </Badge>
          </div>
        )}

        {/* Move list — always open on desktop, scrollable */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-sm font-bold text-foreground">Moves</span>
            <span className="text-xs text-muted-foreground">{Math.ceil(moveHistory.length / 2)} turns</span>
          </div>
          <div className="flex-1 overflow-auto">
            {MovesList}
          </div>
        </div>

        {/* Voice transcript (desktop) */}
        {voiceActive && voiceTranscript && (
          <div className="shrink-0 bg-primary/10 border-t border-primary/20 px-3 py-2 flex items-center gap-2 text-sm text-primary">
            <Mic className="w-3 h-3 animate-pulse shrink-0" />
            <span className="italic truncate text-xs">"{voiceTranscript}"</span>
          </div>
        )}

        {/* My player card + controls */}
        <div className="border-t border-border shrink-0 p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary text-sm shrink-0">
              {(user?.username || "Y").charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-bold text-sm leading-tight">{user?.username || "You"}</span>
              <span className="text-xs text-muted-foreground leading-tight">{myColor}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ControlButtons}
          </div>
        </div>
      </div>

      {/* ── Camera popup ── */}
      {cameraOpen && gameState && (
        <CameraPopup
          currentFen={gameState.fen}
          onMove={handleCameraMove}
          isMoveLocked={isCameraMoveLocked}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* ── Move list overlay (mobile only, shown when toggled) ── */}
      {showMoves && (
        <div className="lg:hidden absolute bottom-[57px] right-0 w-64 max-h-72 bg-card border border-border rounded-tl-xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-sm font-bold">Moves ({Math.ceil(moveHistory.length / 2)})</span>
            <button onClick={() => setShowMoves(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          {MovesList}
        </div>
      )}

      {/* ── Meme Mode overlays ── */}
      <SpeakerAnimation isPlaying={memeIsPlaying} />
      <MemeReactionToast {...reactionState} />
    </div>
  );
}
