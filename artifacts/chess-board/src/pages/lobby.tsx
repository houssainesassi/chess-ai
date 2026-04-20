import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api, type FriendData, type LeaderboardEntry, type Profile } from "@/lib/api";
import { Globe2, Bot, UserPlus, Clock, Swords, Search, Check, X, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LobbyPage() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendData, setFriendData] = useState<FriendData>({ friends: [], pendingIn: [], pendingOut: [], openGameId: null });
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPending, setShowPending] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const fetchData = async () => {
    if (!token) return;
    try {
      const [lbRes, frRes] = await Promise.all([
        api.getLeaderboard(),
        api.getFriends(token),
      ]);
      setLeaderboard(lbRes.leaderboard);
      setFriendData(frRes);
    } catch (err) {
      console.error("Failed to fetch lobby data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      if (!token) return;
      setSearchLoading(true);
      try {
        const res = await api.searchProfiles(token, searchQuery);
        setSearchResults(res.profiles);
      } catch (_) {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, token]);

  const startAIGame = async () => {
    try {
      await api.resetGame();
      setLocation("/game");
    } catch (err) {
      toast({ title: "Failed to start game", variant: "destructive" });
    }
  };

  const createOnlineGame = async () => {
    try {
      const game = await api.createGame(token!);
      setLocation(`/game/${game.id}`);
    } catch (err) {
      toast({ title: "Failed to create online game", variant: "destructive" });
    }
  };

  const sendFriendRequest = async (toUserId: string) => {
    if (!token) return;
    try {
      await api.sendFriendRequest(token, toUserId);
      toast({ title: "Friend request sent" });
      await fetchData();
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      toast({ title: err.message || "Failed to send request", variant: "destructive" });
    }
  };

  const acceptRequest = async (requestId: string) => {
    if (!token) return;
    try {
      await api.acceptFriendRequest(token, requestId);
      toast({ title: "Friend request accepted" });
      await fetchData();
    } catch (err: any) {
      toast({ title: err.message || "Failed to accept", variant: "destructive" });
    }
  };

  const declineRequest = async (requestId: string) => {
    if (!token) return;
    try {
      await api.declineFriendRequest(token, requestId);
      toast({ title: "Request declined" });
      await fetchData();
    } catch (err: any) {
      toast({ title: err.message || "Failed to decline", variant: "destructive" });
    }
  };

  const challengeFriend = async (friendUserId: string) => {
    if (!token) return;
    try {
      const res = await api.challengeFriend(token, friendUserId);
      toast({ title: "Challenge sent!" });
      setLocation(`/game/${res.gameId}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to challenge", variant: "destructive" });
    }
  };

  const getFriendStatus = (userId: string) => {
    if (friendData.friends.some((f) => f.userId === userId)) return "friends";
    if (friendData.pendingOut.some((f) => f.userId === userId)) return "pending";
    return "none";
  };

  const totalPending = friendData.pendingIn.length + friendData.pendingOut.length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <h1 className="text-3xl font-bold">Play Chess</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card border-border hover:border-primary transition-colors cursor-pointer group" onClick={createOnlineGame}>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Play Online</h3>
                <p className="text-sm text-muted-foreground">Play vs another player in real-time</p>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <Badge variant="secondary" className="bg-muted text-muted-foreground"><Clock className="w-3 h-3 mr-1" /> 10 min</Badge>
                <Badge variant="secondary" className="bg-muted text-muted-foreground"><Swords className="w-3 h-3 mr-1" /> Ranked</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-purple-500 transition-colors cursor-pointer group" onClick={startAIGame}>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bot className="w-8 h-8 text-purple-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Play vs AI</h3>
                <p className="text-sm text-muted-foreground">Challenge Stockfish with varying difficulties</p>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <Badge variant="secondary" className="bg-muted text-muted-foreground">Practice</Badge>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">Analysis</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
          <Card className="bg-card border-border overflow-hidden">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
              ) : leaderboard.length > 0 ? (
                leaderboard.slice(0, 10).map((player, i) => (
                  <Link key={player.userId} href={`/profile/${player.userId}`}>
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <span className={`font-mono text-lg w-6 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                          #{i + 1}
                        </span>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: player.avatarColor }}>
                          {(player.nickname || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium">{player.nickname}</span>
                          {player.country && <span className="text-xs text-muted-foreground ml-2">{player.country}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground hidden sm:block">{player.wins}W / {player.losses}L / {player.draws}D</span>
                        <Badge variant="outline" className="font-mono text-sm border-primary/20 text-primary bg-primary/10">
                          {player.winRate}%
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">No players yet. Play some games!</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        {showSearch ? (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Find Players</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by nickname..."
                  className="pl-9 bg-background"
                  autoFocus
                />
              </div>
              {searchLoading && <div className="text-sm text-muted-foreground text-center py-2">Searching...</div>}
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-60 overflow-auto">
                  {searchResults.map((p) => {
                    const status = getFriendStatus(p.userId);
                    return (
                      <div key={p.userId} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                        <Link href={`/profile/${p.userId}`} className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: p.avatarColor }}>
                            {p.nickname.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.nickname}</p>
                            {p.country && <p className="text-xs text-muted-foreground">{p.country}</p>}
                          </div>
                        </Link>
                        {status === "none" && (
                          <Button size="sm" variant="outline" className="h-7 ml-2 shrink-0" onClick={() => sendFriendRequest(p.userId)}>
                            <UserPlus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        )}
                        {status === "pending" && <Badge variant="secondary" className="ml-2 shrink-0 text-xs">Sent</Badge>}
                        {status === "friends" && <Badge variant="outline" className="ml-2 shrink-0 text-xs border-primary/30 text-primary">Friends</Badge>}
                      </div>
                    );
                  })}
                </div>
              )}
              {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">No players found</div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">Friends</h3>
                {totalPending > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-xs h-5 px-1.5">{totalPending}</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {friendData.pendingIn.length > 0 && (
              <div className="border-b border-border">
                <button
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setShowPending(!showPending)}
                >
                  <span className="font-medium text-foreground">Requests ({friendData.pendingIn.length})</span>
                  {showPending ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showPending && (
                  <div className="px-2 pb-2 space-y-1">
                    {friendData.pendingIn.map((req) => {
                      const name = req.profile?.nickname || req.userId.slice(0, 8);
                      const color = req.profile?.avatarColor || "#555";
                      return (
                        <div key={req.requestId} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                          <Link href={`/profile/${req.userId}`} className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: color }}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium truncate">{name}</span>
                          </Link>
                          <button className="w-7 h-7 rounded-full bg-green-500/15 text-green-500 hover:bg-green-500/25 flex items-center justify-center transition-colors" onClick={() => acceptRequest(req.requestId)}>
                            <Check className="w-3 h-3" />
                          </button>
                          <button className="w-7 h-7 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 flex items-center justify-center transition-colors" onClick={() => declineRequest(req.requestId)}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {friendData.pendingOut.length > 0 && (
              <div className="border-b border-border px-4 py-2 space-y-1">
                <p className="text-xs text-muted-foreground mb-1">Sent</p>
                {friendData.pendingOut.map((req) => {
                  const name = req.profile?.nickname || req.userId.slice(0, 8);
                  const color = req.profile?.avatarColor || "#555";
                  return (
                    <div key={req.requestId} className="flex items-center gap-2 py-1">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: color }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm flex-1 truncate">{name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">Pending</Badge>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-2 flex-1 overflow-auto max-h-96 space-y-1">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
              ) : friendData.friends.length > 0 ? (
                friendData.friends.map((friend) => {
                  const profile = friend.profile;
                  const name = profile?.nickname || friend.userId.slice(0, 8);
                  const color = profile?.avatarColor || "#555";
                  return (
                    <div key={friend.requestId} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors group">
                      <Link href={`/profile/${friend.userId}`} className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: color }}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card bg-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          {profile?.country && <p className="text-xs text-muted-foreground">{profile.country}</p>}
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => challengeFriend(friend.userId)} title="Challenge">
                          <Swords className="w-3 h-3" />
                        </Button>
                        <Link href={`/profile/${friend.userId}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="View Profile">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center flex flex-col items-center">
                  <p className="text-sm text-muted-foreground">No friends yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowSearch(true)}>
                    <Search className="w-3 h-3 mr-2" />
                    Find Players
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
