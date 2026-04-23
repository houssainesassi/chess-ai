import { useEffect, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Camera, CameraOff, RefreshCw, AlertTriangle } from "lucide-react";

interface CameraInputProps {
  enabled: boolean;
  currentFen: string;
  onMoveDetected: (uciMove: string, source: "camera") => void;
  isMoveLocked: () => boolean;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function getSquare(col: number, row: number): string {
  return FILES[col] + RANKS[row];
}

function toGrayscale(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sampleCellBrightness(
  data: Uint8ClampedArray,
  width: number,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number
): number {
  let sum = 0;
  let count = 0;
  const step = 4;
  for (let y = cellY + 2; y < cellY + cellH - 2; y += step) {
    for (let x = cellX + 2; x < cellX + cellW - 2; x += step) {
      const idx = (y * width + x) * 4;
      sum += toGrayscale(data[idx], data[idx + 1], data[idx + 2]);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function getCellBrightnesses(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number[][] {
  const cellW = width / 8;
  const cellH = height / 8;
  const grid: number[][] = [];
  for (let row = 0; row < 8; row++) {
    grid[row] = [];
    for (let col = 0; col < 8; col++) {
      grid[row][col] = sampleCellBrightness(
        data,
        width,
        Math.floor(col * cellW),
        Math.floor(row * cellH),
        Math.floor(cellW),
        Math.floor(cellH)
      );
    }
  }
  return grid;
}

function getChangedSquares(
  base: number[][],
  current: number[][],
  threshold: number
): string[] {
  const changed: string[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (Math.abs(current[row][col] - base[row][col]) > threshold) {
        changed.push(getSquare(col, row));
      }
    }
  }
  return changed;
}

function tryInferMove(changedSquares: string[], fen: string): string | null {
  if (changedSquares.length < 2 || changedSquares.length > 4) return null;

  const chess = new Chess(fen);

  const pairs: [string, string][] = [];
  for (let i = 0; i < changedSquares.length; i++) {
    for (let j = i + 1; j < changedSquares.length; j++) {
      pairs.push([changedSquares[i], changedSquares[j]]);
      pairs.push([changedSquares[j], changedSquares[i]]);
    }
  }

  for (const [from, to] of pairs) {
    try {
      const tempChess = new Chess(fen);
      const move = tempChess.move({
        from: from as any,
        to: to as any,
        promotion: "q",
      });
      if (move) {
        return from + to + (move.promotion && move.promotion !== "q" ? move.promotion : "");
      }
    } catch {}
  }

  const legalMoves = chess.moves({ verbose: true });
  for (const [from, to] of pairs) {
    const match = legalMoves.find((m) => m.from === from && m.to === to);
    if (match) {
      return match.from + match.to + (match.promotion ?? "");
    }
  }

  return null;
}

export function CameraInput({
  enabled,
  currentFen,
  onMoveDetected,
  isMoveLocked,
}: CameraInputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const baseGridRef = useRef<number[][] | null>(null);
  const prevGridRef = useRef<number[][] | null>(null);
  const stableCountRef = useRef(0);
  const motionCountRef = useRef(0);
  const cooldownRef = useRef(0);
  const currentFenRef = useRef(currentFen);

  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [motionLevel, setMotionLevel] = useState(0);

  useEffect(() => {
    currentFenRef.current = currentFen;
  }, [currentFen]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    baseGridRef.current = null;
    prevGridRef.current = null;
    stableCountRef.current = 0;
    motionCountRef.current = 0;
  }, []);

  const analyze = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(analyze);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.drawImage(video, 0, 0, W, H);

    const { data } = ctx.getImageData(0, 0, W, H);
    const currentGrid = getCellBrightnesses(data, W, H);

    const MOTION_THRESHOLD = 12;
    const STABLE_NEEDED = 10;
    const BASE_DIFF_THRESHOLD = 20;

    let totalMotion = 0;
    if (prevGridRef.current) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          totalMotion += Math.abs(currentGrid[r][c] - prevGridRef.current[r][c]);
        }
      }
      totalMotion /= 64;
    }

    prevGridRef.current = currentGrid;
    setMotionLevel(Math.min(100, (totalMotion / MOTION_THRESHOLD) * 100));

    const isMoving = totalMotion > MOTION_THRESHOLD;

    if (isMoving) {
      stableCountRef.current = 0;
      motionCountRef.current++;
    } else {
      stableCountRef.current++;

      if (stableCountRef.current >= STABLE_NEEDED) {
        if (
          baseGridRef.current !== null &&
          motionCountRef.current > 3 &&
          Date.now() > cooldownRef.current &&
          !isMoveLocked()
        ) {
          const changed = getChangedSquares(
            baseGridRef.current,
            currentGrid,
            BASE_DIFF_THRESHOLD
          );

          if (changed.length >= 2 && changed.length <= 4) {
            setHighlightedSquares(changed);
            const uci = tryInferMove(changed, currentFenRef.current);
            if (uci) {
              setLastMove(uci);
              onMoveDetected(uci, "camera");
              cooldownRef.current = Date.now() + 2500;
            }
          } else {
            setHighlightedSquares([]);
          }

          baseGridRef.current = currentGrid;
          motionCountRef.current = 0;
        } else if (baseGridRef.current === null) {
          baseGridRef.current = currentGrid;
        }
      }
    }

    drawOverlay(ctx, W, H, highlightedSquares);
    rafRef.current = requestAnimationFrame(analyze);
  }, [onMoveDetected, isMoveLocked, highlightedSquares]);

  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    highlighted: string[]
  ) {
    const cellW = W / 8;
    const cellH = H / 8;

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellH);
      ctx.lineTo(W, i * cellH);
      ctx.stroke();
    }

    for (const sq of highlighted) {
      const col = FILES.indexOf(sq[0]);
      const row = RANKS.indexOf(sq[1]);
      if (col < 0 || row < 0) continue;
      ctx.fillStyle = "rgba(250,204,21,0.35)";
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      ctx.strokeStyle = "rgba(250,204,21,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(col * cellW + 1, row * cellH + 1, cellW - 2, cellH - 2);
    }

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(4, H - 20, 70, 16);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("a b c d e f g h", 6, H - 8);

    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(2, i * cellH + 2, 14, 14);
      ctx.font = "10px monospace";
      ctx.fillStyle = "#aaa";
      ctx.fillText(RANKS[i], 4, i * cellH + 13);
    }
  }

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
          baseGridRef.current = null;
          stableCountRef.current = 0;
          motionCountRef.current = 0;
          cooldownRef.current = 0;
          rafRef.current = requestAnimationFrame(analyze);
        };
      }
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow access in your browser."
          : err?.name === "NotFoundError"
          ? "No camera found on this device."
          : "Could not access camera: " + (err?.message ?? "unknown error")
      );
    }
  }, [analyze]);

  useEffect(() => {
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [enabled]);

  useEffect(() => {
    if (enabled && isStreaming) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(analyze);
    }
  }, [analyze, enabled, isStreaming]);

  if (!enabled) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Camera feed */}
      <div className="relative rounded-lg overflow-hidden border border-border/60 bg-black shadow-xl">
        <video
          ref={videoRef}
          className="w-full block"
          playsInline
          muted
          style={{ maxHeight: 220, objectFit: "cover" }}
        />
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {!isStreaming && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera size={28} className="animate-pulse" />
              <span className="text-xs">Starting camera…</span>
            </div>
          </div>
        )}

        {isStreaming && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-mono">LIVE</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {cameraError && (
        <div className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-700/40 rounded-lg text-xs text-red-400">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <div>{cameraError}</div>
        </div>
      )}

      {/* Motion indicator + last detected move */}
      {isStreaming && (
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Motion</span>
            <div className="flex-1 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${motionLevel}%`,
                  background: motionLevel > 60 ? "#f59e0b" : "#22c55e",
                }}
              />
            </div>
          </div>

          {lastMove && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground uppercase tracking-wider">Last detected</span>
              <span className="font-mono font-bold text-yellow-400">{lastMove}</span>
            </div>
          )}

          <div className="text-[9px] text-muted-foreground/60 italic leading-tight">
            Point camera at your board so it fills the frame. Keep camera steady while moving pieces.
          </div>
        </div>
      )}

      {/* Retry button on error */}
      {cameraError && (
        <button
          onClick={startCamera}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={11} />
          Retryy
        </button>
      )}
    </div>
  );
}
//