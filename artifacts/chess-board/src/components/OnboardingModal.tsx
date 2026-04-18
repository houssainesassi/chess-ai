import { useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/react";
import { COUNTRIES, randomAvatarColor, getCountryByCode } from "@/lib/countries";
import { useCreateProfile } from "@/hooks/use-profile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OnboardingModalProps {
  open: boolean;
}

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

export default function OnboardingModal({ open }: OnboardingModalProps) {
  const { user } = useUser();
  const createProfile = useCreateProfile();

  const [nickname, setNickname] = useState(user?.firstName ?? user?.fullName ?? "");
  const [country, setCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor] = useState(() => randomAvatarColor());
  const [error, setError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  const selectedCountry = getCountryByCode(country);

  const handleAvatarFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setError("");
    setIsProcessingImage(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.85);
      setAvatarUrl(dataUrl);
    } catch {
      setError("Failed to process image. Please try another file.");
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nickname.trim()) {
      setError("Please enter a nickname");
      return;
    }
    if (!country) {
      setError("Please select your country");
      return;
    }

    createProfile.mutate(
      { nickname: nickname.trim(), country, avatarUrl, avatarColor },
      {
        onError: (err) => setError(err.message),
      },
    );
  };

  const firstLetter = nickname.trim().charAt(0).toUpperCase() || "?";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideClose
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to Smart Chess Board!</DialogTitle>
          <DialogDescription>
            Set up your profile before you start playing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
              title="Upload avatar (optional)"
              disabled={isProcessingImage}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold border-2 border-border select-none"
                  style={{ backgroundColor: avatarColor }}
                >
                  {isProcessingImage ? (
                    <span className="text-sm animate-pulse">…</span>
                  ) : (
                    firstLetter
                  )}
                </div>
              )}
              {!isProcessingImage && (
                <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium">
                  Upload
                </span>
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              Click to upload an avatar (optional)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Remove avatar
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              placeholder="Enter your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={32}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country-search">Country</Label>
            <div className="relative">
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
                  <span className="text-muted-foreground">Select your country…</span>
                )}
              </div>

              {showCountryList && (
                <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                  <div className="p-2 border-b border-border">
                    <Input
                      id="country-search"
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={createProfile.isPending || isProcessingImage}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createProfile.isPending ? "Saving…" : "Start Playing"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
