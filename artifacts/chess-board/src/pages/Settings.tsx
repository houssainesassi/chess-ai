import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useClerkCompat } from "@/context/AuthContext";
import { useProfile, useCreateProfile, useDeleteAccount } from "@/hooks/use-profile";
import { COUNTRIES, randomAvatarColor, getCountryByCode } from "@/lib/countries";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Trash2, Save, Camera } from "lucide-react";

function resizeImageToDataUrl(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

export default function SettingsPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [, navigate] = useLocation();
  const { signOut } = useClerkCompat();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useCreateProfile();
  const deleteAccount = useDeleteAccount();

  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname);
      setCountry(profile.country);
      setAvatarUrl(profile.avatarUrl);
      setAvatarColor(profile.avatarColor);
    }
  }, [profile]);

  const selectedCountry = getCountryByCode(country);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  const handleAvatarFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Please select an image file");
      return;
    }
    setSaveError("");
    setIsProcessingImage(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.85);
      setAvatarUrl(dataUrl);
    } catch {
      setSaveError("Failed to process image. Please try another file.");
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess(false);

    if (!nickname.trim()) { setSaveError("Nickname cannot be empty"); return; }
    if (!country) { setSaveError("Please select a country"); return; }

    updateProfile.mutate(
      { nickname: nickname.trim(), country, avatarUrl, avatarColor: avatarColor || randomAvatarColor() },
      {
        onSuccess: () => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); },
        onError: (err) => setSaveError(err.message),
      },
    );
  };

  const handleDeleteAccount = async () => {
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        await signOut(() => navigate("/"));
      },
      onError: (err) => {
        setSaveError(err.message);
        setShowDeleteDialog(false);
      },
    });
  };

  const firstLetter = nickname.trim().charAt(0).toUpperCase() || "?";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-secondary/20 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/lobby")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft size={14} />
            Back to Lobby
          </button>
          <span className="text-border/60">|</span>
          <h1 className="text-lg font-bold">Account Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* Profile Section */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Profile</h2>
            <p className="text-sm text-muted-foreground mt-1">Update how other players see you.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold border-2 border-border select-none"
                    style={{ backgroundColor: avatarColor || "#555" }}
                  >
                    {isProcessingImage ? <span className="text-sm animate-pulse">…</span> : firstLetter}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                >
                  <Camera size={12} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Profile photo</p>
                <p className="text-xs text-muted-foreground">JPG, PNG or WebP · max 10 MB</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingImage}
                    className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/40 transition-colors"
                  >
                    {isProcessingImage ? "Processing…" : "Upload photo"}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/40 transition-colors text-muted-foreground"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nickname */}
            <div className="space-y-1.5">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={32}
                placeholder="Your nickname"
                className="max-w-sm"
              />
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <Label>Country</Label>
              <div className="relative max-w-sm">
                <div
                  role="combobox"
                  aria-expanded={showCountryList}
                  className="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer focus-within:ring-2 focus-within:ring-ring"
                  onClick={() => setShowCountryList(true)}
                >
                  {selectedCountry ? (
                    <>
                      <span className="text-lg leading-none">{selectedCountry.flag}</span>
                      <span>{selectedCountry.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Select country…</span>
                  )}
                </div>
                {showCountryList && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                    <div className="p-2 border-b border-border">
                      <Input
                        autoFocus
                        placeholder="Search countries…"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                      {filteredCountries.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
                      ) : (
                        filteredCountries.map((c) => (
                          <li
                            key={c.code}
                            className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${country === c.code ? "bg-accent/50" : ""}`}
                            onClick={() => {
                              setCountry(c.code);
                              setCountrySearch("");
                              setShowCountryList(false);
                            }}
                          >
                            <span className="text-base leading-none">{c.flag}</span>
                            <span>{c.name}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            {saveSuccess && <p className="text-sm text-green-500">Profile saved successfully!</p>}

            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {updateProfile.isPending ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </section>

        {/* Divider */}
        <div className="border-t border-border/40" />

        {/* Danger Zone */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mt-1">
              These actions are irreversible. Please be careful.
            </p>
          </div>

          <div className="border border-destructive/30 rounded-xl p-5 bg-destructive/5 space-y-3">
            <div>
              <p className="font-medium text-sm">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently deletes your account, profile, and all associated data. You will be signed out immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              <Trash2 size={14} />
              Delete My Account
            </button>
          </div>
        </section>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account?</DialogTitle>
            <DialogDescription>
              This will permanently delete your profile and sign you out. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText(""); }}
              className="px-4 py-2 rounded-lg border border-border/60 text-sm hover:bg-secondary/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteConfirmText !== "DELETE" || deleteAccount.isPending}
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-40"
            >
              <Trash2 size={14} />
              {deleteAccount.isPending ? "Deleting…" : "Delete Forever"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
