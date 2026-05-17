/**
 * MemeReaction — animated overlay for Tunisian Meme Voice Mode
 *
 * Two components:
 *  1. <SpeakerAnimation />  — small pulsing speaker badge (shown while audio plays)
 *  2. <MemeReactionToast /> — big emoji + funny text, briefly shown on events
 *
 * Usage:
 *   const { showReaction } = useMemeReaction();
 *   showReaction("check");
 *
 *   <SpeakerAnimation isPlaying={isPlaying} />
 *   <MemeReactionToast {...reactionState} />
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Volume2 } from "lucide-react";
import type { MemeEvent } from "@/lib/meme-audio/synth-reactions";

// ── Reaction text library ─────────────────────────────────────────────────────
// Tunisian / Franco-Arab meme style — mix of Tunisian dialect, French, and emoji

const REACTIONS: Record<MemeEvent, Array<{ emoji: string; text: string }>> = {
  "queen-capture": [
    { emoji: "🤯", text: "YA REBBI!! القطعة الكبيرة!" },
    { emoji: "😱", text: "WQATLOUHA!! وقتلوها!!" },
    { emoji: "💀", text: "LA DAME EST MORTE RIP 👸" },
    { emoji: "🫠", text: "MAKAANCH SAHBI.. الوزيرة راحت" },
    { emoji: "🔥", text: "AHHHH YAAAALI القطعة القطعة!!" },
  ],
  "check": [
    { emoji: "⚠️", text: "ÉCHEC! الكش كش!" },
    { emoji: "😤", text: "KACH KACH يا خويا!" },
    { emoji: "🚨", text: "ATTENTION SAHBI — ÉCHEC!" },
    { emoji: "😰", text: "الملك في خطر — BARRA!" },
    { emoji: "🎯", text: "KACH!! طيّح الملك!" },
  ],
  "checkmate": [
    { emoji: "💀", text: "ÉCHEC ET MAT!! الكش مات!" },
    { emoji: "👑", text: "GAME OVER SAHBI يا حسرة" },
    { emoji: "🎭", text: "MAT MAT MAT — INTAHA!" },
    { emoji: "😂", text: "YALAAAAH انتهت اللعبة!" },
    { emoji: "🪦", text: "RIP SAHBI.. الملك مات" },
  ],
  "illegal-move": [
    { emoji: "❌", text: "HRAM! هذه حركة ممنوعة يا خويا" },
    { emoji: "🤦", text: "MAYNAJMCH! — حركة غلط!" },
    { emoji: "🚫", text: "INTERDIT YA 3AMI! ما يصحش" },
    { emoji: "😤", text: "WACH HADA?! حركة مش قانونية" },
    { emoji: "🤌", text: "Ya3mlek ILLEGAL MOVE sahbi!!" },
  ],
  "win": [
    { emoji: "🏆", text: "CHKOUN BHALOU!! VICTOIRE!" },
    { emoji: "🎉", text: "WALLAH ZEBI!! ربحت يا بطل" },
    { emoji: "🕺", text: "WINNER WINNER طجين DINNER!" },
    { emoji: "😎", text: "MABROUK!! كنت الأحسن" },
    { emoji: "👑", text: "SULTAN SAHBI — انت ربحت!!" },
  ],
  "lose": [
    { emoji: "😭", text: "MAZAL MEZAL.. خسرت يا حبيبي" },
    { emoji: "🤏", text: "MAKASCH ZOUINA — خسرنا" },
    { emoji: "😔", text: "PROCHAINE FOIS SAHBI.. تعلّم" },
    { emoji: "💔", text: "YA HASSRA.. كان يمكن" },
    { emoji: "🫂", text: "MEFTENICH — المرة الجاية نكسبوا" },
  ],
  "blunder": [
    { emoji: "🤦", text: "GAALO 3LA RASOU!! بلندر كبير" },
    { emoji: "😱", text: "YAAAALI YAALI — غلطة كبيرة!!" },
    { emoji: "💸", text: "SAHBI... خسرت قطعة كبيرة!" },
    { emoji: "🫠", text: "WACH SAWIT?! BLUNDER SAHBI" },
    { emoji: "🤌", text: "Mish normal hadhi — بلندر" },
  ],
  "promotion": [
    { emoji: "👑", text: "MABROUK!! الوزيرة جاءت!" },
    { emoji: "🎊", text: "PROMOTED SAHBI — QUEEN!" },
    { emoji: "✨", text: "NJAMET — البيدق وصل!" },
    { emoji: "🕺", text: "PROMOTION MADAME الوزيرة!" },
    { emoji: "🌟", text: "YA BEHI!! ترقية ملكية!" },
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── 1. Speaker animation ───────────────────────────────────────────────────────

interface SpeakerAnimationProps {
  isPlaying: boolean;
  className?: string;
}

export function SpeakerAnimation({ isPlaying, className = "" }: SpeakerAnimationProps) {
  if (!isPlaying) return null;
  return (
    <div
      className={`fixed bottom-20 right-4 z-50 flex items-center gap-1.5 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm pointer-events-none ${className}`}
      style={{ animation: "meme-speaker-in 0.2s ease-out" }}
    >
      {/* Animated sound waves */}
      <div className="relative flex items-center gap-0.5">
        <Volume2 className="w-4 h-4" />
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block w-0.5 rounded-full bg-current"
            style={{
              height: `${8 + i * 4}px`,
              animation: `meme-wave 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <span className="text-xs font-bold tracking-wide">MEME</span>

      <style>{`
        @keyframes meme-wave {
          from { transform: scaleY(0.4); opacity: 0.5; }
          to   { transform: scaleY(1.0); opacity: 1.0; }
        }
        @keyframes meme-speaker-in {
          from { transform: scale(0.7) translateY(8px); opacity: 0; }
          to   { transform: scale(1.0) translateY(0px); opacity: 1; }
        }
        @keyframes meme-toast-in {
          0%   { transform: scale(0.6) translateY(30px); opacity: 0; }
          60%  { transform: scale(1.1) translateY(-4px); opacity: 1; }
          100% { transform: scale(1.0) translateY(0px);  opacity: 1; }
        }
        @keyframes meme-toast-out {
          from { transform: scale(1.0); opacity: 1; }
          to   { transform: scale(0.8) translateY(-20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── 2. Meme reaction toast ────────────────────────────────────────────────────

interface ReactionState {
  visible: boolean;
  emoji: string;
  text: string;
}

interface MemeReactionToastProps extends ReactionState {}

export function MemeReactionToast({ visible, emoji, text }: MemeReactionToastProps) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-[99990] pointer-events-none flex items-center justify-center"
      aria-hidden
    >
      <div
        className="flex flex-col items-center gap-2 px-8 py-5 rounded-3xl shadow-2xl backdrop-blur-md border border-white/20"
        style={{
          background: "rgba(20,20,20,0.85)",
          animation: "meme-toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
          maxWidth: "min(90vw, 360px)",
        }}
      >
        <span className="text-6xl leading-none drop-shadow-lg" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}>
          {emoji}
        </span>
        <span className="text-white font-extrabold text-center text-lg leading-snug drop-shadow">
          {text}
        </span>
      </div>
    </div>
  );
}

// ── 3. Hook to manage reaction state ─────────────────────────────────────────

export function useMemeReaction() {
  const [state, setState] = useState<ReactionState>({
    visible: false,
    emoji: "",
    text: "",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showReaction = useCallback((event: MemeEvent) => {
    const reactions = REACTIONS[event];
    if (!reactions?.length) return;
    const r = pickRandom(reactions);

    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ visible: true, emoji: r.emoji, text: r.text });

    // Auto-hide after 2.2 seconds
    timerRef.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false }));
    }, 2200);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { reactionState: state, showReaction };
}
