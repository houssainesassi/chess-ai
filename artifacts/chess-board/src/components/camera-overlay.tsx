import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, GripHorizontal, X } from "lucide-react";

// ── MediaPipe hand-tracking camera panel ────────────────────────────────────

export function CameraOverlay({ onSquareSelect, flipped, trackingActive, onHoverChange }: {
  onSquareSelect: (sq: string) => void;
  flipped: boolean;
  trackingActive?: boolean;
  onHoverChange?: (sq: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const dwellRef = useRef<{ sq: string; start: number } | null>(null);
  const [status, setStatus] = useState("Loading hand tracking...");
  const [dwellPct, setDwellPct] = useState(0);
  const [mpLoaded, setMpLoaded] = useState(false);

  const sqFromNorm = useCallback((nx: number, ny: number): string => {
    const mx = 1 - nx;
    const fx = flipped ? 1 - mx : mx;
    const fy = flipped ? 1 - ny : ny;
    const fileIdx = Math.min(7, Math.max(0, Math.floor(fx * 8)));
    const rankIdx = Math.min(7, Math.max(0, Math.floor(fy * 8)));
    return `${String.fromCharCode(97 + fileIdx)}${8 - rankIdx}`;
  }, [flipped]);

  useEffect(() => {
    const scripts = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js",
    ];
    let loaded = 0;
    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) { loaded++; if (loaded === scripts.length) setMpLoaded(true); return; }
      const s = document.createElement("script"); s.src = src; s.crossOrigin = "anonymous";
      s.onload = () => { loaded++; if (loaded === scripts.length) setMpLoaded(true); };
      s.onerror = () => setStatus("Failed to load hand tracking library");
      document.head.appendChild(s);
    });
  }, []);

  useEffect(() => {
    if (!mpLoaded) return;
    const w = window as any;
    if (!w.Hands) { setStatus("Hand tracking unavailable"); return; }

    const hands = new w.Hands({
      locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`,
    });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });

    hands.onResults((results: any) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = video.videoWidth || 320;
      const H = video.videoHeight || 240;
      canvas.width = W;
      canvas.height = H;

      ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -W, 0, W, H); ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 0.5;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo((i / 8) * W, 0); ctx.lineTo((i / 8) * W, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, (i / 8) * H); ctx.lineTo(W, (i / 8) * H); ctx.stroke();
      }

      if (results.multiHandLandmarks?.length > 0) {
        const lm = results.multiHandLandmarks[0];
        const tip = lm[8];
        const dispX = (1 - tip.x) * W;
        const dispY = tip.y * H;

        if (w.HAND_CONNECTIONS) {
          ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 2;
          for (const [a, b] of w.HAND_CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo((1 - lm[a].x) * W, lm[a].y * H);
            ctx.lineTo((1 - lm[b].x) * W, lm[b].y * H);
            ctx.stroke();
          }
        }
        lm.forEach((pt: any) => {
          ctx.beginPath(); ctx.arc((1 - pt.x) * W, pt.y * H, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#fff"; ctx.fill();
        });

        ctx.beginPath(); ctx.arc(dispX, dispY, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99,102,241,0.6)"; ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 2.5; ctx.stroke();

        const sq = trackingActive !== false ? sqFromNorm(tip.x, tip.y) : "";
        onHoverChange?.(sq || null);

        const mx = 1 - tip.x;
        const cellX = Math.min(7, Math.max(0, Math.floor(mx * 8)));
        const cellY = Math.min(7, Math.max(0, Math.floor(tip.y * 8)));
        ctx.fillStyle = "rgba(99,102,241,0.25)";
        ctx.fillRect(cellX * (W / 8), cellY * (H / 8), W / 8, H / 8);

        const now = Date.now();
        if (dwellRef.current?.sq === sq) {
          const elapsed = now - dwellRef.current.start;
          const pct = Math.min(elapsed / 1500, 1);
          setDwellPct(pct * 100);
          ctx.beginPath();
          ctx.arc(dispX, dispY, 20, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
          ctx.strokeStyle = "#a5b4fc"; ctx.lineWidth = 3; ctx.stroke();
          if (elapsed >= 1500 && sq) { onSquareSelect(sq); dwellRef.current = null; setDwellPct(0); }
        } else {
          if (sq) dwellRef.current = { sq, start: now };
          setDwellPct(0);
        }
        setStatus("✋ Hold still over a square for 1.5s");
      } else {
        setStatus("Show your hand to the camera");
        onHoverChange?.(null);
        dwellRef.current = null;
        setDwellPct(0);
      }
    });

    handsRef.current = hands;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } })
      .then(stream => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play();
        setStatus("Point at the grid to select squares");
        const loop = async () => {
          try {
            if (handsRef.current && video.readyState >= 2) await handsRef.current.send({ image: video });
          } catch { /* skip frame on WASM error */ }
          if (handsRef.current) requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(err => setStatus(err.name === "NotAllowedError" ? "Camera permission denied" : "Camera unavailable"));

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); handsRef.current = null; };
  }, [mpLoaded, sqFromNorm, onSquareSelect]);

  return (
    <div className="relative w-full bg-black" style={{ height: 200 }}>
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      {trackingActive !== false && (
        <div className="absolute top-2 right-2 bg-green-500/90 text-black text-[10px] font-bold px-2 py-0.5 rounded">
          HAND TRACK
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-white/50">{status}</span>
        {dwellPct > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 transition-all duration-100" style={{ width: `${dwellPct}%` }} />
            </div>
            <span className="text-[10px] text-indigo-300">{Math.round(dwellPct)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable camera popup ────────────────────────────────────────────────────

export function DraggableCameraPopup({
  onSquareSelect, flipped, handActive, onHoverChange, onClose, hoveredSq,
}: {
  onSquareSelect: (sq: string) => void;
  flipped: boolean;
  handActive: boolean;
  onHoverChange: (sq: string | null) => void;
  onClose: () => void;
  hoveredSq: string | null;
}) {
  const [pos, setPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(0, window.innerWidth - 310) : 40,
    y: 80,
  }));
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 288, e.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 260, e.clientY - offset.current.y)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const t = e.touches[0];
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 288, t.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 260, t.clientY - offset.current.y)),
      });
    };
    const onTouchEnd = () => { dragging.current = false; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = true;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  return (
    <div
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#1a1a1a] select-none"
      style={{ left: pos.x, top: pos.y, width: 288 }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-[#2a2a2a] cursor-grab active:cursor-grabbing"
        onMouseDown={e => { startDrag(e.clientX, e.clientY); e.preventDefault(); }}
        onTouchStart={e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
      >
        <div className="flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-white/60" />
          <span className="text-xs font-semibold text-white/80">Hand Camera</span>
          {handActive && (
            <span className="bg-green-500/20 text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded">LIVE</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-white/40">
          <GripHorizontal className="w-3.5 h-3.5" />
          <button onClick={onClose} className="hover:text-white/80 transition-colors ml-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <CameraOverlay
        onSquareSelect={onSquareSelect}
        flipped={flipped}
        trackingActive={handActive}
        onHoverChange={onHoverChange}
      />
      <div className="px-3 py-1.5 bg-black/80 flex items-center justify-between text-[10px]">
        {hoveredSq ? (
          <span className="text-white/50">HOVER <span className="text-white font-bold">{hoveredSq.toUpperCase()}</span></span>
        ) : (
          <span className="text-white/30">HOVER —</span>
        )}
        <span className="text-white/20 italic">drag to move</span>
      </div>
    </div>
  );
}
