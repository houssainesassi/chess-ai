import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { useProfiles } from "@/hooks/use-profile";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useChallengePlayer, usePlayers, useFriends, useSendFriendRequest, useAcceptFriendRequest, useDeclineFriendRequest, useRemoveFriend, useSendGameInvite } from "@/hooks/use-friends";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getCountryByCode } from "@/lib/countries";
import type { UserProfile } from "@/hooks/use-profile";
import type { LeaderboardEntry } from "@/hooks/use-leaderboard";
import { LogOut, Sword, Settings, Trophy, History, Search, Swords, UserPlus, Clock, Check, X, UserMinus, Users, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg" title="1st place">🥇</span>;
  if (rank === 2) return <span className="text-lg" title="2nd place">🥈</span>;
  if (rank === 3) return <span className="text-lg" title="3rd place">🥉</span>;
  return (
    <span className="w-6 text-center text-xs font-bold text-muted-foreground tabular-nums">
      #{rank}
    </span>
  );
}

function WinRateBar({ rate }: { rate: number }) {
  return (
    <div className="w-16 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${rate}%` }} />
    </div>
  );
}

function LeaderboardRow({ entry, rank, isMe, onChallenge, challenging }: {
  entry: LeaderboardEntry;
  rank: number;
  isMe: boolean;
  onChallenge?: () => void;
  challenging?: boolean;
}) {
  const country = entry.country ? getCountryByCode(entry.country) : undefined;
  const fakeProfile: UserProfile = {
    userId: entry.userId,
    nickname: entry.nickname,
    country: entry.country ?? "",
    avatarUrl: entry.avatarUrl,
    avatarColor: entry.avatarColor,
    createdAt: "",
    updatedAt: "",
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
      isMe ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/5 hover:bg-secondary/10"
    }`}>
      <div className="w-7 flex items-center justify-center flex-shrink-0">
        <RankBadge rank={rank} />
      </div>
      <PlayerAvatar profile={fakeProfile} size="md" showFlag={false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {country && <span className="text-sm leading-none">{country.flag}</span>}
          <span className={`text-sm font-semibold truncate ${isMe ? "text-primary" : ""}`}>
            {entry.nickname}
            {isMe && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <WinRateBar rate={entry.winRate} />
          <span className="text-[11px] text-muted-foreground">{entry.winRate}%</span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs tabular-nums">
          <div className="text-center hidden sm:block">
            <div className="font-bold text-green-400">{entry.wins}</div>
            <div className="text-muted-foreground">W</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="font-bold text-red-400">{entry.losses}</div>
            <div className="text-muted-foreground">L</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{entry.gamesPlayed}</div>
            <div className="text-muted-foreground">Games</div>
          </div>
        </div>
        {!isMe && onChallenge && (
          <button
            onClick={onChallenge}
            disabled={challenging}
            title="Challenge to a game"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-40"
          >
            <Swords size={11} />
            {challenging ? "Sent!" : "Challenge"}
          </button>
        )}
      </div>
    </div>
  );
}

function ChallengeSearch() {
  const { user } = useUser();
  const { toast } = useToast();
  const [searchQ, setSearchQ] = useState("");
  const [challengingIds, setChallengingIds] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const { data: allPlayers, isLoading } = usePlayers();
  const { data: friendsData } = useFriends();
  const challengePlayer = useChallengePlayer();
  const sendRequest = useSendFriendRequest();

  const friendIds = new Set((friendsData?.friends ?? []).map((e) => e.userId));
  const pendingOutIds = new Set((friendsData?.pendingOut ?? []).map((e) => e.userId));

  // Filter out yourself, then apply search query
  const filtered = (allPlayers ?? [])
    .filter((p) => p.userId !== user?.id)
    .filter((p) =>
      searchQ.trim().length === 0
        ? true
        : p.nickname.toLowerCase().includes(searchQ.trim().toLowerCase())
    );

  const handleChallenge = async (userId: string) => {
    setChallengingIds((s) => new Set(s).add(userId));
    try {
      await challengePlayer.mutateAsync(userId);
      toast({ title: "Challenge sent!", description: "Waiting for them to accept." });
    } catch (e: any) {
      toast({ title: e.message ?? "Failed", variant: "destructive" });
    } finally {
      setTimeout(() => setChallengingIds((s) => { const n = new Set(s); n.delete(userId); return n; }), 3000);
    }
  };

  const handleAddFriend = async (userId: string) => {
    setAddingIds((s) => new Set(s).add(userId));
    try {
      await sendRequest.mutateAsync(userId);
      toast({ title: "Friend request sent!" });
    } catch (e: any) {
      toast({ title: e.message ?? "Failed", variant: "destructive" });
    } finally {
      setTimeout(() => setAddingIds((s) => { const n = new Set(s); n.delete(userId); return n; }), 3000);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/5 p-4 space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter by nickname…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border/50 bg-secondary/20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2 py-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-secondary/20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">
          {searchQ ? "No players found." : "No other players registered yet."}
        </p>
      ) : (
        <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
          {filtered.map((profile) => {
            const isFriend = friendIds.has(profile.userId);
            const isPending = pendingOutIds.has(profile.userId);
            const country = getCountryByCode(profile.country);
            const isChallenging = challengingIds.has(profile.userId);
            const isAdding = addingIds.has(profile.userId);

            return (
              <div key={profile.userId} className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-secondary/10 transition-colors">
                <PlayerAvatar profile={profile} size="sm" showFlag={false} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {country?.flag} {profile.nickname}
                  </div>
                  {isFriend && <div className="text-[10px] text-primary/70">Friend</div>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleChallenge(profile.userId)}
                    disabled={isChallenging}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-40"
                  >
                    <Swords size={11} />
                    {isChallenging ? "Sent!" : "Challenge"}
                  </button>
                  {!isFriend && !isPending && (
                    <button
                      onClick={() => handleAddFriend(profile.userId)}
                      disabled={isAdding}
                      title="Add friend"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-border/50 transition-colors disabled:opacity-40"
                    >
                      <UserPlus size={13} />
                    </button>
                  )}
                  {isPending && !isFriend && (
                    <span className="text-xs text-muted-foreground" title="Friend request pending">
                      <Clock size={11} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FriendsSection() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());

  const { data: friendsData, isLoading } = useFriends();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const removeRequest = useRemoveFriend();
  const sendInvite = useSendGameInvite();

  const friends = friendsData?.friends ?? [];
  const pendingIn = friendsData?.pendingIn ?? [];

  const handleAccept = async (requestId: string) => {
    try { await acceptRequest.mutateAsync(requestId); toast({ title: "Friend added!" }); }
    catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const handleDecline = async (requestId: string) => {
    try { await declineRequest.mutateAsync(requestId); }
    catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const handleRemove = async (friendUserId: string) => {
    try { await removeRequest.mutateAsync(friendUserId); toast({ title: "Friend removed" }); }
    catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const handleInvite = async (toUserId: string) => {
    setInvitingIds((s) => new Set(s).add(toUserId));
    try {
      await sendInvite.mutateAsync(toUserId);
      toast({ title: "Challenge sent!" });
    } catch (e: any) {
      toast({ title: e.message ?? "Failed", variant: "destructive" });
    } finally {
      setTimeout(() => setInvitingIds((s) => { const n = new Set(s); n.delete(toUserId); return n; }), 3000);
    }
  };

  if (!isLoading && friends.length === 0 && pendingIn.length === 0) return null;

  return (
    <section>
      <button
        className="flex items-center gap-2 mb-4 w-full text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <Users size={18} className="text-muted-foreground" />
        <h3 className="text-lg font-semibold flex-1">Friends</h3>
        {pendingIn.length > 0 && (
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
            {pendingIn.length}
          </span>
        )}
        <span className="text-muted-foreground">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {expanded && (
        <div className="rounded-xl border border-border/50 bg-secondary/5 p-4 space-y-3">
          {pendingIn.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                Friend Requests ({pendingIn.length})
              </div>
              <div className="space-y-1">
                {pendingIn.map((entry) => {
                  const country = entry.profile ? getCountryByCode(entry.profile.country) : undefined;
                  return (
                    <div key={entry.requestId} className="flex items-center gap-3 py-1.5">
                      <PlayerAvatar profile={entry.profile ?? undefined} size="sm" showFlag={false} />
                      <div className="flex-1 min-w-0 text-sm font-medium truncate">
                        {country?.flag} {entry.profile?.nickname ?? entry.userId.slice(0, 8) + "…"}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleAccept(entry.requestId)} className="p-1.5 rounded-lg text-green-400 hover:bg-green-400/10 transition-colors">
                          <Check size={14} />
                        </button>
                        <button onClick={() => handleDecline(entry.requestId)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {friends.length > 0 && (
            <div>
              {pendingIn.length > 0 && <div className="border-t border-border/20 my-2" />}
              <div className="space-y-1">
                {friends.map((entry) => {
                  const country = entry.profile ? getCountryByCode(entry.profile.country) : undefined;
                  return (
                    <div key={entry.requestId} className="flex items-center gap-3 py-1.5">
                      <PlayerAvatar profile={entry.profile ?? undefined} size="sm" showFlag={false} />
                      <div className="flex-1 min-w-0 text-sm font-medium truncate">
                        {country?.flag} {entry.profile?.nickname ?? entry.userId.slice(0, 8) + "…"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleInvite(entry.userId)}
                          disabled={invitingIds.has(entry.userId)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-40"
                        >
                          <Swords size={11} />
                          {invitingIds.has(entry.userId) ? "Sent!" : "Challenge"}
                        </button>
                        <button
                          onClick={() => handleRemove(entry.userId)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function LobbyPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [challengingIds, setChallengingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();
  const challengePlayer = useChallengePlayer();

  const leaderboardIds = useMemo(() => (leaderboard ?? []).map((e) => e.userId), [leaderboard]);
  const { data: profiles } = useProfiles(leaderboardIds);
  const profileMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    profiles?.forEach((p) => { map[p.userId] = p; });
    return map;
  }, [profiles]);

  const myProfile = user ? profileMap[user.id] : undefined;
  const myCountry = myProfile ? getCountryByCode(myProfile.country) : undefined;

  const handleChallengeLeaderboard = async (userId: string) => {
    setChallengingIds((s) => new Set(s).add(userId));
    try {
      await challengePlayer.mutateAsync(userId);
      toast({ title: "Challenge sent!", description: "Waiting for them to accept." });
    } catch (e: any) {
      toast({ title: e.message ?? "Failed", variant: "destructive" });
    } finally {
      setTimeout(() => setChallengingIds((s) => { const n = new Set(s); n.delete(userId); return n; }), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-secondary/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">♟️</span>
            <h1 className="text-xl font-bold">Smart Chess Board</h1>
          </div>
          <div className="flex items-center gap-3">
            {myProfile && (
              <div className="hidden sm:flex items-center gap-2">
                <PlayerAvatar profile={myProfile} size="sm" showFlag={false} />
                <span className="text-sm text-muted-foreground">
                  {myCountry?.flag} {myProfile.nickname}
                </span>
              </div>
            )}
            <button
              onClick={() => navigate("/history")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary/40"
            >
              <History size={14} />
              History
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary/40"
            >
              <Settings size={14} />
              Settings
            </button>
            <button
              onClick={() => navigate("/admin/users")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary/40"
            >
              <ShieldCheck size={14} />
              Users
            </button>
            <button
              onClick={() => signOut(() => navigate("/"))}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary/40"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Play Chess</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Challenge any player or play a local game
            </p>
          </div>
          <button
            onClick={() => navigate("/game")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary/60 hover:bg-secondary text-sm font-medium border border-border/50 transition-colors"
          >
            <Sword size={16} />
            Local Game
          </button>
        </div>

        {/* Challenge a Player */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Swords size={18} className="text-primary" />
            <h3 className="text-lg font-semibold">Challenge a Player</h3>
          </div>
          <ChallengeSearch />
        </section>

        {/* Friends */}
        <FriendsSection />

        {/* Leaderboard */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-yellow-500" />
            <h3 className="text-lg font-semibold">Leaderboard</h3>
            <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full text-muted-foreground">Top 20</span>
          </div>

          {leaderboardLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl border border-border/30 bg-secondary/5 animate-pulse" />
              ))}
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/40 rounded-xl text-muted-foreground">
              <Trophy size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No completed games yet.</p>
              <p className="text-xs mt-1">Challenge someone to play!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  rank={i + 1}
                  isMe={entry.userId === user?.id}
                  onChallenge={() => handleChallengeLeaderboard(entry.userId)}
                  challenging={challengingIds.has(entry.userId)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
