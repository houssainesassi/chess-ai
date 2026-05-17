/**
 * Tunisian Meme Voice Mode — AudioManager
 *
 * Responsibilities:
 *  - Try to play mp3/wav from /audio/meme/{event}/ (auto-scanned via manifest)
 *  - Fall back to synthesized reactions (Web Audio API)
 *  - Prevent overlap: stops previous sound before starting next
 *  - Cooldown: minimum gap between any two sounds
 *  - Volume: 0–1 float, applied to both HTML Audio and synth gain
 *
 * Drop real audio files in:
 *   public/audio/meme/{event}/any-name.mp3
 * Then add them to MEME_AUDIO_FILES below (or they play synthetically).
 *
 * Auto-detection: add file names to the map below and the manager will
 * randomly pick one. No server endpoint required.
 */

import { SYNTH_REACTIONS, type MemeEvent } from "./synth-reactions";

// ── File manifest ─────────────────────────────────────────────────────────────
// Add real file names here (relative to /audio/meme/{event}/).
// Example: "queen-capture": ["yasrebi.mp3", "laarbi.mp3"]
// Leave empty [] to always use synthesized sounds.
const MEME_AUDIO_FILES: Record<MemeEvent, string[]> = {
  "queen-capture": [],
  "check":         [],
  "checkmate":     [],
  "illegal-move":  [],
  "win":           [],
  "lose":          [],
  "blunder":       [],
  "promotion":     [],
};

// ── Singleton manager ─────────────────────────────────────────────────────────

export class MemeAudioManager {
  private volume = 0.7;
  private cooldownMs = 800;
  private lastPlayedAt = 0;

  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;

  /** True while any sound is playing (used for speaker animation) */
  isPlaying = false;
  private onPlayingChange?: (v: boolean) => void;

  /** Register a callback for isPlaying state (drives the speaker animation) */
  onPlaying(cb: (v: boolean) => void) {
    this.onPlayingChange = cb;
  }

  private setPlaying(v: boolean) {
    this.isPlaying = v;
    this.onPlayingChange?.(v);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.currentAudio) this.currentAudio.volume = this.volume;
  }

  setCooldown(ms: number) {
    this.cooldownMs = ms;
  }

  /** Play a meme sound for the given event. Respects cooldown and no-overlap. */
  play(event: MemeEvent) {
    const now = Date.now();
    if (now - this.lastPlayedAt < this.cooldownMs) return;
    this.lastPlayedAt = now;

    this.stop(); // stop any currently playing sound

    const files = MEME_AUDIO_FILES[event] ?? [];
    if (files.length > 0) {
      this._playFile(event, files);
    } else {
      this._playSynth(event);
    }
  }

  /** Immediately stop any playing sound. */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.setPlaying(false);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private _playFile(event: MemeEvent, files: string[]) {
    const fileName = this._pickRandom(files);
    const url = `/audio/meme/${event}/${fileName}`;
    const audio = new Audio(url);
    audio.volume = this.volume;
    this.currentAudio = audio;
    this.setPlaying(true);

    audio.addEventListener("ended", () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.setPlaying(false);
      }
    });

    audio.play().catch(() => {
      // File not found or blocked — fall back to synth
      this.currentAudio = null;
      this.setPlaying(false);
      this._playSynth(event);
    });
  }

  private _playSynth(event: MemeEvent) {
    try {
      if (!this.audioCtx || this.audioCtx.state === "closed") {
        this.audioCtx = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }

      const fn = SYNTH_REACTIONS[event];
      if (!fn) return;

      this.setPlaying(true);
      fn(this.audioCtx, this.volume);

      // Estimate duration from the event type to clear isPlaying flag
      const durations: Record<MemeEvent, number> = {
        "queen-capture": 1300,
        "check":          400,
        "checkmate":     1200,
        "illegal-move":   400,
        "win":           1400,
        "lose":          1400,
        "blunder":        900,
        "promotion":     1200,
      };
      const dur = durations[event] ?? 1000;
      setTimeout(() => this.setPlaying(false), dur);
    } catch (e) {
      console.warn("[MemeAudio] synth playback failed", e);
    }
  }
}

/** Global singleton — import and use directly from the hook */
export const memeAudioManager = new MemeAudioManager();
