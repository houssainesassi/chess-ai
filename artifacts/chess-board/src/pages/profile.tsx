import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { api, type Profile, type LeaderboardEntry, type Game } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Swords, Trophy, Target, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<LeaderboardEntry | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [friendStatus, setFriendStatus] = useState<"none" | "friends" | "pending_out" | "pending_in">("none");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isOwnProfile = userId === user?.id;

  useEffect(() => {
    async function load() {
      if (!userId) return;
      setLoading(true);
      try {
        const [profilesRes, lbRes] = await Promise.all([
          api.getProfiles([userId]),
          api.getLeaderboard(),
        ]);
        const found = profilesRes.profiles.find((p) => p.userId === userId) ?? null;
        setProfile(found);
        const entry = lbRes.leaderboard.find((e) => e.userId === userId) ?? null;
        setStats(entry);

        if (token && !isOwnProfile) {
          const friendsData = await api.getFriends(token);
          const isFriend = friendsData.friends.some((f) => f.userId === userId);
          const outPending = friendsData.pendingOut.find((f) => f.userId === userId);
          const inPending = friendsData.pendingIn.find((f) => f.userId === userId);
          if (isFriend) setFriendStatus("friends");
          else if (outPending) { setFriendStatus("pending_out"); setPendingRequestId(outPending.requestId); }
          else if (inPending) { setFriendStatus("pending_in"); setPendingRequestId(inPending.requestId); }
          else setFriendStatus("none");
        }
      } catch (err) {
        toast({ title: "Failed to load profile", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, token]);

  const sendFriendRequest = async () => {
    if (!token || !userId) return;
    setActionLoading(true);
    try {
      await api.sendFriendRequest(token, userId);
      setFriendStatus("pending_out");
      toast({ title: "Friend request sent" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to send request", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const acceptRequest = async () => {
    if (!token || !pendingRequestId) return;
    setActionLoading(true);
    try {
      await api.acceptFriendRequest(token, pendingRequestId);
      setFriendStatus("friends");
      toast({ title: "Friend request accepted" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to accept", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const challengeFriend = async () => {
    if (!token || !userId) return;
    setActionLoading(true);
    try {
      const res = await api.challengeFriend(token, userId);
      toast({ title: "Challenge sent! Game created." });
      setLocation(`/game/${res.gameId}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to challenge", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-40 bg-muted rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  const displayName = profile?.nickname || userId?.slice(0, 8) || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();
  const avatarColor = profile?.avatarColor || "#555";

  const winRate = stats ? (stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0) : null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/lobby">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Player Profile</h1>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shrink-0"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-bold">{displayName}</h2>
                  {profile?.country && (
                    <p className="text-muted-foreground text-sm mt-0.5">{profile.country}</p>
                  )}
                </div>
                {!isOwnProfile && (
                  <div className="flex gap-2">
                    {friendStatus === "none" && (
                      <Button onClick={sendFriendRequest} disabled={actionLoading} size="sm">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Friend
                      </Button>
                    )}
                    {friendStatus === "pending_out" && (
                      <Badge variant="secondary" className="px-3 py-1">Request Sent</Badge>
                    )}
                    {friendStatus === "pending_in" && (
                      <Button onClick={acceptRequest} disabled={actionLoading} size="sm">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Accept Request
                      </Button>
                    )}
                    {friendStatus === "friends" && (
                      <>
                        <Badge variant="outline" className="px-3 py-1 border-primary/30 text-primary">Friends</Badge>
                        <Button onClick={challengeFriend} disabled={actionLoading} size="sm" variant="outline">
                          <Swords className="w-4 h-4 mr-2" />
                          Challenge
                        </Button>
                      </>
                    )}
                    {isOwnProfile && (
                      <Link href="/settings">
                        <Button variant="outline" size="sm">Edit Profile</Button>
                      </Link>
                    )}
                  </div>
                )}
                {isOwnProfile && (
                  <Link href="/settings">
                    <Button variant="outline" size="sm">Edit Profile</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-green-500">{stats.wins}</span>
              <span className="text-xs text-muted-foreground">Wins</span>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
              <Target className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold text-red-500">{stats.losses}</span>
              <span className="text-xs text-muted-foreground">Losses</span>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
              <Swords className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-500">{stats.draws}</span>
              <span className="text-xs text-muted-foreground">Draws</span>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-500">{winRate}%</span>
              <span className="text-xs text-muted-foreground">Win Rate</span>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            No game statistics yet.
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Games</span>
                <span className="font-bold">{stats.gamesPlayed}</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                {stats.gamesPlayed > 0 && (
                  <>
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${(stats.wins / stats.gamesPlayed) * 100}%` }} />
                    <div className="h-full bg-yellow-500 transition-all" style={{ width: `${(stats.draws / stats.gamesPlayed) * 100}%` }} />
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${(stats.losses / stats.gamesPlayed) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Wins</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Draws</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Losses</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No completed games to show.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
