import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { api, type LeaderboardEntry } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Globe2, Users, Medal } from "lucide-react";

type LeaderboardTab = "global" | "country" | "friends";

function RatingBadge({ rating }: { rating: number }) {
  const { label, color } = getRatingTier(rating);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {label}
    </span>
  );
}

function getRatingTier(rating: number): { label: string; color: string } {
  if (rating >= 2400) return { label: "GM", color: "bg-yellow-500/20 text-yellow-400" };
  if (rating >= 2000) return { label: "Master", color: "bg-purple-500/20 text-purple-400" };
  if (rating >= 1600) return { label: "Expert", color: "bg-blue-500/20 text-blue-400" };
  if (rating >= 1200) return { label: "Advanced", color: "bg-green-500/20 text-green-400" };
  if (rating >= 900) return { label: "Intermediate", color: "bg-orange-500/20 text-orange-400" };
  return { label: "Beginner", color: "bg-gray-500/20 text-gray-400" };
}

function rankMedal(rank: number) {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 text-center font-mono text-sm text-muted-foreground">#{rank}</span>;
}

export default function LeaderboardPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<LeaderboardTab>("global");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<{ rating: number; country: string } | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [profile, friends] = await Promise.all([
          api.getMyProfile(token),
          api.getFriends(token),
        ]);
        setMyProfile({ rating: profile.rating || 800, country: profile.country || "" });
        setFriendIds(friends.friends.map((f) => f.userId));
      } catch (_) {}
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    (async () => {
      try {
        let res: { leaderboard: LeaderboardEntry[] };
        if (tab === "global") {
          res = await api.getLeaderboard();
        } else if (tab === "country" && myProfile?.country) {
          res = await api.getLeaderboard({ mode: "country", country: myProfile.country });
        } else if (tab === "friends" && friendIds.length > 0) {
          res = await api.getLeaderboard({ mode: "friends", friendIds: [...friendIds, user?.id || ""] });
        } else {
          res = { leaderboard: [] };
        }
        setLeaderboard(res.leaderboard);
      } catch (_) {
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, token, myProfile, friendIds]);

  const tabs: { key: LeaderboardTab; label: string; icon: typeof Globe2 }[] = [
    { key: "global", label: "Global", icon: Globe2 },
    { key: "country", label: myProfile?.country ? `${myProfile.country}` : "Country", icon: Trophy },
    { key: "friends", label: "Friends", icon: Users },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground mt-1">Players ranked by Elo rating</p>
      </div>

      {/* My rating card */}
      {myProfile && (
        <Card className="mb-6 p-4 bg-primary/5 border-primary/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
            {(user as any)?.username?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Rating</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-bold">{myProfile.rating}</span>
              <RatingBadge rating={myProfile.rating} />
            </div>
          </div>
        </Card>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 p-1 bg-muted/40 rounded-lg">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading rankings…</div>
        ) : leaderboard.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {tab === "friends" && friendIds.length === 0
              ? "Add friends to see their rankings here."
              : tab === "country" && !myProfile?.country
              ? "Set your country in Settings to see your country's rankings."
              : "No players found."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Header */}
            <div className="px-4 py-2 grid grid-cols-[40px_1fr_auto] md:grid-cols-[40px_1fr_80px_80px_80px_80px] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Rank</span>
              <span>Player</span>
              <span className="hidden md:block text-right">Rating</span>
              <span className="hidden md:block text-right">W/L/D</span>
              <span className="hidden md:block text-right">Win%</span>
              <span className="text-right">Rating</span>
            </div>

            {leaderboard.map((player, i) => {
              const isMe = player.userId === user?.id;
              return (
                <Link key={player.userId} href={`/profile/${player.userId}`}>
                  <div
                    className={`px-4 py-3 grid grid-cols-[40px_1fr_auto] md:grid-cols-[40px_1fr_80px_80px_80px_80px] gap-4 items-center hover:bg-muted/40 transition-colors cursor-pointer ${
                      isMe ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      {rankMedal(i + 1)}
                    </div>

                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow"
                        style={{ background: player.avatarColor }}
                      >
                        {player.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">
                            {player.nickname}
                            {isMe && <span className="text-primary ml-1">(you)</span>}
                          </span>
                          <RatingBadge rating={player.rating} />
                        </div>
                        {player.country && (
                          <p className="text-xs text-muted-foreground">{player.country}</p>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:block text-right">
                      <span className="font-bold text-lg">{player.rating}</span>
                    </div>
                    <div className="hidden md:block text-right text-xs text-muted-foreground">
                      <span className="text-green-400">{player.wins}W</span>
                      {" / "}
                      <span className="text-red-400">{player.losses}L</span>
                      {" / "}
                      <span>{player.draws}D</span>
                    </div>
                    <div className="hidden md:block text-right">
                      <span className="text-sm font-medium">{player.winRate}%</span>
                    </div>
                    <div className="text-right md:hidden">
                      <span className="font-bold">{player.rating}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
