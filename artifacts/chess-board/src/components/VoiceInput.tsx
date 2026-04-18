import { useEffect, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Mic, MicOff, AlertTriangle, Volume2 } from "lucide-react";

// Piece name synonyms for robust speech recognition
const PIECE_NAMES: Record<string, string> = {
  pawn: "p", pawns: "p", pond: "p", ponds: "p",
  knight: "n", night: "n", knife: "n", knights: "n", nights: "n",
  bishop: "b", bishops: "b",
  rook: "r", rooks: "r", look: "r",
  queen: "q", queens: "q",
  king: "k", kings: "k",
};

const FILES_SET = new Set(["a", "b", "c", "d", "e", "f", "g", "h"]);
const RANKS_SET = new Set(["1", "2", "3", "4", "5", "6", "7", "8"]);

// Normalize a transcript string to lowercase, clean punctuation
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract a square name from a two-token string like "e 4" or "e4"
function parseSquare(token: string): string | null {
  const s = token.replace(/\s+/g, "").toLowerCase();
  if (s.length === 2 && FILES_SET.has(s[0]) && RANKS_SET.has(s[1])) return s;
  return null;
}

// Extract two consecutive squares from an array of tokens starting at index
function extractSquares(tokens: string[], startIdx: number): [string, string] | null {
  // Try combined token like "e4" and "e5"
  for (let i = startIdx; i < tokens.length - 1; i++) {
    const sq1 = parseSquare(tokens[i]);
    const sq2 = parseSquare(tokens[i + 1]);
    if (sq1 && sq2) return [sq1, sq2];
    // Try "e 4 e 5" style — two letter+number pairs
    if (i + 3 < tokens.length) {
      const sq1b = parseSquare(tokens[i] + tokens[i + 1]);
      const sq2b = parseSquare(tokens[i + 2] + tokens[i + 3]);
      if (sq1b && sq2b) return [sq1b, sq2b];
    }
  }
  return null;
}

// Extract one square from token list starting at index
function extractOneSquare(tokens: string[], startIdx: number): string | null {
  for (let i = startIdx; i < tokens.length; i++) {
    const sq = parseSquare(tokens[i]);
    if (sq) return sq;
    if (i + 1 < tokens.length) {
      const sq2 = parseSquare(tokens[i] + tokens[i + 1]);
      if (sq2) return sq2;
    }
  }
  return null;
}

interface ParsedCommand {
  type: "move" | "castle-kingside" | "castle-queenside" | "unknown";
  from?: string;
  to?: string;
  pieceType?: string;
  raw: string;
}

function parseVoiceCommand(transcript: string): ParsedCommand {
  const raw = transcript;
  const t = normalize(transcript);
  const tokens = t.split(" ");

  // Castle kingside
  if (/castle\s*(king\s*side|short|king|0\s*0)/.test(t) || /\bo\s*o\b(?!\s*o)/.test(t)) {
    return { type: "castle-kingside", raw };
  }
  // Castle queenside
  if (/castle\s*(queen\s*side|long|queen|0\s*0\s*0)/.test(t) || /\bo\s*o\s*o\b/.test(t)) {
    return { type: "castle-queenside", raw };
  }

  // Detect piece name prefix
  let pieceType: string | undefined;
  let pieceIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (PIECE_NAMES[tokens[i]]) {
      pieceType = PIECE_NAMES[tokens[i]];
      pieceIdx = i;
      break;
    }
  }

  const startIdx = pieceIdx >= 0 ? pieceIdx + 1 : 0;

  // Skip filler words: "to", "from", "move", "at", "goes"
  const FILLERS = new Set(["to", "from", "move", "at", "goes", "takes", "captures", "on"]);
  const filtered = tokens.slice(startIdx).filter((tk) => !FILLERS.has(tk));

  // Try two-square pattern: e2 e4
  for (let i = 0; i < filtered.length - 1; i++) {
    const sq1 = parseSquare(filtered[i]);
    const sq2 = parseSquare(filtered[i + 1]);
    if (sq1 && sq2) {
      return { type: "move", from: sq1, to: sq2, pieceType, raw };
    }
    // split-token style: ["e", "2", "e", "4"]
    if (i + 3 < filtered.length) {
      const sq1b = parseSquare(filtered[i] + filtered[i + 1]);
      const sq2b = parseSquare(filtered[i + 2] + filtered[i + 3]);
      if (sq1b && sq2b) {
        return { type: "move", from: sq1b, to: sq2b, pieceType, raw };
      }
    }
  }

  // Try one-square pattern (piece to destination): "knight to g5"
  for (let i = 0; i < filtered.length; i++) {
    const sq = parseSquare(filtered[i]);
    if (sq) {
      return { type: "move", to: sq, pieceType, raw };
    }
    if (i + 1 < filtered.length) {
      const sq2 = parseSquare(filtered[i] + filtered[i + 1]);
      if (sq2) {
        return { type: "move", to: sq2, pieceType, raw };
      }
    }
  }

  return { type: "unknown", raw };
}

function resolveMove(cmd: ParsedCommand, fen: string): string | null {
  const chess = new Chess(fen);

  if (cmd.type === "castle-kingside") {
    const color = chess.turn();
    const kingFile = "e";
    const rank = color === "w" ? "1" : "8";
    const uci = `${kingFile}${rank}g${rank}`;
    try { const m = chess.move({ from: `${kingFile}${rank}` as any, to: `g${rank}` as any }); return m ? uci : null; } catch { return null; }
  }

  if (cmd.type === "castle-queenside") {
    const color = chess.turn();
    const rank = color === "w" ? "1" : "8";
    const uci = `e${rank}c${rank}`;
    try { const m = chess.move({ from: `e${rank}` as any, to: `c${rank}` as any }); return m ? uci : null; } catch { return null; }
  }

  if (cmd.type !== "move") return null;

  const legalMoves = chess.moves({ verbose: true });

  // Full from→to specified
  if (cmd.from && cmd.to) {
    const match = legalMoves.find(
      (m) => m.from === cmd.from && m.to === cmd.to &&
        (!cmd.pieceType || m.piece === cmd.pieceType)
    );
    if (!match) return null;
    return match.from + match.to + (match.promotion ? match.promotion : "");
  }

  // Only destination given — filter by piece type if given
  if (cmd.to) {
    const candidates = legalMoves.filter(
      (m) => m.to === cmd.to && (!cmd.pieceType || m.piece === cmd.pieceType)
    );
    if (candidates.length === 1) {
      const m = candidates[0];
      return m.from + m.to + (m.promotion ? m.promotion : "");
    }
    if (candidates.length > 1) return null; // ambiguous
  }

  return null;
}

interface FeedbackItem {
  id: number;
  text: string;
  type: "success" | "error" | "info";
}

interface VoiceInputProps {
  enabled: boolean;
  currentFen: string;
  onMove: (uciMove: string, source: "voice") => void;
  isMoveLocked: () => boolean;
}

export function VoiceInput({ enabled, currentFen, onMove, isMoveLocked }: VoiceInputProps) {
  const recognitionRef = useRef<any>(null);
  const currentFenRef = useRef(currentFen);
  const isMoveLocked_ = useRef(isMoveLocked);
  const feedbackCountRef = useRef(0);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [supported, setSupported] = useState(true);

  useEffect(() => { currentFenRef.current = currentFen; }, [currentFen]);
  useEffect(() => { isMoveLocked_.current = isMoveLocked; }, [isMoveLocked]);

  const addFeedback = useCallback((text: string, type: FeedbackItem["type"]) => {
    const id = ++feedbackCountRef.current;
    setFeedbackItems((prev) => [{ id, text, type }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setFeedbackItems((prev) => prev.filter((f) => f.id !== id));
    }, 4000);
  }, []);

  const handleTranscript = useCallback((text: string) => {
    setTranscript(text);
    if (!text.trim()) return;
    if (isMoveLocked_.current()) {
      addFeedback("Move locked — please wait.", "info");
      return;
    }
    const cmd = parseVoiceCommand(text);
    if (cmd.type === "unknown") {
      addFeedback(`Could not parse: "${text}"`, "error");
      return;
    }
    const uci = resolveMove(cmd, currentFenRef.current);
    if (!uci) {
      const desc = cmd.type === "move"
        ? cmd.from && cmd.to
          ? `${cmd.from}→${cmd.to}`
          : cmd.to
          ? `to ${cmd.to}`
          : "?"
        : cmd.type;
      addFeedback(`Illegal move: ${desc}`, "error");
      return;
    }
    addFeedback(`Moving ${uci.slice(0, 2)}→${uci.slice(2, 4)}`, "success");
    onMove(uci, "voice");
  }, [addFeedback, onMove]);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) setTranscript(interim);
      if (final) handleTranscript(final.trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        addFeedback("Microphone permission denied.", "error");
        setIsListening(false);
      } else if (event.error === "no-speech") {
        // silently ignore
      } else {
        addFeedback(`Mic error: ${event.error}`, "error");
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch {}
      }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      addFeedback("Failed to start microphone.", "error");
    }
  }, [handleTranscript, addFeedback]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.stop(); } catch {}
    }
    setIsListening(false);
    setTranscript("");
  }, []);

  useEffect(() => {
    if (!enabled) stopListening();
    return () => stopListening();
  }, [enabled, stopListening]);

  if (!enabled) return null;

  if (!supported) {
    return (
      <div className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-700/40 rounded-lg text-xs text-red-400">
        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
        <div>Voice control is not supported in this browser. Try Chrome or Edge.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            isListening
              ? "bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30"
              : "bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          {isListening ? <Mic size={12} className="animate-pulse" /> : <MicOff size={12} />}
          {isListening ? "Listening…" : "Start Listening"}
        </button>

        {isListening && (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-rose-400 animate-bounce"
                style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Live transcript */}
      {isListening && (
        <div className="min-h-[28px] px-2 py-1 bg-secondary/30 border border-border/40 rounded text-xs font-mono text-muted-foreground italic leading-snug">
          {transcript || 'Say something like "knight f3 to g5" or "e2 to e4"…'}
        </div>
      )}

      {/* Feedback log */}
      <div className="flex flex-col gap-1">
        {feedbackItems.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border transition-all ${
              item.type === "success"
                ? "bg-green-900/25 border-green-700/40 text-green-400"
                : item.type === "error"
                ? "bg-red-900/20 border-red-700/40 text-red-400"
                : "bg-secondary/30 border-border/40 text-muted-foreground"
            }`}
          >
            <Volume2 size={10} className="shrink-0" />
            {item.text}
          </div>
        ))}
      </div>

      {/* Command reference */}
      {isListening && (
        <div className="text-[9px] text-muted-foreground/50 leading-relaxed">
          <span className="font-semibold not-italic text-muted-foreground/70">Commands: </span>
          "e2 to e4" · "knight f3 to g5" · "pawn to e4" · "castle kingside"
        </div>
      )}
    </div>
  );
}
