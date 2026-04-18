import { useState, useEffect, useCallback } from "react";

export type BoardThemeId =
  | "classic"
  | "walnut"
  | "ocean"
  | "midnight"
  | "rose"
  | "arctic"
  | "forest"
  | "sandstone"
  | "purple"
  | "coral";

export type PieceSetId =
  | "cburnett"
  | "merida"
  | "alpha"
  | "chess7"
  | "tatiana";

export type SoundPackId = "wood" | "arcade" | "minimal" | "synth";

export interface BoardTheme {
  id: BoardThemeId;
  label: string;
  light: string;
  dark: string;
}

export interface PieceSet {
  id: PieceSetId;
  label: string;
  preview: string;
}

export interface SoundPack {
  id: SoundPackId;
  label: string;
  description: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "classic",   label: "Classic",   light: "#EEEED2", dark: "#769656" },
  { id: "walnut",    label: "Walnut",    light: "#F0D9B5", dark: "#B58863" },
  { id: "ocean",     label: "Ocean",     light: "#DEE3E6", dark: "#8CA2AD" },
  { id: "midnight",  label: "Midnight",  light: "#B8CFC8", dark: "#4A7B6F" },
  { id: "rose",      label: "Rose",      light: "#F0D0C8", dark: "#C06060" },
  { id: "arctic",    label: "Arctic",    light: "#E8EEF0", dark: "#6B8FA8" },
  { id: "forest",    label: "Forest",    light: "#CDD8B0", dark: "#587048" },
  { id: "sandstone", label: "Sandstone", light: "#EBD8A8", dark: "#C8903A" },
  { id: "purple",    label: "Purple",    light: "#DDD0EC", dark: "#7A5BA0" },
  { id: "coral",     label: "Coral",     light: "#F5D8CC", dark: "#C07050" },
];

export const PIECE_SETS: PieceSet[] = [
  { id: "cburnett", label: "Classic",   preview: "https://lichess1.org/assets/piece/cburnett/wN.svg" },
  { id: "merida",   label: "Merida",    preview: "https://lichess1.org/assets/piece/merida/wN.svg" },
  { id: "alpha",    label: "Alpha",     preview: "https://lichess1.org/assets/piece/alpha/wN.svg" },
  { id: "chess7",   label: "Chess7",    preview: "https://lichess1.org/assets/piece/chess7/wN.svg" },
  { id: "tatiana",  label: "Tatiana",   preview: "https://lichess1.org/assets/piece/tatiana/wN.svg" },
];

export const SOUND_PACKS: SoundPack[] = [
  { id: "wood",    label: "Wood",     description: "Realistic wooden piece thud" },
  { id: "arcade",  label: "Arcade",   description: "Retro 8-bit game bleeps" },
  { id: "minimal", label: "Minimal",  description: "Soft subtle click" },
  { id: "synth",   label: "Synth",    description: "Electronic synth tones" },
];

const STORAGE_KEY = "chess-settings";

interface Settings {
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  soundPack: SoundPackId;
}

const DEFAULT_SETTINGS: Settings = {
  boardTheme: "classic",
  pieceSet: "cburnett",
  soundPack: "wood",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const boardThemeObj = BOARD_THEMES.find((t) => t.id === settings.boardTheme) ?? BOARD_THEMES[0];

  return { settings, updateSettings, boardThemeObj };
}
