import { useState, useRef, useCallback } from "react";

// ── Board Themes ──────────────────────────────────────────────────────────────

export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
  coordOnLight: string;
  coordOnDark: string;
  highlight: string;
  lmLight: string;
  lmDark: string;
  dotColor: string;
  ringColor: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "classic-green",
    name: "Classic Green",
    light: "#eeeed2",
    dark: "#769656",
    coordOnLight: "#769656",
    coordOnDark: "#eeeed2",
    highlight: "rgba(246,246,105,0.68)",
    lmLight: "rgba(205,209,111,0.65)",
    lmDark: "rgba(170,162,58,0.75)",
    dotColor: "rgba(0,0,0,0.18)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "walnut",
    name: "Walnut",
    light: "#f0d9b5",
    dark: "#b58863",
    coordOnLight: "#b58863",
    coordOnDark: "#f0d9b5",
    highlight: "rgba(246,246,105,0.60)",
    lmLight: "rgba(206,210,107,0.60)",
    lmDark: "rgba(172,132,67,0.70)",
    dotColor: "rgba(0,0,0,0.20)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "ocean",
    name: "Ocean",
    light: "#dce9f0",
    dark: "#4a7fa0",
    coordOnLight: "#4a7fa0",
    coordOnDark: "#dce9f0",
    highlight: "rgba(120,200,255,0.60)",
    lmLight: "rgba(130,190,230,0.55)",
    lmDark: "rgba(60,130,170,0.65)",
    dotColor: "rgba(0,0,0,0.20)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "midnight",
    name: "Midnight",
    light: "#b0bac8",
    dark: "#3a4a6b",
    coordOnLight: "#3a4a6b",
    coordOnDark: "#b0bac8",
    highlight: "rgba(140,170,255,0.65)",
    lmLight: "rgba(100,130,200,0.50)",
    lmDark: "rgba(60,80,150,0.60)",
    dotColor: "rgba(255,255,255,0.25)",
    ringColor: "rgba(255,255,255,0.28)",
  },
  {
    id: "coral",
    name: "Coral Reef",
    light: "#fde8e0",
    dark: "#c05030",
    coordOnLight: "#c05030",
    coordOnDark: "#fde8e0",
    highlight: "rgba(255,220,100,0.65)",
    lmLight: "rgba(255,200,150,0.55)",
    lmDark: "rgba(190,80,40,0.60)",
    dotColor: "rgba(0,0,0,0.20)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "emerald",
    name: "Emerald",
    light: "#d4f5e4",
    dark: "#2e8b57",
    coordOnLight: "#2e8b57",
    coordOnDark: "#d4f5e4",
    highlight: "rgba(200,255,160,0.65)",
    lmLight: "rgba(160,235,190,0.60)",
    lmDark: "rgba(40,130,80,0.65)",
    dotColor: "rgba(0,0,0,0.18)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "purple",
    name: "Purple Haze",
    light: "#e8d5f5",
    dark: "#7a35a0",
    coordOnLight: "#7a35a0",
    coordOnDark: "#e8d5f5",
    highlight: "rgba(220,160,255,0.65)",
    lmLight: "rgba(200,150,240,0.55)",
    lmDark: "rgba(120,50,160,0.65)",
    dotColor: "rgba(0,0,0,0.20)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "slate",
    name: "Slate",
    light: "#dce2ea",
    dark: "#546e8a",
    coordOnLight: "#546e8a",
    coordOnDark: "#dce2ea",
    highlight: "rgba(180,210,255,0.65)",
    lmLight: "rgba(150,180,220,0.55)",
    lmDark: "rgba(70,100,140,0.60)",
    dotColor: "rgba(0,0,0,0.20)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "desert-gold",
    name: "Desert Gold",
    light: "#f5eccc",
    dark: "#c4a030",
    coordOnLight: "#c4a030",
    coordOnDark: "#f5eccc",
    highlight: "rgba(255,230,100,0.70)",
    lmLight: "rgba(240,215,130,0.60)",
    lmDark: "rgba(190,155,30,0.65)",
    dotColor: "rgba(0,0,0,0.20)",
    ringColor: "rgba(0,0,0,0.22)",
  },
  {
    id: "ice",
    name: "Ice",
    light: "#e0f2fa",
    dark: "#3a80bb",
    coordOnLight: "#3a80bb",
    coordOnDark: "#e0f2fa",
    highlight: "rgba(160,230,255,0.65)",
    lmLight: "rgba(130,210,240,0.55)",
    lmDark: "rgba(50,110,180,0.60)",
    dotColor: "rgba(0,0,0,0.20)",
    ringColor: "rgba(0,0,0,0.22)",
  },
];

// ── Sound Packs ───────────────────────────────────────────────────────────────

export interface SoundPack {
  id: string;
  name: string;
  emoji: string;
}

export const SOUND_PACKS: SoundPack[] = [
  { id: "classic",  name: "Classic",  emoji: "♟" },
  { id: "subtle",   name: "Subtle",   emoji: "🤫" },
  { id: "metal",    name: "Metal",    emoji: "⚙️" },
  { id: "digital",  name: "Digital",  emoji: "💾" },
  { id: "dramatic", name: "Dramatic", emoji: "🎭" },
  { id: "nature",   name: "Nature",   emoji: "🍃" },
  { id: "retro",    name: "Retro",    emoji: "👾" },
  { id: "piano",    name: "Piano",    emoji: "🎹" },
  { id: "minimal",  name: "Minimal",  emoji: "·" },
  { id: "silent",   name: "Silent",   emoji: "🔇" },
];

// ── Audio Engine ──────────────────────────────────────────────────────────────

type AudioCtxRef = AudioContext | null;

function noiseBuffer(ctx: AudioContext, duration = 0.06): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playOsc(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  volume: number,
  attack: number,
  duration: number,
  freqEnd?: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freqEnd !== undefined)
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration + 0.01);
}

function playNoise(
  ctx: AudioContext,
  filterFreq: number,
  filterQ: number,
  volume: number,
  duration: number,
  filterType: BiquadFilterType = "bandpass"
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration + 0.01);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

type SoundFn = (ctx: AudioCtxRef) => AudioCtxRef;

const SOUND_FNS: Record<string, {
  move: SoundFn;
  capture: SoundFn;
  check: SoundFn;
  gameEnd: SoundFn;
}> = {
  classic: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 900, 2.0, 0.55, 0.07);
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 600, 1.5, 0.80, 0.10);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 660, 0.35, 0.005, 0.12);
      setTimeout(() => playOsc(ctx, "sine", 880, 0.35, 0.005, 0.12), 130);
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      [440, 550, 660, 880].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "sine", f, 0.35, 0.01, 0.22), i * 140)
      );
      return ctx;
    },
  },

  subtle: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 1500, 3.0, 0.28, 0.05);
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 1200, 2.5, 0.40, 0.07);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 740, 0.18, 0.005, 0.10);
      setTimeout(() => playOsc(ctx, "sine", 980, 0.18, 0.005, 0.10), 110);
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      [392, 494, 587].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "sine", f, 0.20, 0.01, 0.20), i * 130)
      );
      return ctx;
    },
  },

  metal: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sawtooth", 180, 0.25, 0.003, 0.09, 90);
      playNoise(ctx, 3000, 6, 0.30, 0.06);
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sawtooth", 140, 0.40, 0.003, 0.14, 60);
      playNoise(ctx, 2500, 5, 0.45, 0.09);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sawtooth", 440, 0.35, 0.003, 0.15);
      setTimeout(() => playOsc(ctx, "sawtooth", 660, 0.35, 0.003, 0.15), 160);
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      [220, 330, 440, 660].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "sawtooth", f, 0.30, 0.005, 0.18), i * 150)
      );
      return ctx;
    },
  },

  digital: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "square", 440, 0.20, 0.002, 0.06);
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "square", 220, 0.30, 0.002, 0.09, 110);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      [880, 660, 880].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "square", f, 0.22, 0.002, 0.06), i * 80)
      );
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      [262, 330, 392, 523].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "square", f, 0.22, 0.002, 0.16), i * 120)
      );
      return ctx;
    },
  },

  dramatic: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 200, 1.0, 0.70, 0.14, "lowpass");
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 150, 0.8, 0.95, 0.20, "lowpass");
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 220, 0.50, 0.01, 0.30);
      playNoise(ctx, 300, 1.0, 0.40, 0.30, "lowpass");
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 110, 0.60, 0.02, 0.60);
      [220, 165, 130].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "sine", f, 0.40, 0.01, 0.35), i * 200 + 200)
      );
      return ctx;
    },
  },

  nature: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 2000, 0.5, 0.28, 0.09, "highpass");
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 1800, 0.4, 0.40, 0.12, "highpass");
      playNoise(ctx, 600, 1.2, 0.30, 0.10);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 523, 0.22, 0.01, 0.20);
      playNoise(ctx, 2000, 0.5, 0.22, 0.20, "highpass");
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      [392, 494, 587, 698].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "sine", f, 0.22, 0.02, 0.25), i * 180)
      );
      return ctx;
    },
  },

  retro: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "square", 660, 0.18, 0.002, 0.055, 440);
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "square", 330, 0.28, 0.002, 0.090, 165);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      [1320, 990, 1320].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "square", f, 0.20, 0.002, 0.055), i * 70)
      );
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => playOsc(ctx, "square", f, 0.20, 0.002, 0.14), i * 110)
      );
      return ctx;
    },
  },

  piano: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 523, 0.35, 0.008, 0.25);
      playOsc(ctx, "sine", 1046, 0.12, 0.008, 0.18);
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 440, 0.42, 0.008, 0.30);
      playOsc(ctx, "sine", 880, 0.15, 0.008, 0.22);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      [523, 659, 784].forEach((f, i) =>
        setTimeout(() => { playOsc(ctx, "sine", f, 0.30, 0.008, 0.22); playOsc(ctx, "sine", f * 2, 0.10, 0.008, 0.16); }, i * 120)
      );
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      [262, 330, 392, 523, 659].forEach((f, i) =>
        setTimeout(() => { playOsc(ctx, "sine", f, 0.32, 0.008, 0.28); playOsc(ctx, "sine", f * 2, 0.12, 0.008, 0.22); }, i * 130)
      );
      return ctx;
    },
  },

  minimal: {
    move: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 2500, 4, 0.10, 0.04);
      return ctx;
    },
    capture: (ctx) => {
      if (!ctx) return ctx;
      playNoise(ctx, 2000, 3, 0.15, 0.05);
      return ctx;
    },
    check: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 880, 0.10, 0.003, 0.08);
      return ctx;
    },
    gameEnd: (ctx) => {
      if (!ctx) return ctx;
      playOsc(ctx, "sine", 523, 0.12, 0.005, 0.20);
      return ctx;
    },
  },

  silent: {
    move: (ctx) => ctx,
    capture: (ctx) => ctx,
    check: (ctx) => ctx,
    gameEnd: (ctx) => ctx,
  },
};

// ── Storage keys ──────────────────────────────────────────────────────────────

const KEY_THEME = "chess_theme_id";
const KEY_SOUND = "chess_sound_id";

function load(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface Preferences {
  theme: BoardTheme;
  themeId: string;
  setThemeId: (id: string) => void;
  soundPackId: string;
  setSoundPackId: (id: string) => void;
  playMove: (isCapture?: boolean) => void;
  playCheck: () => void;
  playGameEnd: (won?: boolean) => void;
}

export function usePreferences(): Preferences {
  const [themeId, _setThemeId] = useState<string>(() => load(KEY_THEME, "classic-green"));
  const [soundPackId, _setSoundPackId] = useState<string>(() => load(KEY_SOUND, "classic"));
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      try { ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); }
      catch { return null; }
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const setThemeId = useCallback((id: string) => {
    _setThemeId(id);
    save(KEY_THEME, id);
  }, []);

  const setSoundPackId = useCallback((id: string) => {
    _setSoundPackId(id);
    save(KEY_SOUND, id);
  }, []);

  const fns = useCallback(
    () => SOUND_FNS[soundPackId] || SOUND_FNS.classic,
    [soundPackId]
  );

  const playMove = useCallback((isCapture = false) => {
    const ctx = getCtx();
    if (isCapture) fns().capture(ctx);
    else fns().move(ctx);
  }, [fns, getCtx]);

  const playCheck = useCallback(() => {
    fns().check(getCtx());
  }, [fns, getCtx]);

  const playGameEnd = useCallback((_won?: boolean) => {
    fns().gameEnd(getCtx());
  }, [fns, getCtx]);

  const theme = BOARD_THEMES.find((t) => t.id === themeId) ?? BOARD_THEMES[0];

  return { theme, themeId, setThemeId, soundPackId, setSoundPackId, playMove, playCheck, playGameEnd };
}
