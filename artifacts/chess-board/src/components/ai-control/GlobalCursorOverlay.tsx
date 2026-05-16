import { useEffect, useRef } from "react";
import { useAIControl } from "@/contexts/ai-control-context";

export function GlobalCursorOverlay() {
  const { cursor, dwellProgress, isPinching, gestureEnabled, gazeEnabled } = useAIControl();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rippleRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const prevPinchRef = useRef(false);
  const rafRef = useRef<number>(0);

  // Detect pinch → trigger ripple
  useEffect(() => {
    if (isPinching && !prevPinchRef.current && cursor) {
      rippleRef.current = { x: cursor.x, y: cursor.y, t: performance.now() };
    }
    prevPinchRef.current = isPinching;
  }, [isPinching, cursor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!cursor || (!gestureEnabled && !gazeEnabled)) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const { x, y } = cursor;
      const color = gestureEnabled ? "#4ade80" : "#22d3ee";
      const pinchColor = "#f97316";

      // Outer dwell ring
      if (dwellProgress > 0 && dwellProgress < 1) {
        ctx.beginPath();
        ctx.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + dwellProgress * Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Main cursor ring
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = isPinching ? pinchColor : color;
      ctx.lineWidth = isPinching ? 3 : 2;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Center dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isPinching ? pinchColor : color;
      ctx.fill();

      // Pinch fill
      if (isPinching) {
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fillStyle = `${pinchColor}33`;
        ctx.fill();
      }

      // Click ripple animation (500ms)
      const rip = rippleRef.current;
      if (rip) {
        const elapsed = performance.now() - rip.t;
        if (elapsed < 500) {
          const progress = elapsed / 500;
          const radius = 14 + progress * 30;
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = pinchColor;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1 - progress;
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          rippleRef.current = null;
        }
      }

      // Mode label
      const modeLabel = gestureEnabled ? "✋ HAND" : "👁 GAZE";
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillText(modeLabel, x + 18, y - 10);
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cursor, dwellProgress, isPinching, gestureEnabled, gazeEnabled]);

  if (!gestureEnabled && !gazeEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 99998,
      }}
    />
  );
}
