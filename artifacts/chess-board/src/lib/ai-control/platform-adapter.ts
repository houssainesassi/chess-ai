export type OS = "linux" | "windows" | "macos" | "unknown";
export type BrowserType = "electron" | "brave" | "edge" | "chrome" | "chromium" | "other";

export interface PlatformInfo {
  os: OS;
  browser: BrowserType;
  isElectron: boolean;
  speechSupported: boolean;
  cameraSupported: boolean;
  mediaPipeSupported: boolean;
  linuxCameraNote: string | null;
}

export function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent.toLowerCase();
  const plat = (navigator.platform ?? "").toLowerCase();

  let os: OS = "unknown";
  if (plat.startsWith("linux") || ua.includes("linux")) os = "linux";
  else if (plat.startsWith("win") || ua.includes("windows")) os = "windows";
  else if (plat.startsWith("mac") || ua.includes("mac os")) os = "macos";

  const isElectron =
    !!(window as any).electronAPI ||
    ua.includes("electron") ||
    typeof (window as any).__ELECTRON__ !== "undefined";

  let browser: BrowserType = "other";
  if (isElectron) browser = "electron";
  else if ((navigator as any).brave != null) browser = "brave";
  else if (ua.includes("edg/")) browser = "edge";
  else if (ua.includes("chrome/") || ua.includes("chromium/")) browser = "chrome";

  const speechSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const cameraSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const mediaPipeSupported =
    cameraSupported && typeof WebAssembly !== "undefined";

  const linuxCameraNote =
    os === "linux"
      ? "On Linux, ensure your user is in the 'video' group and a v4l2 camera device is available."
      : null;

  return {
    os,
    browser,
    isElectron,
    speechSupported,
    cameraSupported,
    mediaPipeSupported,
    linuxCameraNote,
  };
}

export const platform = detectPlatform();
