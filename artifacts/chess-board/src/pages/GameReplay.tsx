import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useUser, useAuth } from "@clerk/react";
import { Chess } from "chess.js";
import { useQuery } from "@tanstack/react-query";
import { ChessBoard } from "@/components/ChessBoard";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getCountryByCode } from "@/lib/countries";
import { useProfiles } from "@/hooks/use-profile";
import { useSettings } from "@/hooks/use-settings";
import type { UserProfile } from "@/hooks/use-profile";
import type { GameState } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  Trophy,
  Minus,
  Skull,
  Loader2,
  Volume2,
  VolumeX,
  Zap,
  Star,
  CheckCircle2,
  ThumbsUp,
  HelpCircle,
  AlertTriangle,
  BookOpen,
  TrendingUp,
} from "lucide-react";

interface GameData {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  pgn: string;
  fen: string;
  winner: string | null;
  status: string;
  updatedAt: string;
}

interface AnalysisResult {
  bestMove: string;
  bestMoveSan: string;
  evaluation: string;
  evaluationScore: number;
  depth: number;
  topMoves: Array<{ move: string; san: string; evaluation: string }>;
  moveQuality?: string;
  suggestion?: string;
  isMate: boolean;
  mateIn?: number;
}

const QUALITY_CONFIG: Record<string, {
  label: string;
  symbol: string;
  color: string;
  bg: string;
  border: string;
  textColor: string;
  icon: React.ElementType;
}> = {
  brilliant: {
    label: "Brilliant",
    symbol: "!!",
    color: "#1baca6",
    bg: "bg-[#1baca6]/20",
    border: "border-[#1baca6]/50",
    textColor: "text-[#1baca6]",
    icon: Zap,
  },
  great: {
    label: "Great Move",
    symbol: "!",
    color: "#5c8bb0",
    bg: "bg-[#5c8bb0]/20",
    border: "border-[#5c8bb0]/50",
    textColor: "text-[#5c8bb0]",
    icon: Star,
  },
  best: {
    label: "Best",
    symbol: "✓",
    color: "#6fad6f",
    bg: "bg-[#6fad6f]/20",
    border: "border-[#6fad6f]/50",
    textColor: "text-[#6fad6f]",
    icon: CheckCircle2,
  },
  excellent: {
    label: "Excellent",
    symbol: "✓",
    color: "#6fad6f",
    bg: "bg-[#6fad6f]/15",
    border: "border-[#6fad6f]/40",
    textColor: "text-[#6fad6f]",
    icon: CheckCircle2,
  },
  good: {
    label: "Good",
    symbol: "",
    color: "#9fbf9f",
    bg: "bg-[#9fbf9f]/15",
    border: "border-[#9fbf9f]/40",
    textColor: "text-[#9fbf9f]",
    icon: ThumbsUp,
  },
  book: {
    label: "Book",
    symbol: "",
    color: "#a88b6c",
    bg: "bg-[#a88b6c]/15",
    border: "border-[#a88b6c]/40",
    textColor: "text-[#a88b6c]",
    icon: BookOpen,
  },
  inaccuracy: {
    label: "Inaccuracy",
    symbol: "?!",
    color: "#f0c14b",
    bg: "bg-[#f0c14b]/15",
    border: "border-[#f0c14b]/40",
    textColor: "text-[#f0c14b]",
    icon: HelpCircle,
  },
  mistake: {
    label: "Mistake",
    symbol: "?",
    color: "#e8783c",
    bg: "bg-[#e8783c]/15",
    border: "border-[#e8783c]/40",
    textColor: "text-[#e8783c]",
    icon: AlertTriangle,
  },
  blunder: {
    label: "Blunder",
    symbol: "??",
    color: "#e74c3c",
    bg: "bg-[#e74c3c]/15",
    border: "border-[#e74c3c]/40",
    textColor: "text-[#e74c3c]",
    icon: AlertTriangle,
  },
};

function useGameData(gameId: string) {
  const { getToken } = useAuth();
  return useQuery<GameData>({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`/api/games/${gameId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Game not found");
      return res.json();
    },
  });
}

function buildPositions(pgn: string): string[] {
  const start = new Chess();
  const positions: string[] = [start.fen()];
  if (!pgn) return positions;
  try {
    const replay = new Chess();
    replay.loadPgn(pgn);
    const history = replay.history({ verbose: true });
    const c2 = new Chess();
    for (const move of history) {
      c2.move(move.san);
      positions.push(c2.fen());
    }
  } catch { /* ignore */ }
  return positions;
}

function buildMoves(pgn: string): string[] {
  try {
    const replay = new Chess();
    replay.loadPgn(pgn);
    return replay.history();
  } catch {
    return [];
  }
}

function buildGameState(fen: string, prevFen?: string): GameState {
  const chess = new Chess(fen);
  let lastMove: { from: string; to: string } | null = null;
  if (prevFen) {
    try {
      const curr = new Chess(fen);
      const currHistory = curr.history({ verbose: true });
      if (currHistory.length > 0) {
        const last = currHistory[currHistory.length - 1];
        if (last) lastMove = { from: last.from, to: last.to };
      }
    } catch { /* ignore */ }
  }
  const history = chess.history({ verbose: true });
  const moveHistory = history.map((m, i) => ({
    from: m.from, to: m.to, san: m.san, piece: m.piece,
    color: m.color as "w" | "b", captured: m.captured ?? null,
    promotion: m.promotion ?? null, moveNumber: Math.floor(i / 2) + 1,
  }));
  return {
    fen, turn: chess.turn() as "w" | "b", moveHistory,
    capturedPieces: { white: [], black: [] },
    isCheck: chess.inCheck(), isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(), isStalemate: chess.isStalemate(),
    isGameOver: chess.isGameOver(), lastMove, arduinoConnected: false,
  };
}

function describeEval(analysis: AnalysisResult): string {
  if (analysis.isMate && analysis.mateIn != null) {
    const side = analysis.mateIn > 0 ? "White" : "Black";
    return `${side} has a forced checkmate in ${Math.abs(analysis.mateIn)} move${Math.abs(analysis.mateIn) === 1 ? "" : "s"}.`;
  }
  const score = analysis.evaluationScore / 100;
  const abs = Math.abs(score);
  const side = score >= 0 ? "White" : "Black";
  if (abs < 0.15) return "The position is completely equal.";
  if (abs < 0.5) return `${side} has a slight edge.`;
  if (abs < 1.2) return `${side} has a clear advantage.`;
  if (abs < 2.5) return `${side} has a significant advantage.`;
  return `${side} is winning.`;
}


function EvalBar({ evaluationScore, isMate, mateIn, evaluation }: {
  evaluationScore?: number; isMate?: boolean; mateIn?: number; evaluation?: string;
}) {
  let whitePercent = 50;
  if (isMate && mateIn != null) {
    whitePercent = mateIn > 0 ? 95 : 5;
  } else if (evaluationScore !== undefined) {
    const clamped = Math.max(-10, Math.min(10, evaluationScore / 100));
    whitePercent = 50 + (clamped / 10) * 45;
  }
  const label = evaluation ?? "0.0";

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="w-3 rounded-sm overflow-hidden border border-white/10 flex flex-col" style={{ height: 480 }}>
        <div
          className="bg-[#1a1a1a] transition-all duration-700 ease-in-out"
          style={{ height: `${100 - whitePercent}%` }}
        />
        <div className="bg-[#f0f0f0] transition-all duration-700 ease-in-out flex-1" />
      </div>
      <span className="text-[9px] text-zinc-500 font-mono">{label}</span>
    </div>
  );
}

export default function GameReplayPage({ gameId }: { gameId: string }) {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  const [, navigate] = useLocation();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { settings, boardThemeObj } = useSettings();
  const { data: game, isLoading } = useGameData(gameId);
  const [stepIdx, setStepIdx] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const moveListRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      } catch { /* ignore */ }
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return;
    try {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    } catch { /* ignore */ }
  }, [soundEnabled]);

  const positions = useMemo(() => (game?.pgn ? buildPositions(game.pgn) : []), [game?.pgn]);
  const moves = useMemo(() => (game?.pgn ? buildMoves(game.pgn) : []), [game?.pgn]);

  const currentFen = positions[stepIdx] ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const prevFen = stepIdx > 0 ? positions[stepIdx - 1] : undefined;

  const externalGameState = useMemo(
    () => buildGameState(currentFen, prevFen),
    [currentFen, prevFen]
  );

  const playerIds = [game?.whitePlayerId, game?.blackPlayerId].filter(Boolean) as string[];
  const { data: profiles } = useProfiles(playerIds);
  const profileMap = useMemo(
    () => Object.fromEntries((profiles ?? []).map((p) => [p.userId, p])),
    [profiles]
  );

  const whiteProfile = game ? profileMap[game.whitePlayerId] : undefined;
  const blackProfile = game?.blackPlayerId ? profileMap[game.blackPlayerId] : undefined;

  const speak = useCallback((text: string) => {
    if (!voiceEnabled) return;
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    utt.pitch = 1;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  }, [voiceEnabled]);

  const analyzePosition = useCallback(async (fen: string) => {
    if (analysisAbortRef.current) analysisAbortRef.current.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/analyze", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fen, depth: 15 }),
      });
      if (res.ok) {
        const data: AnalysisResult = await res.json();
        setAnalysis(data);
        playChime();
        const textToSpeak = data.suggestion ?? describeEval(data);
        speak(textToSpeak);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
    } finally {
      setAnalyzing(false);
    }
  }, [getToken, speak, playChime]);

  useEffect(() => {
    if (positions.length > 0) setStepIdx(positions.length - 1);
  }, [positions.length]);

  useEffect(() => {
    if (!currentFen) return;
    const timer = setTimeout(() => { analyzePosition(currentFen); }, 400);
    return () => clearTimeout(timer);
  }, [currentFen, analyzePosition]);

  useEffect(() => {
    const unlock = () => {
      ensureAudioCtx();
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
    };
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("touchstart", unlock, true);
    return () => {
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
    };
  }, [ensureAudioCtx]);

  useEffect(() => {
    return () => {
      if (analysisAbortRef.current) analysisAbortRef.current.abort();
      audioCtxRef.current?.close().catch(() => {});
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!moveListRef.current) return;
    const active = moveListRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [stepIdx]);

  const isWhite = user?.id === game?.whitePlayerId;

  const pairMoves = () => {
    const pairs: { num: number; white?: string; black?: string; wIdx: number; bIdx: number }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({ num: Math.floor(i / 2) + 1, white: moves[i], black: moves[i + 1], wIdx: i + 1, bIdx: i + 2 });
    }
    return pairs;
  };

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      ensureAudioCtx();
      if (e.key === "ArrowLeft") setStepIdx((s) => Math.max(0, s - 1));
      if (e.key === "ArrowRight") setStepIdx((s) => Math.min(positions.length - 1, s + 1));
    }
  }, [positions.length, ensureAudioCtx]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#769656]" />
          <span className="text-sm">Loading game…</span>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center gap-4 text-zinc-400">
        <p>Game not found.</p>
        <button onClick={() => navigate("/history")} className="text-sm underline text-[#769656]">Back to history</button>
      </div>
    );
  }

  const myResult =
    game.winner === "draw" ? "draw"
    : (game.winner === "white" && isWhite) || (game.winner === "black" && !isWhite) ? "win"
    : "loss";

  const resultConfig = {
    win: { label: "Victory", icon: Trophy, color: "text-[#769656]", bg: "bg-[#769656]/10 border-[#769656]/30" },
    loss: { label: "Defeat", icon: Skull, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
    draw: { label: "Draw", icon: Minus, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  }[myResult];

  const ResultIcon = resultConfig.icon;

  const evalLabel = analysis
    ? analysis.isMate && analysis.mateIn != null
      ? `M${Math.abs(analysis.mateIn)}`
      : analysis.evaluation
    : null;

  const evalScore = analysis?.evaluationScore ?? 0;
  const evalColor = analysis
    ? analysis.isMate
      ? "text-yellow-400"
      : evalScore >= 50 ? "text-[#769656]"
      : evalScore <= -50 ? "text-red-400"
      : "text-zinc-300"
    : "text-zinc-500";

  const qualityKey = analysis?.moveQuality as keyof typeof QUALITY_CONFIG | undefined;
  const quality = qualityKey ? QUALITY_CONFIG[qualityKey] : null;
  const QualityIcon = quality?.icon;

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-zinc-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 bg-[#161616] px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/history")}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
        >
          <ArrowLeft size={15} />
          History
        </button>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${resultConfig.bg} ${resultConfig.color}`}>
          <ResultIcon size={14} />
          {resultConfig.label}
        </div>

        <span className="text-zinc-600 text-sm">
          {new Date(game.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setSoundEnabled((v) => !v); }}
            title={soundEnabled ? "Mute chime" : "Enable chime"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              soundEnabled ? "bg-[#769656]/15 border-[#769656]/40 text-[#769656]" : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            Sound
          </button>
          <button
            onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); if (!next) window.speechSynthesis?.cancel(); }}
            title={voiceEnabled ? "Mute commentary" : "Enable commentary"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              voiceEnabled ? "bg-[#769656]/15 border-[#769656]/40 text-[#769656]" : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            {voiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            Voice
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Board Column */}
        <div className="flex flex-col items-center justify-center gap-2 p-4 lg:p-6 flex-shrink-0">
          <PlayerRow profile={blackProfile} color="black" />

          <div className="flex items-start gap-2">
            <EvalBar
              evaluationScore={analysis?.evaluationScore}
              isMate={analysis?.isMate}
              mateIn={analysis?.mateIn}
              evaluation={analysis?.evaluation}
            />
            <div className="relative" style={{ width: "min(480px, 90vw)", aspectRatio: "1" }}>
              <ChessBoard
                theme={boardThemeObj}
                pieceSet={settings.pieceSet}
                mouseEnabled={false}
                externalGameState={externalGameState}
              />
            </div>
          </div>

          <PlayerRow profile={whiteProfile} color="white" />

          {/* Navigation controls */}
          <div className="flex items-center gap-1.5 mt-1" onClick={ensureAudioCtx}>
            <NavBtn onClick={() => setStepIdx(0)} disabled={stepIdx === 0 || analyzing} title="Start">
              <ChevronsLeft size={16} />
            </NavBtn>
            <NavBtn onClick={() => setStepIdx((s) => Math.max(0, s - 1))} disabled={stepIdx === 0 || analyzing} title="Prev">
              <ArrowLeft size={16} />
            </NavBtn>
            <div className="px-4 py-2 min-w-[90px] text-center text-xs text-zinc-500 bg-zinc-800/60 rounded-lg border border-zinc-700/50">
              {analyzing ? (
                <span className="flex items-center justify-center gap-1 text-[#769656]">
                  <Loader2 size={10} className="animate-spin" /> Analyzing
                </span>
              ) : stepIdx === 0 ? "Start" : `${stepIdx} / ${moves.length}`}
            </div>
            <NavBtn
              onClick={() => setStepIdx((s) => Math.min(positions.length - 1, s + 1))}
              disabled={stepIdx === positions.length - 1 || analyzing}
              title="Next"
            >
              <ArrowRight size={16} />
            </NavBtn>
            <NavBtn
              onClick={() => setStepIdx(positions.length - 1)}
              disabled={stepIdx === positions.length - 1 || analyzing}
              title="End"
            >
              <ChevronsRight size={16} />
            </NavBtn>
          </div>
          <p className="text-[10px] text-zinc-600">Use ← → arrow keys to navigate</p>
        </div>

        {/* Review Panel */}
        <div className="flex-1 flex flex-col bg-[#161616] border-l border-white/8 min-w-0 max-w-full lg:max-w-[360px]">

          {/* Game Review Header */}
          <div className="px-5 py-4 border-b border-white/8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-[#769656]" />
                <h2 className="text-sm font-bold text-zinc-200 tracking-wide uppercase">Game Review</h2>
              </div>
              {analyzing && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Loader2 size={10} className="animate-spin" />
                  Analyzing…
                </div>
              )}
            </div>
          </div>

          {/* Analysis Content */}
          <div className="flex-1 overflow-y-auto">
            {analysis ? (
              <div className="animate-in fade-in duration-300">
                {/* Eval headline */}
                <div className="px-5 py-4 border-b border-white/6">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-base font-bold leading-snug ${evalColor}`}>
                      {analysis.isMate && analysis.mateIn != null
                        ? `Checkmate in ${Math.abs(analysis.mateIn)}`
                        : describeEval(analysis)}
                    </span>
                    <span className={`text-sm font-mono font-bold px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 ${evalColor}`}>
                      {evalLabel}
                    </span>
                  </div>

                  {/* Move quality badge */}
                  {quality && QualityIcon && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${quality.bg} ${quality.border} mt-2`}>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${quality.color}25` }}
                      >
                        <QualityIcon size={14} style={{ color: quality.color }} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-bold ${quality.textColor}`}>
                          {quality.label}
                          {quality.symbol && <span className="ml-1 opacity-80">{quality.symbol}</span>}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Best move + suggestion */}
                <div className="px-5 py-4 border-b border-white/6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-20 shrink-0">Best move</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-100 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-lg text-sm">
                        {analysis.bestMoveSan}
                      </span>
                      <span className="text-[10px] text-zinc-600">depth {analysis.depth}</span>
                    </div>
                  </div>

                  {analysis.suggestion && (
                    <div className="flex gap-2 items-start">
                      <div className="w-1 self-stretch rounded-full bg-[#769656]/50 shrink-0" />
                      <p className="text-xs text-zinc-400 leading-relaxed italic">{analysis.suggestion}</p>
                    </div>
                  )}
                </div>

                {/* Top moves */}
                {analysis.topMoves.length > 0 && (
                  <div className="px-5 py-4 border-b border-white/6">
                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-3">Top Moves</div>
                    <div className="space-y-1.5">
                      {analysis.topMoves.slice(0, 3).map((move, i) => {
                        const isPositive = move.evaluation.startsWith("+");
                        const isNegative = move.evaluation.startsWith("-");
                        const scoreColor = isPositive ? "text-[#769656]" : isNegative ? "text-red-400" : "text-yellow-400";
                        return (
                          <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-zinc-800/60 transition-colors">
                            <span className="text-zinc-600 text-xs w-4 font-mono text-right shrink-0">{i + 1}.</span>
                            <span className="font-mono font-bold text-zinc-100 text-sm flex-1">{move.san}</span>
                            <span className={`font-mono text-xs font-semibold ${scoreColor}`}>{move.evaluation}</span>
                            {i === 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#769656]/20 text-[#769656] font-semibold uppercase tracking-wide">best</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : analyzing ? (
              <div className="px-5 py-8 flex flex-col items-center gap-3 text-zinc-500">
                <div className="w-10 h-10 rounded-full border-2 border-[#769656]/30 border-t-[#769656] animate-spin" />
                <span className="text-xs">Calculating best moves…</span>
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-xs text-zinc-600">Navigate to a move to see analysis.</p>
              </div>
            )}

            {/* Move list */}
            <div className="px-5 py-4">
              <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-3">Move List</div>
              <div ref={moveListRef} className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
                {pairMoves().map((pair) => (
                  <div key={pair.num} className="flex items-center gap-1 text-sm font-mono">
                    <span className="text-zinc-600 text-xs w-7 text-right shrink-0 pr-1">{pair.num}.</span>
                    <button
                      data-active={stepIdx === pair.wIdx}
                      onClick={() => setStepIdx(pair.wIdx)}
                      className={`flex-1 text-left px-2 py-1 rounded transition-colors ${
                        stepIdx === pair.wIdx
                          ? "bg-[#769656] text-white font-bold"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {pair.white ?? ""}
                    </button>
                    <button
                      data-active={stepIdx === pair.bIdx}
                      onClick={() => pair.black !== undefined && setStepIdx(pair.bIdx)}
                      className={`flex-1 text-left px-2 py-1 rounded transition-colors ${
                        stepIdx === pair.bIdx
                          ? "bg-[#769656] text-white font-bold"
                          : "text-zinc-400 hover:bg-zinc-800"
                      } ${!pair.black ? "opacity-0 pointer-events-none" : ""}`}
                    >
                      {pair.black ?? ""}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PlayerRow({ profile, color }: { profile?: UserProfile; color: "white" | "black" }) {
  const country = profile ? getCountryByCode(profile.country) : undefined;
  return (
    <div className="flex items-center gap-2" style={{ width: "min(480px, 90vw)" }}>
      <div className={`w-4 h-4 rounded-sm border ${color === "white" ? "bg-zinc-100 border-zinc-300" : "bg-zinc-800 border-zinc-600"} shrink-0`} />
      <PlayerAvatar profile={profile} size="sm" showFlag={false} />
      <span className="text-sm font-semibold text-zinc-200 truncate">
        {country?.flag} {profile?.nickname ?? (color === "white" ? "White" : "Black")}
      </span>
    </div>
  );
}

function NavBtn({ children, onClick, disabled, title }: {
  children: React.ReactNode; onClick: () => void; disabled: boolean; title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
