import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Trophy, ArrowRight, SkipForward } from "lucide-react";

const AVATAR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#14b8a6", "#a855f7", "#64748b",
];

const COUNTRIES = [
  "Algeria","Argentina","Australia","Belgium","Brazil","Canada","Chile","China",
  "Colombia","Egypt","France","Germany","India","Indonesia","Italy","Japan",
  "Mexico","Morocco","Netherlands","Nigeria","Pakistan","Poland","Portugal",
  "Russia","Saudi Arabia","South Africa","South Korea","Spain","Tunisia",
  "Turkey","Ukraine","United Kingdom","United States","Vietnam","Other",
];

export default function OnboardingPage() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState(user?.username || "");
  const [country, setCountry] = useState("Other");
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const initials = (nickname || user?.username || "?").charAt(0).toUpperCase();

  const handleSave = async () => {
    if (!token) return;
    if (!nickname.trim()) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
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
      toast({ title: "Profile saved! Welcome to Smart Chess 🎉" });
      setLocation("/lobby");
    } catch (err: any) {
      toast({ title: err.message || "Failed to save profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Trophy className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-2xl leading-tight">Complete your profile</h1>
            <p className="text-muted-foreground text-sm">Let other players know who you are</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl">
          {/* Avatar preview + color picker */}
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shrink-0 shadow-lg transition-colors duration-200"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground mb-2 block">Choose avatar color</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-full transition-all ${avatarColor === c ? "ring-2 ring-offset-2 ring-offset-card ring-white scale-110" : "hover:scale-105"}`}
                    style={{ background: c }}
                    onClick={() => setAvatarColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
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

          {/* Display name (nickname) */}
          <div className="space-y-1.5">
            <Label htmlFor="nickname">Display Name <span className="text-destructive">*</span></Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Your display name"
              maxLength={32}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">Shown to other players</p>
          </div>

          {/* Country + City */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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

          {/* Age */}
          <div className="space-y-1.5">
            <Label htmlFor="age">Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="age"
              type="number"
              min={6}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className="bg-background w-32"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="bio">Short Bio <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Chess enthusiast, e4 player..."
              maxLength={200}
              rows={2}
              className="bg-background resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : (
                <>
                  Complete Profile
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setLocation("/lobby")}
              className="text-muted-foreground"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
