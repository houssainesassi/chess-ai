/**
 * Tunisian Meme Voice Mode — Synthesized Reactions
 *
 * Pure Web Audio API sounds, one per event type.
 * Used as fallback when no real mp3/wav files are present.
 * Each function accepts a running AudioContext and a volume (0–1).
 */

export type MemeEvent =
  | "queen-capture"
  | "check"
  | "checkmate"
  | "illegal-move"
  | "win"
  | "lose"
  | "blunder"
  | "promotion";

// ── Low-level helpers ─────────────────────────────────────────────────────────

function osc(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  gain: number,
  start: number,
  duration: number,
  freqEnd?: number
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (freqEnd !== undefined)
    o.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + start + duration);
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + duration + 0.02);
}

function noise(
  ctx: AudioContext,
  filterFreq: number,
  filterType: BiquadFilterType,
  gain: number,
  start: number,
  duration: number
) {
  const n = ctx.sampleRate * (duration + 0.05);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start(ctx.currentTime + start);
  src.stop(ctx.currentTime + start + duration + 0.05);
}

// ── Synthesized reactions by event ───────────────────────────────────────────

export const SYNTH_REACTIONS: Record<MemeEvent, (ctx: AudioContext, vol: number) => void> = {

  /** Queen captured — dramatic shocked gasp: HIGH SHRIEK → pause → BOOM */
  "queen-capture": (ctx, vol) => {
    // Shriek up
    osc(ctx, "sawtooth", 400, vol * 0.5, 0,    0.12, 1800);
    osc(ctx, "sawtooth", 500, vol * 0.3, 0,    0.12, 2200);
    // Brief silence, then dramatic boom
    noise(ctx, 120, "lowpass", vol * 0.9, 0.20, 0.30);
    osc(ctx, "sine",     80,  vol * 0.8, 0.20, 0.30,  40);
    // "Dun dun DUN" finale
    osc(ctx, "sawtooth", 200, vol * 0.5, 0.55, 0.15);
    osc(ctx, "sawtooth", 150, vol * 0.5, 0.73, 0.15);
    osc(ctx, "sawtooth", 100, vol * 0.7, 0.92, 0.30);
  },

  /** Check — sharp alarm trill */
  "check": (ctx, vol) => {
    const freqs = [880, 1100, 880, 1320];
    freqs.forEach((f, i) => osc(ctx, "square", f, vol * 0.28, i * 0.10, 0.09));
    noise(ctx, 2000, "bandpass", vol * 0.15, 0, 0.35);
  },

  /** Checkmate — deep ominous descending drone */
  "checkmate": (ctx, vol) => {
    const steps = [300, 250, 200, 160, 120];
    steps.forEach((f, i) => osc(ctx, "sawtooth", f, vol * 0.55, i * 0.18, 0.20, f * 0.75));
    noise(ctx, 80, "lowpass", vol * 0.6, 0, 1.0);
    // Bell toll
    osc(ctx, "sine", 440, vol * 0.6, 0.05, 0.8, 200);
    osc(ctx, "sine", 220, vol * 0.4, 0.10, 0.8, 100);
  },

  /** Illegal move — harsh buzzer error */
  "illegal-move": (ctx, vol) => {
    osc(ctx, "sawtooth", 180, vol * 0.7, 0,    0.08, 160);
    osc(ctx, "sawtooth", 160, vol * 0.7, 0.09, 0.08, 140);
    osc(ctx, "sawtooth", 140, vol * 0.8, 0.18, 0.12, 120);
    noise(ctx, 300, "bandpass", vol * 0.4, 0, 0.30);
  },

  /** Win — triumphant ascending fanfare */
  "win": (ctx, vol) => {
    const melody = [
      { f: 440, s: 0.00, d: 0.15 },
      { f: 550, s: 0.16, d: 0.15 },
      { f: 660, s: 0.32, d: 0.15 },
      { f: 880, s: 0.48, d: 0.30 },
      { f: 1100, s: 0.80, d: 0.50 },
    ];
    melody.forEach(({ f, s, d }) => {
      osc(ctx, "sine",     f,       vol * 0.55, s, d);
      osc(ctx, "triangle", f * 2,   vol * 0.20, s, d);
    });
    noise(ctx, 4000, "highpass", vol * 0.12, 0.48, 0.80);
  },

  /** Lose — sad trombone: wah wah wah waaah */
  "lose": (ctx, vol) => {
    const wah = [
      { f: 480, fe: 380, s: 0.00, d: 0.22 },
      { f: 420, fe: 320, s: 0.24, d: 0.22 },
      { f: 360, fe: 260, s: 0.48, d: 0.22 },
      { f: 300, fe: 160, s: 0.72, d: 0.50 },
    ];
    wah.forEach(({ f, fe, s, d }) => {
      osc(ctx, "sawtooth", f, vol * 0.55, s, d, fe);
      osc(ctx, "sine",     f * 0.5, vol * 0.25, s, d, fe * 0.5);
    });
  },

  /** Blunder — comic "OOF" descending wow */
  "blunder": (ctx, vol) => {
    // Descending "wow" whistle
    osc(ctx, "sine",     900, vol * 0.55, 0,    0.35, 200);
    osc(ctx, "triangle", 800, vol * 0.35, 0.02, 0.33, 180);
    // Impact thud
    noise(ctx, 100, "lowpass", vol * 0.70, 0.36, 0.25);
    osc(ctx, "sine", 80, vol * 0.60, 0.36, 0.25, 40);
    // Vibrato wobble at end
    osc(ctx, "sine", 150, vol * 0.30, 0.62, 0.30, 140);
  },

  /** Promotion — magic sparkle ascending arpeggio */
  "promotion": (ctx, vol) => {
    const magic = [262, 330, 392, 523, 659, 784, 1047];
    magic.forEach((f, i) => {
      osc(ctx, "sine",     f,     vol * 0.45, i * 0.08, 0.25);
      osc(ctx, "triangle", f * 2, vol * 0.18, i * 0.08, 0.22);
    });
    noise(ctx, 6000, "highpass", vol * 0.10, 0, 0.70);
    // Triumphant chord at end
    [523, 659, 784].forEach((f, i) =>
      osc(ctx, "sine", f, vol * 0.30, 0.60 + i * 0.02, 0.50)
    );
  },
};
