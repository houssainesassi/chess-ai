import { useEffect, useRef, useState, useCallback } from "react";
import { X, GripHorizontal } from "lucide-react";

interface Props {
  title: string;
  color?: string;
  onClose: () => void;
  children: React.ReactNode;
  defaultX?: number;
  defaultY?: number;
}

export function DraggableCameraWindow({
  title,
  color = "text-muted-foreground",
  onClose,
  children,
  defaultX,
  defaultY,
}: Props) {
  const [pos, setPos] = useState(() => ({
    x: defaultX ?? Math.max(0, window.innerWidth - 360),
    y: defaultY ?? 80,
  }));

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
      e.preventDefault();
    },
    [pos]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      dragRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        origX: pos.x,
        origY: pos.y,
      };
    },
    [pos]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + dy)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - dragRef.current.startX;
      const dy = touch.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + dy)),
      });
      e.preventDefault();
    };
    const onTouchEnd = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div
      className="fixed z-50 w-80 bg-card border border-border/60 rounded-xl shadow-2xl overflow-hidden select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="flex items-center justify-between px-3 py-2 bg-secondary/60 cursor-grab active:cursor-grabbing border-b border-border/40 touch-none"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-muted-foreground" />
          <span className={`text-xs font-semibold ${color}`}>{title}</span>
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="p-2 select-text">{children}</div>
    </div>
  );
}
