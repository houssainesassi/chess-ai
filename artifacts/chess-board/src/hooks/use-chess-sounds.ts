import { useCallback, useRef } from "react";
import type { SoundPackId } from "./use-settings";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

function playWoodMove(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.08);
  osc.type = "sine";
  osc.frequency.setValueAtTime(350, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.12);
  const noise = ctx.createOscillator();
  const ng = ctx.createGain();
  noise.type = "sawtooth"; noise.frequency.setValueAtTime(120, now);
  ng.gain.setValueAtTime(0.15, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  noise.connect(ng); ng.connect(ctx.destination); noise.start(now); noise.stop(now + 0.06);
}

function playWoodCapture(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
  filter.type = "lowpass"; filter.frequency.setValueAtTime(1200, now); filter.frequency.exponentialRampToValueAtTime(150, now + 0.15);
  osc.type = "sawtooth"; osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
  gain.gain.setValueAtTime(0.7, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.18);
  const thud = ctx.createOscillator(); const tg = ctx.createGain();
  thud.type = "sine"; thud.frequency.setValueAtTime(80, now); thud.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  tg.gain.setValueAtTime(0.6, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  thud.connect(tg); tg.connect(ctx.destination); thud.start(now); thud.stop(now + 0.1);
}

function playWoodCheck(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.1].forEach((offset) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(880 - offset * 200, now + offset);
    gain.gain.setValueAtTime(0.35, now + offset); gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now + offset); osc.stop(now + offset + 0.15);
  });
}

function playArcadeMove(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = "square"; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(660, now + 0.04);
  gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.1);
}

function playArcadeCapture(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(440, now + 0.03);
  osc.frequency.setValueAtTime(220, now + 0.06);
  gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.15);
}

function playArcadeCheck(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.08, 0.16].forEach((offset) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "square"; osc.frequency.setValueAtTime(880, now + offset);
    gain.gain.setValueAtTime(0.25, now + offset); gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now + offset); osc.stop(now + offset + 0.07);
  });
}

function playMinimalMove(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = "sine"; osc.frequency.setValueAtTime(600, now);
  gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.06);
}

function playMinimalCapture(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = "sine"; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
  gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.1);
}

function playMinimalCheck(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = "sine"; osc.frequency.setValueAtTime(750, now);
  gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.12);
}

function playSynthMove(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = "triangle"; osc.frequency.setValueAtTime(523, now); osc.frequency.linearRampToValueAtTime(659, now + 0.08);
  gain.gain.setValueAtTime(0.35, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.15);
}

function playSynthCapture(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = "sawtooth"; osc.frequency.setValueAtTime(330, now); osc.frequency.exponentialRampToValueAtTime(165, now + 0.12);
  gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.18);
  const mod = ctx.createOscillator(); const mg = ctx.createGain();
  mod.type = "sine"; mod.frequency.setValueAtTime(50, now);
  mg.gain.setValueAtTime(100, now); mg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  mod.connect(mg); mg.connect(osc.frequency); mod.start(now); mod.stop(now + 0.12);
}

function playSynthCheck(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.12].forEach((offset, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "triangle"; osc.frequency.setValueAtTime(i === 0 ? 659 : 880, now + offset);
    gain.gain.setValueAtTime(0.3, now + offset); gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now + offset); osc.stop(now + offset + 0.15);
  });
}

export function useChessSounds(soundPack: SoundPackId = "wood") {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current) ctxRef.current = getAudioContext();
    if (ctxRef.current?.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playMove = useCallback((isCapture: boolean, isCheck: boolean) => {
    const ctx = getCtx();
    if (!ctx) return;

    if (soundPack === "arcade") {
      isCapture ? playArcadeCapture(ctx) : playArcadeMove(ctx);
      if (isCheck) setTimeout(() => { if (ctxRef.current) playArcadeCheck(ctxRef.current); }, 120);
    } else if (soundPack === "minimal") {
      isCapture ? playMinimalCapture(ctx) : playMinimalMove(ctx);
      if (isCheck) setTimeout(() => { if (ctxRef.current) playMinimalCheck(ctxRef.current); }, 120);
    } else if (soundPack === "synth") {
      isCapture ? playSynthCapture(ctx) : playSynthMove(ctx);
      if (isCheck) setTimeout(() => { if (ctxRef.current) playSynthCheck(ctxRef.current); }, 120);
    } else {
      isCapture ? playWoodCapture(ctx) : playWoodMove(ctx);
      if (isCheck) setTimeout(() => { if (ctxRef.current) playWoodCheck(ctxRef.current); }, 120);
    }
  }, [getCtx, soundPack]);

  return { playMove };
}
