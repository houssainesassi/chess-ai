import { getCountryByCode } from "@/lib/countries";
import type { UserProfile } from "@/hooks/use-profile";

interface PlayerAvatarProps {
  profile: UserProfile | undefined;
  size?: "sm" | "md";
  showFlag?: boolean;
}

export function PlayerAvatar({ profile, size = "md", showFlag = true }: PlayerAvatarProps) {
  const dim = size === "sm" ? "w-7 h-7 text-sm" : "w-8 h-8 text-sm";
  const country = profile ? getCountryByCode(profile.country) : undefined;

  return (
    <div className="relative inline-flex items-center">
      {profile?.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt={profile.nickname}
          className={`${dim} rounded-full object-cover border border-border/60`}
        />
      ) : (
        <div
          className={`${dim} rounded-full flex items-center justify-center text-white font-bold border border-border/40 select-none`}
          style={{ backgroundColor: profile?.avatarColor ?? "#555" }}
        >
          {profile ? profile.nickname.charAt(0).toUpperCase() : "?"}
        </div>
      )}
      {showFlag && country && (
        <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">{country.flag}</span>
      )}
    </div>
  );
}
