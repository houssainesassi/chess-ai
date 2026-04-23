import { useState } from "react";
import { Hand, Eye } from "lucide-react";
import { DraggableCameraWindow } from "./draggable-camera-window";
import { HandCursorInput } from "./hand-cursor-input";
import { EyeTrackingInput } from "./eye-tracking-input";

type Mode = "hand" | "eye";

interface CameraPopupProps {
  currentFen: string;
  onMove: (uciMove: string, source: "hand" | "eye") => void;
  isMoveLocked: () => boolean;
  onClose: () => void;
}

export function CameraPopup({ currentFen, onMove, isMoveLocked, onClose }: CameraPopupProps) {
  const [mode, setMode] = useState<Mode>("hand");

  return (
    <DraggableCameraWindow
      title={mode === "hand" ? "Hand Tracking" : "Eye Tracking"}
      color={mode === "hand" ? "text-green-400" : "text-cyan-400"}
      onClose={onClose}
    >
      {/* Mode tabs */}
      <div className="flex rounded-lg overflow-hidden border border-border/40 mb-2">
        <button
          onClick={() => setMode("hand")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
            mode === "hand" ? "bg-green-500/20 text-green-400" : "text-muted-foreground hover:bg-secondary/40"
          }`}
        >
          <Hand size={12} />
          Hand
        </button>
        <button
          onClick={() => setMode("eye")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
            mode === "eye" ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:bg-secondary/40"
          }`}
        >
          <Eye size={12} />
          Eye
        </button>
      </div>

      <HandCursorInput
        enabled={mode === "hand"}
        currentFen={currentFen}
        onSquareHover={() => {}}
        onSquareSelect={() => {}}
        onMove={onMove}
        isMoveLocked={isMoveLocked}
      />

      <EyeTrackingInput
        enabled={mode === "eye"}
        currentFen={currentFen}
        onSquareHover={() => {}}
        onSquareSelect={() => {}}
        onMove={onMove}
        isMoveLocked={isMoveLocked}
      />
    </DraggableCameraWindow>
  );
}
