import { useEffect, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Hand, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

// MediaPipe hand landmark indices
const THUMB_TIP = 4;
const INDEX_TIP = 8;

// Hand skeleton connections for drawing
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

type Landmark = { x: number; y: number; z: number };

function landmarkToSquare(x: number, y: number): string {
  // Camera feed is mirrored — flip X
  const mirroredX = 1 - x;
  const col = Math.min(7, Math.max(0, Math.floor(mirroredX * 8)));
  const row = Math.min(7, Math.max(0, Math.floor(y * 8)));
  return FILES[col] + RANKS[row];
}

function pinchDistance(landmarks: Landmark[]): number {
  const thumb = landmarks[THUMB_TIP];
  const index = landmarks[INDEX_TIP];
  return Math.hypot(thumb.x - index.x, thumb.y - index.y);
}

interface HandCursorInputProps {
  enabled: boolean;
  currentFen: string;
  onSquareHover: (square: string | null) => void;
  onSquareSelect: (square: string | null) => void;
  onMove: (uciMove: string, source: "hand") => void;
  isMoveLocked: () => boolean;
}

export function HandCursorInput({
  enabled,
  currentFen,
  onSquareHover,
  onSquareSelect,
  onMove,
  isMoveLocked,
}: HandCursorInputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);

  // Gesture state machine
  const fromSquareRef = useRef<string | null>(null);
  const wasPinchingRef = useRef(false);
  const pinchStableCountRef = useRef(0);
  const openStableCountRef = useRef(0);
  const pinchCooldownRef = useRef(0);
  const currentFenRef = useRef(currentFen);
  const hoveredSquareRef = useRef<string | null>(null);

  const [loadingState, setLoadingState] = useState<"idle" | "loading-mediapipe" | "loading-camera" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [fromSquare, setFromSquare] = useState<string | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<string | null>(null);

  useEffect(() => {
    currentFenRef.current = currentFen;
  }, [currentFen]);

  const stopAll = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onSquareHover(null);
    onSquareSelect(null);
    fromSquareRef.current = null;
    setFromSquare(null);
    setHoveredSquare(null);
    setIsPinching(false);
  }, [onSquareHover, onSquareSelect]);

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = handLandmarkerRef.current;
    if (!video || !canvas || !landmarker || !runningRef.current) return;
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Mirror the video feed
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();

    // Run MediaPipe
    let results: any;
    try {
      results = landmarker.detectForVideo(video, performance.now());
    } catch {
      rafRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }

    const landmarks: Landmark[][] = results?.landmarks ?? [];

    if (landmarks.length > 0) {
      const hand = landmarks[0];
      const indexTip = hand[INDEX_TIP];
      const square = landmarkToSquare(indexTip.x, indexTip.y);

      // Draw skeleton
      ctx.strokeStyle = "rgba(99,202,183,0.8)";
      ctx.lineWidth = 2;
      for (const [a, b] of CONNECTIONS) {
        const la = hand[a];
        const lb = hand[b];
        // mirror x for display
        const ax = (1 - la.x) * W;
        const ay = la.y * H;
        const bx = (1 - lb.x) * W;
        const by = lb.y * H;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      // Draw landmark dots
      for (const lm of hand) {
        ctx.beginPath();
        ctx.arc((1 - lm.x) * W, lm.y * H, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
      }

      // Highlight index tip
      const ixDisp = (1 - indexTip.x) * W;
      const iyDisp = indexTip.y * H;
      ctx.beginPath();
      ctx.arc(ixDisp, iyDisp, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pinch detection (using original non-mirrored coords)
      const pDist = pinchDistance(hand);
      const pinching = pDist < 0.06;

      // Stabilize pinch state
      const STABLE_FRAMES = 4;
      if (pinching) {
        pinchStableCountRef.current = Math.min(pinchStableCountRef.current + 1, STABLE_FRAMES + 1);
        openStableCountRef.current = 0;
      } else {
        openStableCountRef.current = Math.min(openStableCountRef.current + 1, STABLE_FRAMES + 1);
        pinchStableCountRef.current = 0;
      }

      const stablePinch = pinchStableCountRef.current >= STABLE_FRAMES;
      const stableOpen = openStableCountRef.current >= STABLE_FRAMES;

      setIsPinching(stablePinch);

      // Draw pinch indicator
      if (stablePinch) {
        ctx.beginPath();
        ctx.arc(ixDisp, iyDisp, 16, 0, Math.PI * 2);
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "rgba(249,115,22,0.3)";
        ctx.fill();
      }

      // Pinch event (rising edge with cooldown)
      const now = Date.now();
      if (stablePinch && !wasPinchingRef.current && now > pinchCooldownRef.current && !isMoveLocked()) {
        wasPinchingRef.current = true;
        pinchCooldownRef.current = now + 800;

        if (!fromSquareRef.current) {
          // First pinch: select piece
          const chess = new Chess(currentFenRef.current);
          const piece = chess.get(square as any);
          if (piece) {
            fromSquareRef.current = square;
            setFromSquare(square);
            onSquareSelect(square);
          }
        } else if (square === fromSquareRef.current) {
          // Pinch on same square: deselect
          fromSquareRef.current = null;
          setFromSquare(null);
          onSquareSelect(null);
        } else {
          // Second pinch on different square: try move
          const uci = fromSquareRef.current + square + "q"; // default promotion = queen
          const chess = new Chess(currentFenRef.current);
          try {
            const move = chess.move({
              from: fromSquareRef.current as any,
              to: square as any,
              promotion: "q",
            });
            if (move) {
              const realUci = move.from + move.to + (move.promotion && move.promotion !== "q" ? move.promotion : "");
              setLastMove(move.from + move.to);
              onMove(realUci, "hand");
            }
          } catch {}
          fromSquareRef.current = null;
          setFromSquare(null);
          onSquareSelect(null);
        }
      } else if (stableOpen && wasPinchingRef.current) {
        wasPinchingRef.current = false;
      }

      // Update hover
      if (square !== hoveredSquareRef.current) {
        hoveredSquareRef.current = square;
        setHoveredSquare(square);
        onSquareHover(square);
      }

      // Draw square label
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(ixDisp - 18, iyDisp + 14, 36, 16);
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(square, ixDisp, iyDisp + 25);

    } else {
      // No hand detected — clear hover
      if (hoveredSquareRef.current !== null) {
        hoveredSquareRef.current = null;
        setHoveredSquare(null);
        onSquareHover(null);
        pinchStableCountRef.current = 0;
        openStableCountRef.current = 0;
        wasPinchingRef.current = false;
      }
    }

    // Draw grid overlay
    const cellW = W / 8;
    const cellH = H / 8;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cellH); ctx.lineTo(W, i * cellH); ctx.stroke();
    }

    rafRef.current = requestAnimationFrame(runDetectionLoop);
  }, [onSquareHover, onSquareSelect, onMove, isMoveLocked]);

  const startHandTracking = useCallback(async () => {
    setErrorMsg(null);
    setLoadingState("loading-mediapipe");

    try {
      // Dynamically import MediaPipe to avoid SSR issues
      const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      handLandmarkerRef.current = landmarker;
      setLoadingState("loading-camera");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          runningRef.current = true;
          setLoadingState("ready");
          rafRef.current = requestAnimationFrame(runDetectionLoop);
        };
      }
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Camera permission denied."
          : err?.name === "NotFoundError"
          ? "No camera found."
          : `Failed to initialize: ${err?.message ?? "unknown error"}`;
      setErrorMsg(msg);
      setLoadingState("error");
    }
  }, [runDetectionLoop]);

  useEffect(() => {
    if (enabled) {
      startHandTracking();
    } else {
      stopAll();
      setLoadingState("idle");
    }
    return () => stopAll();
  }, [enabled]);

  useEffect(() => {
    if (enabled && loadingState === "ready") {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runDetectionLoop);
    }
  }, [runDetectionLoop, enabled, loadingState]);

  if (!enabled) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Camera preview with skeleton overlay */}
      <div className="relative rounded-lg overflow-hidden border border-border/60 bg-black shadow-xl">
        <video
          ref={videoRef}
          className="w-full block opacity-0 absolute"
          playsInline
          muted
          style={{ maxHeight: 220 }}
        />
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="w-full block"
          style={{ maxHeight: 220 }}
        />

        {/* Loading overlays */}
        {(loadingState === "loading-mediapipe" || loadingState === "loading-camera") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
            <Loader2 size={24} className="animate-spin text-blue-400" />
            <span className="text-xs text-blue-400">
              {loadingState === "loading-mediapipe" ? "Loading hand detection model…" : "Starting camera…"}
            </span>
          </div>
        )}

        {/* Ready indicator */}
        {loadingState === "ready" && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-mono">HAND TRACK</span>
          </div>
        )}

        {/* Pinch indicator badge */}
        {isPinching && (
          <div className="absolute top-2 left-2 bg-orange-500/80 rounded-full px-2 py-0.5">
            <span className="text-[10px] font-bold text-white">PINCH</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {loadingState === "error" && errorMsg && (
        <div className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-700/40 rounded-lg text-xs text-red-400">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Status + last move */}
      {loadingState === "ready" && (
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground uppercase tracking-wider">Hover</span>
            <span className="font-mono font-bold text-yellow-400">{hoveredSquare ?? "—"}</span>
            {fromSquare && (
              <>
                <span className="text-muted-foreground uppercase tracking-wider ml-2">Selected</span>
                <span className="font-mono font-bold text-blue-400">{fromSquare}</span>
              </>
            )}
          </div>
          {lastMove && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground uppercase tracking-wider">Last move</span>
              <span className="font-mono font-bold text-green-400">{lastMove}</span>
            </div>
          )}
          <div className="text-[9px] text-muted-foreground/60 italic leading-tight">
            Point index finger at board square. Pinch to select piece, move hand, pinch again to drop.
          </div>
        </div>
      )}

      {loadingState === "error" && (
        <button
          onClick={startHandTracking}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={11} />
          Retry
        </button>
      )}
    </div>
  );
}
