import { useEffect, useState, useRef, useCallback } from "react";
import { ChessBoard } from "@/components/ChessBoard";
import { Sidebar } from "@/components/Sidebar";
import { CameraInput } from "@/components/CameraInput";
import { HandCursorInput } from "@/components/HandCursorInput";
import { EyeTrackingInput } from "@/components/EyeTrackingInput";
import { VoiceInput } from "@/components/VoiceInput";
import { useGameSocket } from "@/hooks/use-socket";
import { useSharedMove } from "@/hooks/use-shared-move";
import { useGetGameState, useAnalyzePosition } from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react";
import { Maximize2, Minimize2, Mouse, Camera, Hand, Wifi, Eye, Mic } from "lucide-react";
import { DraggableCameraWindow } from "@/components/DraggableCameraWindow";
import { useSettings } from "@/hooks/use-settings";

import marzougiImg from "../../../../attached_assets/marzougi_1775833295771.jpg";
import houssaineImg from "../../../../attached_assets/houssaine_1775833295771.jpg";

export default function GamePage() {
  useGameSocket();

  const { data: gameState } = useGetGameState();
  const analyzePosition = useAnalyzePosition();
  const { submitMove, isLocked } = useSharedMove();

  const { settings, boardThemeObj } = useSettings();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showBestMove, setShowBestMove] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [mouseEnabled, setMouseEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [handEnabled, setHandEnabled] = useState(false);
  const [eyeEnabled, setEyeEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const [handHoveredSquare, setHandHoveredSquare] = useState<string | null>(null);
  const [handSelectedSquare, setHandSelectedSquare] = useState<string | null>(null);
  const [eyeHoveredSquare, setEyeHoveredSquare] = useState<string | null>(null);
  const [eyeSelectedSquare, setEyeSelectedSquare] = useState<string | null>(null);

  const prevFenRef = useRef<string | null>(null);
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleMove = useCallback(
    (uciMove: string, source: "mouse" | "camera" | "hand" | "eye" | "voice") => {
      submitMove(uciMove, source);
    },
    [submitMove]
  );

  const runAnalysis = useCallback(
    (fen: string, previousFen?: string, lastMove?: string) => {
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
      analyzeTimeoutRef.current = setTimeout(() => {
        setIsAnalyzing(true);
        analyzePosition.mutate(
          { data: { fen, depth: 15, previousFen: previousFen ?? null, lastMove: lastMove ?? null } },
          {
            onSuccess: (result: AnalysisResult) => { setAnalysis(result); setIsAnalyzing(false); },
            onError: () => setIsAnalyzing(false),
          }
        );
      }, 400);
    },
    [analyzePosition]
  );

  useEffect(() => {
    if (!gameState?.fen || !gameState?.moveHistory) return;
    const currentFen = gameState.fen;
    const previousFen = prevFenRef.current;
    if (currentFen === previousFen) return;
    const history = gameState.moveHistory;
    let lastMoveUci: string | undefined;
    if (history.length > 0) {
      const lm = history[history.length - 1];
      lastMoveUci = lm.from + lm.to + (lm.promotion ?? "");
    }
    runAnalysis(currentFen, previousFen ?? undefined, lastMoveUci);
    prevFenRef.current = currentFen;
  }, [gameState?.fen, gameState?.moveHistory, runAnalysis]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const currentFen = gameState?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const inputStatusBar = (
    <div className="flex items-center gap-1.5 px-1 py-1 bg-secondary/20 border border-border/40 rounded-xl flex-wrap">
      <button
        onClick={() => setMouseEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          mouseEnabled
            ? "bg-blue-500/20 border border-blue-500/50 text-blue-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Mouse size={12} />
        Mouse {mouseEnabled ? "Active" : "OFF"}
      </button>

      <button
        onClick={() => setCameraEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          cameraEnabled
            ? "bg-green-500/20 border border-green-500/50 text-green-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Camera size={12} />
        Camera {cameraEnabled ? "Active" : "OFF"}
      </button>

      <button
        onClick={() => setHandEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          handEnabled
            ? "bg-purple-500/20 border border-purple-500/50 text-purple-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Hand size={12} />
        Hand {handEnabled ? "Active" : "OFF"}
      </button>

      <button
        onClick={() => setEyeEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          eyeEnabled
            ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Eye size={12} />
        Eye {eyeEnabled ? "Active" : "OFF"}
      </button>

      <button
        onClick={() => setVoiceEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          voiceEnabled
            ? "bg-rose-500/20 border border-rose-500/50 text-rose-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Mic size={12} />
        Voice {voiceEnabled ? "Active" : "OFF"}
      </button>

      <div className="ml-auto flex items-center gap-1 px-2 py-1">
        <Wifi size={10} className="text-emerald-400" />
        <span className="text-[10px] text-emerald-400 font-semibold">Live Sync</span>
      </div>
    </div>
  );

  const boardArea = () => (
    <ChessBoard
      theme={boardThemeObj}
      pieceSet={settings.pieceSet}
      soundPack={settings.soundPack}
      showBestMove={showBestMove}
      bestMove={analysis?.bestMove}
      mouseEnabled={mouseEnabled}
      onMove={handleMove}
      handHoveredSquare={handEnabled ? handHoveredSquare : null}
      handSelectedSquare={handEnabled ? handSelectedSquare : null}
      eyeHoveredSquare={eyeEnabled ? eyeHoveredSquare : null}
      eyeSelectedSquare={eyeEnabled ? eyeSelectedSquare : null}
    />
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-secondary/80 hover:bg-secondary text-foreground px-3 py-2 rounded-full text-sm font-medium shadow-lg border border-border/50 transition-colors"
        >
          <Minimize2 size={16} />
          Exit Fullscreen
        </button>

        <div className="w-full h-full flex flex-col items-center justify-center p-2 gap-2">
          <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-full border border-border/50 shadow-md backdrop-blur-sm self-start ml-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 overflow-hidden bg-muted">
              <img src={marzougiImg} alt="Mohamed Marzougi" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold">Mohamed Marzougi</span>
              <span className="text-[10px] opacity-60">Black Pieces</span>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center" style={{ minHeight: 0 }}>
            <div className="aspect-square mx-auto" style={{ width: "min(100vw, calc(100vh - 180px))" }}>
              {boardArea()}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-full border border-border/50 shadow-md backdrop-blur-sm self-start ml-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 overflow-hidden bg-muted">
              <img src={houssaineImg} alt="Houssaine Sassi" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold">Houssaine Sassi</span>
              <span className="text-[10px] opacity-60">White Pieces</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 md:p-6 text-foreground">
      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-stretch">

        {/* Board area */}
        <div className="flex-1 w-full flex flex-col gap-3 justify-center min-w-0">

          {/* Top Player */}
          <div className="flex justify-between items-center px-1">
            <div className="font-semibold flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-full border border-border/50 shadow-md backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-muted">
                <img src={marzougiImg} alt="Mohamed Marzougi" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-bold">Mohamed Marzougi</span>
                <span className="text-[10px] opacity-60">Black Pieces</span>
              </div>
            </div>

            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1.5 bg-secondary/60 hover:bg-secondary text-foreground px-3 py-2 rounded-full text-xs font-medium shadow border border-border/50 transition-colors"
            >
              <Maximize2 size={14} />
              Fullscreen
            </button>
          </div>

          {boardArea()}

          {/* Bottom Player */}
          <div className="flex justify-between items-center px-1">
            <div className="font-semibold flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-full border border-border/50 shadow-md backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-muted">
                <img src={houssaineImg} alt="Houssaine Sassi" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-bold">Houssaine Sassi</span>
                <span className="text-[10px] opacity-60">White Pieces</span>
              </div>
            </div>
          </div>

          {inputStatusBar}

          {voiceEnabled && (
            <VoiceInput
              enabled={voiceEnabled}
              currentFen={currentFen}
              onMove={handleMove}
              isMoveLocked={isLocked}
            />
          )}
        </div>

        <Sidebar
          analysis={analysis}
          isAnalyzing={isAnalyzing}
          showBestMove={showBestMove}
          onToggleBestMove={() => setShowBestMove((v) => !v)}
          voiceEnabled={voiceEnabled}
        />
      </div>

      {cameraEnabled && (
        <DraggableCameraWindow
          title="Camera — Board Detection"
          color="text-green-400"
          onClose={() => setCameraEnabled(false)}
          defaultX={20}
          defaultY={80}
        >
          <CameraInput
            enabled={cameraEnabled}
            currentFen={currentFen}
            onMoveDetected={handleMove}
            isMoveLocked={isLocked}
          />
        </DraggableCameraWindow>
      )}

      {handEnabled && (
        <DraggableCameraWindow
          title="Hand Tracking"
          color="text-purple-400"
          onClose={() => setHandEnabled(false)}
          defaultX={20}
          defaultY={80}
        >
          <HandCursorInput
            enabled={handEnabled}
            currentFen={currentFen}
            onSquareHover={setHandHoveredSquare}
            onSquareSelect={setHandSelectedSquare}
            onMove={handleMove}
            isMoveLocked={isLocked}
          />
        </DraggableCameraWindow>
      )}

      {eyeEnabled && (
        <DraggableCameraWindow
          title="Eye Tracking"
          color="text-cyan-400"
          onClose={() => setEyeEnabled(false)}
          defaultX={20}
          defaultY={80}
        >
          <EyeTrackingInput
            enabled={eyeEnabled}
            currentFen={currentFen}
            onSquareHover={setEyeHoveredSquare}
            onSquareSelect={setEyeSelectedSquare}
            onMove={handleMove}
            isMoveLocked={isLocked}
          />
        </DraggableCameraWindow>
      )}
    </div>
  );
}
