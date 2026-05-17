import {
  useEffect, useRef, useState, useCallback,
} from "react";
import {
  Mic, MicOff, Hand, Eye, X, GripHorizontal,
  Wifi, WifiOff, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  Activity, Terminal, Settings2, RefreshCw,
} from "lucide-react";
import { useAIControl } from "@/contexts/ai-control-context";

const THUMB_TIP = 4;
const INDEX_TIP = 8;
const LEFT_IRIS = 468;
const LEFT_EYE_LEFT = 33;
const LEFT_EYE_RIGHT = 133;
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_IRIS = 473;
const RIGHT_EYE_LEFT = 362;
const RIGHT_EYE_RIGHT = 263;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;
const DWELL_MS = 1300;
const SMOOTH = 0.18;

const HAND_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

type Lm = { x: number; y: number; z: number };

function computeGaze(lm: Lm[]): { x: number; y: number } | null {
  if (lm.length < 478) return null;
  const lW = lm[LEFT_EYE_RIGHT].x - lm[LEFT_EYE_LEFT].x;
  const lH = lm[LEFT_EYE_BOTTOM].y - lm[LEFT_EYE_TOP].y;
  const rW = lm[RIGHT_EYE_RIGHT].x - lm[RIGHT_EYE_LEFT].x;
  const rH = lm[RIGHT_EYE_BOTTOM].y - lm[RIGHT_EYE_TOP].y;
  if (lW < 0.001 || rW < 0.001 || lH < 0.001 || rH < 0.001) return null;
  const lx = (lm[LEFT_IRIS].x - lm[LEFT_EYE_LEFT].x) / lW;
  const ly = (lm[LEFT_IRIS].y - lm[LEFT_EYE_TOP].y) / lH;
  const rx = (lm[RIGHT_IRIS].x - lm[RIGHT_EYE_LEFT].x) / rW;
  const ry = (lm[RIGHT_IRIS].y - lm[RIGHT_EYE_TOP].y) / rH;
  return { x: (lx + rx) / 2, y: (ly + ry) / 2 };
}

function gazeToScreen(gaze: { x: number; y: number }): { x: number; y: number } {
  const nx = Math.max(0, Math.min(1, (gaze.x - 0.25) / 0.5));
  const ny = Math.max(0, Math.min(1, (gaze.y - 0.2) / 0.6));
  return { x: nx * window.innerWidth, y: ny * window.innerHeight };
}

type Tab = "control" | "log" | "settings";

export function AIControlWidget() {
  const {
    voiceEnabled, gestureEnabled, gazeEnabled,
    voiceStatus, cameraStatus, cameraError,
    cursor, dwellProgress, isPinching,
    transcript, commandHistory, platform,
    toggleVoice, toggleGesture, toggleGaze,
    reportCursor, reportDwell, reportPinch, reportCameraStatus, triggerClick,
  } = useAIControl();

  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<Tab>("control");
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, (typeof window !== "undefined" ? window.innerWidth : 1280) - 320),
    y: 80,
  }));

  // Dragging — supports both mouse and touch
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    dragRef.current = { sx: clientX, sy: clientY, ox: pos.x, oy: pos.y };
  }, [pos]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't call preventDefault here — it blocks tap events on children
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, [startDrag]);

  useEffect(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: clamp(dragRef.current.ox + e.clientX - dragRef.current.sx, 0, window.innerWidth - 290),
        y: clamp(dragRef.current.oy + e.clientY - dragRef.current.sy, 0, window.innerHeight - 60),
      });
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault(); // prevent page scroll while dragging widget
      const t = e.touches[0];
      setPos({
        x: clamp(dragRef.current.ox + t.clientX - dragRef.current.sx, 0, window.innerWidth - 290),
        y: clamp(dragRef.current.oy + t.clientY - dragRef.current.sy, 0, window.innerHeight - 60),
      });
    };
    const onUp = () => { dragRef.current = null; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, []);

  // Camera + MediaPipe refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  const faceLandmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);

  // Gesture state refs
  const pinchStableRef = useRef(0);
  const openStableRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const pinchCooldownRef = useRef(0);
  const dwellTargetRef = useRef<{ x: number; y: number } | null>(null);
  const dwellStartRef = useRef(0);
  const smoothGazeRef = useRef<{ x: number; y: number } | null>(null);

  const needCamera = gestureEnabled || gazeEnabled;

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    reportCursor(null);
    reportDwell(0);
    reportPinch(false);
    pinchStableRef.current = 0;
    openStableRef.current = 0;
    wasPinchingRef.current = false;
    smoothGazeRef.current = null;
    reportCameraStatus("idle");
  }, [reportCursor, reportDwell, reportPinch, reportCameraStatus]);

  const runLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !runningRef.current) return;
    if (video.readyState < 2) { rafRef.current = requestAnimationFrame(runLoop); return; }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();

    const now = performance.now();

    // ── Hand gesture cursor ────────────────────────────────
    if (gestureEnabled && handLandmarkerRef.current) {
      let handResults: any;
      try { handResults = handLandmarkerRef.current.detectForVideo(video, now); } catch { /* skip */ }
      const landmarks: Lm[][] = handResults?.landmarks ?? [];

      if (landmarks.length > 0) {
        const hand = landmarks[0];
        const tip = hand[INDEX_TIP];
        const thumb = hand[THUMB_TIP];

        // Mirrored index → screen coords
        const sx = (1 - tip.x) * window.innerWidth;
        const sy = tip.y * window.innerHeight;
        reportCursor({ x: sx, y: sy });

        // Draw skeleton on preview canvas
        ctx.strokeStyle = "rgba(74,222,128,0.8)";
        ctx.lineWidth = 1.5;
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo((1 - hand[a].x) * W, hand[a].y * H);
          ctx.lineTo((1 - hand[b].x) * W, hand[b].y * H);
          ctx.stroke();
        }
        for (const lm of hand) {
          ctx.beginPath();
          ctx.arc((1 - lm.x) * W, lm.y * H, 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fill();
        }

        // Pinch detection
        const pDist = Math.hypot(tip.x - thumb.x, tip.y - thumb.y);
        const pinching = pDist < 0.06;
        const STABLE = 4;
        if (pinching) {
          pinchStableRef.current = Math.min(pinchStableRef.current + 1, STABLE + 1);
          openStableRef.current = 0;
        } else {
          openStableRef.current = Math.min(openStableRef.current + 1, STABLE + 1);
          pinchStableRef.current = 0;
        }
        const stablePinch = pinchStableRef.current >= STABLE;
        const stableOpen = openStableRef.current >= STABLE;
        reportPinch(stablePinch);

        if (stablePinch && !wasPinchingRef.current && Date.now() > pinchCooldownRef.current) {
          wasPinchingRef.current = true;
          pinchCooldownRef.current = Date.now() + 700;
          triggerClick({ x: sx, y: sy });
        } else if (stableOpen) {
          wasPinchingRef.current = false;
        }

        // Pinch ring on preview
        const px = (1 - tip.x) * W;
        const py = tip.y * H;
        ctx.beginPath();
        ctx.arc(px, py, stablePinch ? 14 : 9, 0, Math.PI * 2);
        ctx.strokeStyle = stablePinch ? "#f97316" : "#facc15";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        if (runningRef.current) reportCursor(null);
      }
    }

    // ── Gaze cursor ──────────────────────────────────────
    if (gazeEnabled && faceLandmarkerRef.current) {
      let faceResults: any;
      try { faceResults = faceLandmarkerRef.current.detectForVideo(video, now); } catch { /* skip */ }
      const faceLms: Lm[][] = faceResults?.faceLandmarks ?? [];

      if (faceLms.length > 0) {
        const lm = faceLms[0];
        const rawGaze = computeGaze(lm);
        if (rawGaze) {
          const prev = smoothGazeRef.current;
          smoothGazeRef.current = prev
            ? { x: SMOOTH * rawGaze.x + (1 - SMOOTH) * prev.x, y: SMOOTH * rawGaze.y + (1 - SMOOTH) * prev.y }
            : rawGaze;

          const screen = gazeToScreen(smoothGazeRef.current);
          // Hand takes priority if also enabled and hand was detected
          if (!gestureEnabled) reportCursor(screen);

          // Iris preview dots
          for (const idx of [LEFT_IRIS, RIGHT_IRIS]) {
            const il = lm[idx];
            ctx.beginPath();
            ctx.arc((1 - il.x) * W, il.y * H, 4, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(34,211,238,0.9)";
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Dwell detection
          const DWELL_ZONE = 60;
          const dTarget = dwellTargetRef.current;
          if (!dTarget || Math.hypot(screen.x - dTarget.x, screen.y - dTarget.y) > DWELL_ZONE) {
            dwellTargetRef.current = screen;
            dwellStartRef.current = Date.now();
            reportDwell(0);
          } else {
            const elapsed = Date.now() - dwellStartRef.current;
            const prog = Math.min(1, elapsed / DWELL_MS);
            reportDwell(prog);
            if (prog >= 1) {
              dwellStartRef.current = Date.now() + 99999;
              triggerClick(screen);
            }
          }
        }
      } else {
        smoothGazeRef.current = null;
        if (!gestureEnabled) reportCursor(null);
        reportDwell(0);
        dwellTargetRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [gestureEnabled, gazeEnabled, reportCursor, reportDwell, reportPinch, triggerClick]);

  const startCamera = useCallback(async () => {
    if (!platform.cameraSupported) {
      reportCameraStatus("error", "Camera not supported on this browser.");
      return;
    }
    reportCameraStatus("loading");
    try {
      const { HandLandmarker, FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      if (gestureEnabled && !handLandmarkerRef.current) {
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }

      if (gazeEnabled && !faceLandmarkerRef.current) {
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      }

      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
        });
        streamRef.current = stream;
      }

      const video = videoRef.current;
      if (video && streamRef.current) {
        video.srcObject = streamRef.current;
        await new Promise<void>((res) => {
          video.onloadedmetadata = () => { video.play(); res(); };
        });
      }

      runningRef.current = true;
      reportCameraStatus("ready");
      rafRef.current = requestAnimationFrame(runLoop);
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError" ? "Camera permission denied. Allow camera access and try again." :
        err?.name === "NotFoundError" ? "No camera found. Plug in a webcam and try again." :
        `Camera error: ${err?.message ?? "Unknown error"}`;
      reportCameraStatus("error", msg);
    }
  }, [gestureEnabled, gazeEnabled, reportCameraStatus, runLoop]);

  // Start/stop camera based on gesture/gaze toggles
  useEffect(() => {
    if (needCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      if (!needCamera) return;
    };
  }, [needCamera]);

  // Update run loop when mode changes
  useEffect(() => {
    if (runningRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runLoop);
    }
  }, [runLoop]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  // ── Voice status color ──────────────────────────────────
  const voiceColor =
    voiceStatus === "listening" ? "text-green-400" :
    voiceStatus === "processing" ? "text-yellow-400" :
    voiceStatus === "error" ? "text-red-400" :
    voiceStatus === "unsupported" ? "text-red-400" :
    "text-white/30";

  const camStatusDot =
    cameraStatus === "ready" ? "bg-green-400" :
    cameraStatus === "loading" ? "bg-yellow-400 animate-pulse" :
    cameraStatus === "error" ? "bg-red-400" :
    "bg-white/20";

  return (
    <div
      className="fixed z-[99999] w-72 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl select-none overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* ── Header (drag handle — mouse + touch) ── */}
      <div
        onMouseDown={onDragStart}
        onTouchStart={onTouchStart}
        className="flex items-center gap-2 px-3 py-2 bg-[#252525] border-b border-white/10 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripHorizontal size={13} className="text-white/30 shrink-0" />
        <Activity size={13} className="text-[#81b64c] shrink-0" />
        <span className="text-xs font-bold text-white flex-1 tracking-wide">AI CONTROL</span>

        {/* Compact status pills */}
        <div className="flex items-center gap-1.5">
          <StatusDot active={voiceEnabled} color="bg-[#81b64c]" label="V" />
          <StatusDot active={gestureEnabled} color="bg-green-400" label="H" />
          <StatusDot active={gazeEnabled} color="bg-cyan-400" label="E" />
        </div>

        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setMinimized((v) => !v)}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors ml-1"
        >
          {minimized ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      {!minimized && (
        <>
          {/* ── Tabs ── */}
          <div className="flex border-b border-white/10">
            {(["control", "log", "settings"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  tab === t ? "text-[#81b64c] border-b-2 border-[#81b64c]" : "text-white/30 hover:text-white/60"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Control tab ── */}
          {tab === "control" && (
            <div className="p-3 flex flex-col gap-3">
              {/* Toggle buttons */}
              <div className="grid grid-cols-3 gap-2">
                <ModeButton
                  label="Voice"
                  icon={voiceEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                  active={voiceEnabled}
                  disabled={!platform.speechSupported}
                  color="text-[#81b64c]"
                  activeBg="bg-[#81b64c]/15 border-[#81b64c]/50"
                  onClick={toggleVoice}
                  subtitle={
                    voiceStatus === "listening" ? "listening" :
                    voiceStatus === "processing" ? "thinking" :
                    voiceStatus === "unsupported" ? "N/A" :
                    voiceStatus === "error" ? "error" : "off"
                  }
                />
                <ModeButton
                  label="Hand"
                  icon={<Hand size={14} />}
                  active={gestureEnabled}
                  disabled={!platform.cameraSupported}
                  color="text-green-400"
                  activeBg="bg-green-400/15 border-green-400/50"
                  onClick={toggleGesture}
                  subtitle={gestureEnabled ? "tracking" : "off"}
                />
                <ModeButton
                  label="Eye"
                  icon={<Eye size={14} />}
                  active={gazeEnabled}
                  disabled={!platform.cameraSupported}
                  color="text-cyan-400"
                  activeBg="bg-cyan-400/15 border-cyan-400/50"
                  onClick={toggleGaze}
                  subtitle={gazeEnabled ? "tracking" : "off"}
                />
              </div>

              {/* Camera preview */}
              {needCamera && (
                <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black">
                  <video ref={videoRef} className="absolute opacity-0 w-0 h-0" playsInline muted />
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={180}
                    className="w-full block"
                    style={{ maxHeight: 180 }}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${camStatusDot}`} />
                    <span className="text-[9px] font-mono text-white/60">
                      {cameraStatus === "loading" ? "LOADING" :
                       cameraStatus === "error" ? "ERROR" :
                       cameraStatus === "ready" ? (gestureEnabled && gazeEnabled ? "HAND+EYE" : gestureEnabled ? "HAND" : "EYE") :
                       "IDLE"}
                    </span>
                  </div>

                  {cameraStatus === "loading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 gap-2">
                      <Loader2 size={18} className="animate-spin text-[#81b64c]" />
                      <span className="text-xs text-[#81b64c]">Loading AI model…</span>
                    </div>
                  )}
                </div>
              )}

              {/* Camera error */}
              {cameraStatus === "error" && cameraError && (
                <div className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-700/40 rounded-lg text-xs text-red-400">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <div className="leading-snug">{cameraError}</div>
                </div>
              )}

              {/* Linux note */}
              {platform.linuxCameraNote && (needCamera) && (
                <div className="text-[10px] text-white/30 leading-snug px-1">
                  {platform.linuxCameraNote}
                </div>
              )}

              {/* Voice transcript */}
              {voiceEnabled && (
                <div className="rounded-lg bg-[#252525] border border-white/10 px-3 py-2 min-h-[36px]">
                  <div className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Transcript</div>
                  <p className={`text-xs leading-snug ${voiceColor} font-mono`}>
                    {transcript || <span className="text-white/20 italic">Listening…</span>}
                  </p>
                </div>
              )}

              {/* Cursor position when active */}
              {cursor && (
                <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono px-1">
                  <span>Cursor</span>
                  <span className="text-white/70">{Math.round(cursor.x)}, {Math.round(cursor.y)}</span>
                  {isPinching && <span className="text-orange-400 ml-auto">PINCH</span>}
                  {!isPinching && dwellProgress > 0 && (
                    <div className="ml-auto h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${dwellProgress * 100}%` }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Log tab ── */}
          {tab === "log" && (
            <div className="p-3 flex flex-col gap-2">
              <div className="text-[9px] uppercase tracking-wider text-white/30">Command History</div>
              {commandHistory.length === 0 ? (
                <p className="text-[11px] text-white/20 italic">No commands yet</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {commandHistory.map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                      <Terminal size={9} className="text-[#81b64c] shrink-0" />
                      <span className={i === 0 ? "text-white/80" : "text-white/35"}>{cmd}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Settings tab ── */}
          {tab === "settings" && (
            <div className="p-3 flex flex-col gap-3">
              <div className="text-[9px] uppercase tracking-wider text-white/30">Platform</div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <InfoRow label="OS" value={platform.os} />
                <InfoRow label="Browser" value={platform.browser} />
                <InfoRow label="Speech" value={platform.speechSupported ? "✓" : "✗"} ok={platform.speechSupported} />
                <InfoRow label="Camera" value={platform.cameraSupported ? "✓" : "✗"} ok={platform.cameraSupported} />
                <InfoRow label="MediaPipe" value={platform.mediaPipeSupported ? "✓" : "✗"} ok={platform.mediaPipeSupported} />
                <InfoRow label="Electron" value={platform.isElectron ? "Yes" : "No"} />
              </div>

              <div className="text-[9px] uppercase tracking-wider text-white/30 mt-1">Voice Commands</div>
              <div className="text-[10px] text-white/40 leading-relaxed space-y-0.5">
                {[
                  '"go to lobby"', '"open settings"', '"play ai"',
                  '"scroll down"', '"click resign"', '"accept"', '"decline"',
                ].map((cmd) => (
                  <div key={cmd} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#81b64c]/60 shrink-0" />
                    <span className="font-mono">{cmd}</span>
                  </div>
                ))}
              </div>

              {needCamera && cameraStatus !== "idle" && (
                <button
                  onClick={() => { stopCamera(); setTimeout(startCamera, 300); }}
                  className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                >
                  <RefreshCw size={10} /> Restart camera
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ active, color, label }: { active: boolean; color: string; label: string }) {
  return (
    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold
      ${active ? `${color} text-black` : "bg-white/10 text-white/30"}`}>
      {label}
    </div>
  );
}

function ModeButton({
  label, icon, active, disabled, color, activeBg, onClick, subtitle,
}: {
  label: string; icon: React.ReactNode; active: boolean; disabled: boolean;
  color: string; activeBg: string; onClick: () => void; subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-center transition-all
        ${disabled ? "opacity-30 cursor-not-allowed border-white/10 text-white/20" :
          active ? `${activeBg} ${color}` : "border-white/10 text-white/30 hover:text-white/60 hover:border-white/20"
        }`}
    >
      {icon}
      <span className="text-[9px] font-semibold">{label}</span>
      <span className={`text-[8px] ${active ? "opacity-80" : "opacity-40"}`}>{subtitle}</span>
    </button>
  );
}

function InfoRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <>
      <span className="text-white/30">{label}</span>
      <span className={ok === false ? "text-red-400" : ok === true ? "text-green-400" : "text-white/60 capitalize"}>
        {value}
      </span>
    </>
  );
}
