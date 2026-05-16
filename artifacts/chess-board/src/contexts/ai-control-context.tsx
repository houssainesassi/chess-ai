import {
  createContext, useContext, useState, useEffect, useCallback,
  useRef, ReactNode,
} from "react";
import { voiceService, VoiceStatus } from "@/lib/ai-control/voice-service";
import { commandRegistry } from "@/lib/ai-control/command-registry";
import { platform } from "@/lib/ai-control/platform-adapter";
import { useLocation } from "wouter";

export interface CursorPos { x: number; y: number }

export type InputMode = "voice" | "gesture" | "gaze";

interface AIControlState {
  voiceEnabled: boolean;
  gestureEnabled: boolean;
  gazeEnabled: boolean;
  voiceStatus: VoiceStatus;
  cameraStatus: "idle" | "loading" | "ready" | "error";
  cameraError: string | null;
  cursor: CursorPos | null;
  dwellProgress: number;
  isPinching: boolean;
  transcript: string;
  commandHistory: string[];
  platform: typeof platform;

  toggleVoice: () => void;
  toggleGesture: () => void;
  toggleGaze: () => void;
  reportCursor: (pos: CursorPos | null) => void;
  reportDwell: (progress: number) => void;
  reportPinch: (pinching: boolean) => void;
  reportCameraStatus: (s: "idle" | "loading" | "ready" | "error", err?: string) => void;
  triggerClick: (pos: CursorPos) => void;
}

const Ctx = createContext<AIControlState | null>(null);

export function AIControlProvider({ children }: { children: ReactNode }) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gazeEnabled, setGazeEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [cameraStatus, setCameraStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<CursorPos | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [isPinching, setIsPinching] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [, navigate] = useLocation();

  // Register navigation handler once
  useEffect(() => {
    commandRegistry.registerNavigation(navigate);
  }, [navigate]);

  // Voice service listeners
  useEffect(() => {
    const unStat = voiceService.onStatus(setVoiceStatus);
    const unTrans = voiceService.onTranscript((t, isFinal) => {
      setTranscript(t);
      if (isFinal) {
        setCommandHistory((prev) => [t, ...prev].slice(0, 8));
        setTimeout(() => setTranscript(""), 2000);
      }
    });
    return () => { unStat(); unTrans(); };
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => {
      if (v) { voiceService.stop(); return false; }
      voiceService.start();
      return true;
    });
  }, []);

  const toggleGesture = useCallback(() => {
    setGestureEnabled((v) => {
      if (v) { setCursor(null); setDwellProgress(0); setIsPinching(false); }
      return !v;
    });
  }, []);

  const toggleGaze = useCallback(() => {
    setGazeEnabled((v) => {
      if (v) { setCursor(null); setDwellProgress(0); }
      return !v;
    });
  }, []);

  const reportCursor = useCallback((pos: CursorPos | null) => setCursor(pos), []);
  const reportDwell = useCallback((p: number) => setDwellProgress(p), []);
  const reportPinch = useCallback((p: boolean) => setIsPinching(p), []);
  const reportCameraStatus = useCallback((s: typeof cameraStatus, err?: string) => {
    setCameraStatus(s);
    setCameraError(err ?? null);
  }, []);

  const triggerClick = useCallback((pos: CursorPos) => {
    const el = document.elementFromPoint(pos.x, pos.y) as HTMLElement | null;
    if (!el) return;
    el.click();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus();
    setCommandHistory((prev) => [`[click @ ${Math.round(pos.x)},${Math.round(pos.y)}]`, ...prev].slice(0, 8));
  }, []);

  return (
    <Ctx.Provider
      value={{
        voiceEnabled, gestureEnabled, gazeEnabled,
        voiceStatus, cameraStatus, cameraError,
        cursor, dwellProgress, isPinching,
        transcript, commandHistory, platform,
        toggleVoice, toggleGesture, toggleGaze,
        reportCursor, reportDwell, reportPinch, reportCameraStatus, triggerClick,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAIControl() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAIControl must be used inside AIControlProvider");
  return ctx;
}
