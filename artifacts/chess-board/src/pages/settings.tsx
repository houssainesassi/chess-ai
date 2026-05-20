import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Save, User, Volume2, Laugh, Mic2, Mic, MicOff, Hand, Eye, Activity, MonitorCheck } from "lucide-react";
import { useLocation } from "wouter";
import { usePreferences, BOARD_THEMES, SOUND_PACKS } from "@/hooks/use-preferences";
import { useMemeAudio } from "@/hooks/use-meme-audio";
import type { MemeEvent } from "@/lib/meme-audio/synth-reactions";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAIControl } from "@/contexts/ai-control-context";

const AVATAR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

const COUNTRIES = [
  "Algeria","Argentina","Australia","Belgium","Brazil","Canada","Chile","China",
  "Colombia","Egypt","France","Germany","India","Indonesia","Italy","Japan",
  "Mexico","Morocco","Netherlands","Nigeria","Pakistan","Poland","Portugal",
  "Russia","Saudi Arabia","South Africa","South Korea","Spain","Turkey",
  "Ukraine","United Kingdom","United States","Vietnam","Other",
];

export default function SettingsPage() {
  const { user, token, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const {
    theme, themeId, setThemeId,
    soundPackId, setSoundPackId,
    playMove, playCheck,
    memeMode, setMemeMode,
    memeVolume, setMemeVolume,
    commentatorMode, setCommentatorMode,
  } = usePreferences();
  const {
    showPopup, setShowPopup,
    voiceEnabled, gestureEnabled, gazeEnabled,
    voiceStatus, cameraStatus,
    toggleVoice, toggleGesture, toggleGaze,
    platform,
  } = useAIControl();
  const { play: playMeme } = useMemeAudio();

  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("Other");
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!token) return;
      try {
        const profile = await api.getMyProfile(token);
        setNickname(profile.nickname);
        setFullName(profile.fullName || "");
        setCountry(profile.country || "Other");
        setCity(profile.city || "");
        setAge(profile.age != null ? String(profile.age) : "");
        setBio(profile.bio || "");
        setAvatarColor(profile.avatarColor || AVATAR_COLORS[0]);
      } catch (_) {
        setNickname(user?.username || "");
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, [token]);

  const saveProfile = async () => {
    if (!token) return;
    if (!nickname.trim()) {
      toast({ title: "Nickname is required", variant: "destructive" });
      return;
    }
    setSaveLoading(true);
    try {
      await api.saveProfile(token, {
        nickname: nickname.trim(),
        fullName: fullName.trim() || undefined,
        country,
        city: city.trim() || undefined,
        age: age ? Number(age) : undefined,
        bio: bio.trim() || undefined,
        avatarColor,
      });
      toast({ title: "Profile saved successfully" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to save profile", variant: "destructive" });
    } finally {
      setSaveLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (!token) return;
    try {
      await api.deleteAccount(token);
      logout();
      setLocation("/");
    } catch (err: any) {
      toast({ title: err.message || "Failed to delete account", variant: "destructive" });
    }
  };

  const initials = (nickname || user?.username || "?").charAt(0).toUpperCase();

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* ── Profile ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Customize how other players see you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {profileLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0 transition-colors duration-200"
                  style={{ background: avatarColor }}
                >
                  {initials}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Avatar Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`w-7 h-7 rounded-full transition-all ${avatarColor === c ? "ring-2 ring-offset-2 ring-offset-card ring-primary scale-110" : "hover:scale-105"}`}
                        style={{ background: c }}
                        onClick={() => setAvatarColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Magnus Carlsen"
                  maxLength={64}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Display Name</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your display name"
                  maxLength={32}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">This name is shown to other players</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Tunis"
                    maxLength={64}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="age">Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="age"
                    type="number"
                    min={6}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="25"
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Chess enthusiast, e4 player..."
                  maxLength={200}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background text-sm text-foreground px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Account</Label>
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{user?.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </div>

              <Button onClick={saveProfile} disabled={saveLoading} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {saveLoading ? "Saving..." : "Save Profile"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Board Theme ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Board Theme</CardTitle>
          <CardDescription>Choose the look of your chess board</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                  themeId === t.id ? "border-primary shadow-md" : "border-border hover:border-primary/40"
                }`}
              >
                {/* Mini board preview */}
                <div className="w-full aspect-square max-w-[72px] grid grid-cols-4 grid-rows-4 rounded overflow-hidden shadow">
                  {Array.from({ length: 16 }, (_, idx) => {
                    const row = Math.floor(idx / 4);
                    const col = idx % 4;
                    const isLight = (row + col) % 2 === 0;
                    return (
                      <div
                        key={idx}
                        style={{ background: isLight ? t.light : t.dark }}
                      />
                    );
                  })}
                </div>
                <span className={`text-xs font-medium ${themeId === t.id ? "text-primary" : "text-muted-foreground"}`}>
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Sound Pack ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Sound Pack
          </CardTitle>
          <CardDescription>Choose how pieces sound when they move</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SOUND_PACKS.map((sp) => (
              <button
                key={sp.id}
                onClick={() => {
                  setSoundPackId(sp.id);
                  playMove();
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${
                  soundPackId === sp.id ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-2xl leading-none">{sp.emoji}</span>
                <div>
                  <p className={`text-sm font-medium ${soundPackId === sp.id ? "text-primary" : ""}`}>{sp.name}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => playMove()}
              className="flex items-center gap-2"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Preview Move
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => playMove(true)}
              className="flex items-center gap-2"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Preview Capture
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => playCheck()}
              className="flex items-center gap-2"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Preview Check
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Meme Mode ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laugh className="w-5 h-5 text-yellow-400" />
            Tunisian Meme Voice Mode
          </CardTitle>
          <CardDescription>
            Plays funny audio reactions during key moments — queen captures, blunders, checkmate and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* ON / OFF toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="font-medium text-sm">Enable Meme Mode</p>
              <p className="text-xs text-muted-foreground">Reactions play for check, captures, wins&hellip;</p>
            </div>
            <Switch
              checked={memeMode}
              onCheckedChange={setMemeMode}
              aria-label="Toggle meme mode"
            />
          </div>

          {/* Volume slider */}
          <div className={`space-y-2 transition-opacity ${memeMode ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Volume</Label>
              <span className="text-xs text-muted-foreground font-mono">{Math.round(memeVolume * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[memeVolume]}
              onValueChange={([v]) => setMemeVolume(v)}
            />
          </div>

          {/* Preview buttons */}
          <div className={`space-y-2 transition-opacity ${memeMode ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <Label className="text-sm text-muted-foreground">Preview Reactions</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { event: "check"         as MemeEvent, label: "Check",        emoji: "⚠️" },
                  { event: "queen-capture" as MemeEvent, label: "Queen Cap.",   emoji: "🤯" },
                  { event: "checkmate"     as MemeEvent, label: "Checkmate",    emoji: "💀" },
                  { event: "illegal-move"  as MemeEvent, label: "Illegal",      emoji: "❌" },
                  { event: "win"           as MemeEvent, label: "Win",          emoji: "🏆" },
                  { event: "lose"          as MemeEvent, label: "Lose",         emoji: "😭" },
                  { event: "blunder"       as MemeEvent, label: "Blunder",      emoji: "🤦" },
                  { event: "promotion"     as MemeEvent, label: "Promotion",    emoji: "👑" },
                ] as const
              ).map(({ event, label, emoji }) => (
                <Button
                  key={event}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1.5 text-xs h-8"
                  onClick={() => playMeme(event)}
                >
                  <span>{emoji}</span>{label}
                </Button>
              ))}
            </div>
          </div>

          {/* Commentator mode */}
          <div className={`flex items-center justify-between border-t border-border pt-4 transition-opacity ${memeMode ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="flex items-center gap-2">
              <Mic2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Commentator Mode</p>
                <p className="text-xs text-muted-foreground">Shows big emoji + Tunisian meme text on screen</p>
              </div>
            </div>
            <Switch
              checked={commentatorMode}
              onCheckedChange={setCommentatorMode}
              disabled={!memeMode}
              aria-label="Toggle commentator mode"
            />
          </div>

        </CardContent>
      </Card>

      {/* ── AI Control ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#81b64c]" />
            AI Control
          </CardTitle>
          <CardDescription>
            Control the app using your voice, hand gestures, or eye tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Show popup toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="font-medium text-sm">Show AI Control Popup</p>
              <p className="text-xs text-muted-foreground">
                Display the floating control widget on screen
              </p>
            </div>
            <Switch
              checked={showPopup}
              onCheckedChange={setShowPopup}
              aria-label="Toggle AI control popup"
            />
          </div>

          {/* Input mode toggles */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Input Modes</Label>
            <div className="grid grid-cols-3 gap-3">

              {/* Voice */}
              <button
                onClick={toggleVoice}
                disabled={!platform.speechSupported}
                className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 transition-all
                  ${!platform.speechSupported ? "opacity-30 cursor-not-allowed border-border" :
                    voiceEnabled
                      ? "border-[#81b64c] bg-[#81b64c]/10 text-[#81b64c]"
                      : "border-border hover:border-[#81b64c]/40 text-muted-foreground hover:text-foreground"
                  }`}
              >
                {voiceEnabled
                  ? <Mic className="w-5 h-5" />
                  : <MicOff className="w-5 h-5" />
                }
                <span className="text-xs font-semibold">Voice</span>
                <span className={`text-[10px] ${voiceEnabled ? "opacity-80" : "opacity-50"}`}>
                  {!platform.speechSupported ? "N/A" :
                    voiceStatus === "listening" ? "listening" :
                    voiceStatus === "processing" ? "thinking" :
                    voiceStatus === "error" ? "error" :
                    voiceEnabled ? "on" : "off"}
                </span>
              </button>

              {/* Hand */}
              <button
                onClick={toggleGesture}
                disabled={!platform.cameraSupported}
                className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 transition-all
                  ${!platform.cameraSupported ? "opacity-30 cursor-not-allowed border-border" :
                    gestureEnabled
                      ? "border-green-500 bg-green-500/10 text-green-400"
                      : "border-border hover:border-green-500/40 text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Hand className="w-5 h-5" />
                <span className="text-xs font-semibold">Hand</span>
                <span className={`text-[10px] ${gestureEnabled ? "opacity-80" : "opacity-50"}`}>
                  {!platform.cameraSupported ? "N/A" : gestureEnabled ? "tracking" : "off"}
                </span>
              </button>

              {/* Eye */}
              <button
                onClick={toggleGaze}
                disabled={!platform.cameraSupported}
                className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 transition-all
                  ${!platform.cameraSupported ? "opacity-30 cursor-not-allowed border-border" :
                    gazeEnabled
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
                      : "border-border hover:border-cyan-400/40 text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Eye className="w-5 h-5" />
                <span className="text-xs font-semibold">Eye</span>
                <span className={`text-[10px] ${gazeEnabled ? "opacity-80" : "opacity-50"}`}>
                  {!platform.cameraSupported ? "N/A" : gazeEnabled ? "tracking" : "off"}
                </span>
              </button>

            </div>
          </div>

          {/* Camera status badge */}
          {(gestureEnabled || gazeEnabled) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                cameraStatus === "ready" ? "bg-green-500" :
                cameraStatus === "loading" ? "bg-yellow-400 animate-pulse" :
                cameraStatus === "error" ? "bg-red-500" : "bg-muted-foreground/40"
              }`} />
              Camera:{" "}
              <span className="text-foreground font-medium capitalize">{cameraStatus}</span>
            </div>
          )}

          {/* Platform info */}
          <div className="space-y-2 pt-1 border-t border-border">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MonitorCheck className="w-3.5 h-3.5" />
              Platform Support
            </Label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {[
                { label: "Speech API", ok: platform.speechSupported },
                { label: "Camera / WebRTC", ok: platform.cameraSupported },
                { label: "MediaPipe AI", ok: platform.mediaPipeSupported },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500/60"}`} />
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`ml-auto font-medium ${ok ? "text-green-400" : "text-red-400"}`}>
                    {ok ? "Ready" : "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Voice commands reference */}
          <div className="space-y-2 pt-1 border-t border-border">
            <Label className="text-xs text-muted-foreground">Voice Commands</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                "go to lobby", "open settings", "play ai",
                "scroll down", "click resign", "accept", "decline",
              ].map((cmd) => (
                <span
                  key={cmd}
                  className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono text-muted-foreground"
                >
                  {cmd}
                </span>
              ))}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── Danger Zone ── */}
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>These actions cannot be undone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!deleteConfirm ? (
            <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          ) : (
            <div className="space-y-3 p-4 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium">Are you sure? All your data will be permanently deleted.</p>
              <div className="flex gap-3">
                <Button variant="destructive" onClick={deleteAccount} className="flex-1">Yes, Delete Everything</Button>
                <Button variant="outline" onClick={() => setDeleteConfirm(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
