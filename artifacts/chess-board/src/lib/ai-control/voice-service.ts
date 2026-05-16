import { commandRegistry } from "./command-registry";

export type VoiceStatus = "idle" | "listening" | "processing" | "error" | "unsupported";

type Unsubscribe = () => void;

const SR: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
    : null;

export class VoiceService {
  private rec: any = null;
  private _active = false;
  private _status: VoiceStatus = "idle";
  private _restartTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastFinal = "";

  private _transcriptListeners: Array<(t: string, isFinal: boolean) => void> = [];
  private _statusListeners: Array<(s: VoiceStatus) => void> = [];
  private _commandListeners: Array<(cmd: string) => void> = [];

  get isSupported() { return !!SR; }
  get isActive() { return this._active; }
  get status() { return this._status; }

  onTranscript(fn: (t: string, isFinal: boolean) => void): Unsubscribe {
    this._transcriptListeners.push(fn);
    return () => { this._transcriptListeners = this._transcriptListeners.filter((f) => f !== fn); };
  }

  onStatus(fn: (s: VoiceStatus) => void): Unsubscribe {
    this._statusListeners.push(fn);
    return () => { this._statusListeners = this._statusListeners.filter((f) => f !== fn); };
  }

  onCommand(fn: (cmd: string) => void): Unsubscribe {
    this._commandListeners.push(fn);
    return () => { this._commandListeners = this._commandListeners.filter((f) => f !== fn); };
  }

  start() {
    if (!SR) { this._setStatus("unsupported"); return; }
    if (this._active) return;
    this._active = true;
    this._boot();
  }

  stop() {
    this._active = false;
    if (this._restartTimer) clearTimeout(this._restartTimer);
    this.rec?.abort();
    this.rec = null;
    this._setStatus("idle");
  }

  private _setStatus(s: VoiceStatus) {
    this._status = s;
    this._statusListeners.forEach((fn) => fn(s));
  }

  private _boot() {
    if (!this._active || !SR) return;
    const rec = new SR();
    this.rec = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onstart = () => this._setStatus("listening");

    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this._setStatus("error");
        this._active = false;
      } else if (this._active) {
        this._scheduleRestart();
      }
    };

    rec.onend = () => {
      if (this._active) this._scheduleRestart();
    };

    rec.onresult = (e: any) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += text;
        else interim += text;
      }

      if (interim) {
        this._transcriptListeners.forEach((fn) => fn(interim.trim(), false));
      }

      if (finalText) {
        const clean = finalText.trim().toLowerCase();
        if (clean && clean !== this._lastFinal) {
          this._lastFinal = clean;
          this._transcriptListeners.forEach((fn) => fn(finalText.trim(), true));
          this._commandListeners.forEach((fn) => fn(clean));
          this._setStatus("processing");
          commandRegistry.match(clean);
          setTimeout(() => { if (this._active) this._setStatus("listening"); }, 700);
        }
      }
    };

    try { rec.start(); } catch { this._scheduleRestart(); }
  }

  private _scheduleRestart() {
    this._restartTimer = setTimeout(() => this._boot(), 900);
  }
}

export const voiceService = new VoiceService();
