/**
 * useMemeAudio — React hook for Tunisian Meme Voice Mode
 *
 * Returns a `play(event)` function that respects the meme mode toggle
 * and current volume from user preferences.
 *
 * Usage:
 *   const { play } = useMemeAudio();
 *   play("check");           // plays meme check reaction
 *   play("queen-capture");   // etc.
 */

import { useCallback, useEffect, useState } from "react";
import { memeAudioManager } from "@/lib/meme-audio/audio-manager";
import type { MemeEvent } from "@/lib/meme-audio/synth-reactions";
import { usePreferences } from "./use-preferences";

export type { MemeEvent };

export function useMemeAudio() {
  const { memeMode, memeVolume } = usePreferences();
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync volume whenever preferences change
  useEffect(() => {
    memeAudioManager.setVolume(memeVolume);
  }, [memeVolume]);

  // Subscribe to the isPlaying signal (drives speaker animation)
  useEffect(() => {
    memeAudioManager.onPlaying(setIsPlaying);
    return () => {
      memeAudioManager.onPlaying(() => {});
    };
  }, []);

  const play = useCallback(
    (event: MemeEvent) => {
      if (!memeMode) return;
      memeAudioManager.setVolume(memeVolume);
      memeAudioManager.play(event);
    },
    [memeMode, memeVolume]
  );

  const stop = useCallback(() => {
    memeAudioManager.stop();
  }, []);

  return { play, stop, isPlaying };
}

// ── Shared material counter (used for blunder detection) ──────────────────────

const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

/**
 * Count total material for a given side from a FEN string.
 * Used to detect blunders (significant material loss after opponent's move).
 */
export function countMaterial(fen: string, color: "w" | "b"): number {
  // Parse the piece placement part of FEN
  const placement = fen.split(" ")[0];
  let total = 0;
  for (const ch of placement) {
    const isWhite = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
    const pieceColor = isWhite ? "w" : "b";
    if (pieceColor !== color) continue;
    const val = PIECE_VALUES[ch.toLowerCase()];
    if (val !== undefined) total += val;
  }
  return total;
}
