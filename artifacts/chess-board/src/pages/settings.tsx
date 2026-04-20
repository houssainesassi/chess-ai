import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Save, User } from "lucide-react";
import { useLocation } from "wouter";

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

  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState("Other");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!token) return;
      try {
        const profile = await api.getMyProfile(token);
        setNickname(profile.nickname);
        setCountry(profile.country || "Other");
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
      await api.saveProfile(token, { nickname: nickname.trim(), country, avatarColor });
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

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Manage your gameplay experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sound Effects</Label>
              <div className="text-sm text-muted-foreground">Play sounds when pieces move</div>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Move Animations</Label>
              <div className="text-sm text-muted-foreground">Smoothly animate pieces between squares</div>
            </div>
            <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
          </div>
        </CardContent>
      </Card>

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
