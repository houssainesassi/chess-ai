import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api, type FriendData, type LeaderboardEntry, type Profile, type ActiveGame } from "@/lib/api";
import {
  Globe2, Bot, UserPlus, Clock, Swords, Search, Check, X,
  ExternalLink, ChevronDown, ChevronUp, Loader2, Users, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";

type TabType = "friends" | "players";

export default function LobbyPage() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendData, setFriendData] = useState<FriendData>({ friends: [], pendingIn: [], pendingOut: [], openGameId: null });
  const [allPlayers, setAllPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("friends");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPending, setShowPending] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);

  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState("Searching for opponent...");
  const [matchedOpponent, setMatchedOpponent] = useState<{ nickname: string; avatarColor: string; country?: string } | null>(null);
  const matchmakingSocketRef = useRef<Socket | null>(null);

  const notifSocketRef = useRef<Socket | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{
    gameId: string;
    fromUserId: string;
    fromNickname: string;
    fromAvatarColor: string;
  } | null>(null);

  const fetchActiveGames = async () => {
    try {
      const res = await api.getActiveGames();
      setActiveGames(res.games);
    } catch {
      setActiveGames([]);
    }
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const [lbRes, frRes, playersRes] = await Promise.all([
        api.getLeaderboard(),
        api.getFriends(token),
        api.getAllPlayers(token),
      ]);
      setLeaderboard(lbRes.leaderboard);
      setFriendData(frRes);
      setAllPlayers(playersRes.profiles.filter((p) => p.userId !== user?.id));
    } catch (err) {
      console.error("Failed to fetch lobby data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) { fetchData(); fetchActiveGames(); } }, [token]);

  // Poll active games every 10s to keep the list fresh
  useEffect(() => {
    const interval = setInterval(fetchActiveGames, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Persistent notification socket — listens for game invites
  useEffect(() => {
    if (!token || !user?.id) return;
    const sock = io({ path: "/api/socket.io", auth: { token } });
    notifSocketRef.current = sock;
    sock.on("connect", () => {
      sock.emit("registerUser", { userId: user.id });
    });
    sock.on("gameInvite", (data: { gameId: string; fromUserId: string; fromNickname: string; fromAvatarColor: string }) => {
      setPendingInvite(data);
    });
    sock.on("gameInviteDeclined", ({ byNickname }: { byNickname: string }) => {
      toast({ title: `${byNickname} declined your challenge` });
    });
    sock.on("gameStart", ({ gameId }: { gameId: string }) => {
      setLocation(`/game/${gameId}`);
    });
    return () => {
      sock.disconnect();
      notifSocketRef.current = null;
    };
  }, [token, user?.id]);

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

  const startMatchmaking = () => {
    if (!user?.id) return;
    setIsMatchmaking(true);
    setMatchmakingStatus("Searching for opponent...");
    setMatchedOpponent(null);

    const socket = io({ path: "/api/socket.io", auth: { token } });
    matchmakingSocketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("registerUser", { userId: user.id });
      socket.emit("joinMatchmaking", { userId: user.id });
    });

    socket.on("matchmakingQueued", ({ position }: { position: number }) => {
      setMatchmakingStatus(`In queue (position ${position})...`);
    });

    socket.on("matchFound", ({
      gameId,
      opponentNickname,
      opponentAvatarColor,
      opponentCountry,
    }: {
      gameId: string;
      opponentNickname?: string;
      opponentAvatarColor?: string;
      opponentCountry?: string;
    }) => {
      setIsMatchmaking(false);
      socket.disconnect();
      matchmakingSocketRef.current = null;

      if (opponentNickname) {
        setMatchedOpponent({
          nickname: opponentNickname,
          avatarColor: opponentAvatarColor || "#3b82f6",
          country: opponentCountry,
        });
        setTimeout(() => {
          setMatchedOpponent(null);
          setLocation(`/game/${gameId}`);
        }, 1800);
      } else {
        setLocation(`/game/${gameId}`);
      }
    });

    socket.on("matchmakingError", () => {
      toast({ title: "Matchmaking error", variant: "destructive" });
      cancelMatchmaking();
    });
  };

  const cancelMatchmaking = () => {
    if (matchmakingSocketRef.current && user?.id) {
      matchmakingSocketRef.current.emit("leaveMatchmaking", { userId: user.id });
      matchmakingSocketRef.current.disconnect();
      matchmakingSocketRef.current = null;
    }
    setIsMatchmaking(false);
    setMatchedOpponent(null);
  };

  useEffect(() => {
    return () => {
      if (matchmakingSocketRef.current && user?.id) {
        matchmakingSocketRef.current.emit("leaveMatchmaking", { userId: user.id });
        matchmakingSocketRef.current.disconnect();
      }
    };
  }, [user?.id]);

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

  const acceptGameInvite = async () => {
    if (!token || !pendingInvite) return;
    const { gameId } = pendingInvite;
    setPendingInvite(null);
    try {
      await api.joinGame(token, gameId);
      setLocation(`/game/${gameId}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to join game", variant: "destructive" });
    }
  };

  const declineGameInvite = async () => {
    if (!token || !pendingInvite) return;
    const { gameId } = pendingInvite;
    setPendingInvite(null);
    try {
      await api.declineGameInvite(token, gameId);
    } catch (_) {}
  };

  const challengePlayer = async (targetUserId: string, isFriend: boolean) => {
    if (!token) return;
    try {
      let res: { gameId: string };
      if (isFriend) {
        res = await api.inviteFriend(token, targetUserId);
      } else {
        res = await api.challengeFriend(token, targetUserId);
      }
      toast({ title: "Challenge sent!", description: "Waiting for the player to accept." });
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

  const getPlayerActiveGame = (userId: string) =>
    activeGames.find(g => g.whitePlayerId === userId || g.blackPlayerId === userId);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* ── Game invite popup ── */}
      {pendingInvite && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg"
              style={{ background: pendingInvite.fromAvatarColor }}
            >
              {pendingInvite.fromNickname.charAt(0).toUpperCase()}
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Game Invite</h2>
              <p className="text-muted-foreground text-sm">
                <span className="font-semibold text-foreground">{pendingInvite.fromNickname}</span> challenged you to a game
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={acceptGameInvite}>
                <Check className="w-4 h-4 mr-2" /> Accept
              </Button>
              <Button variant="outline" className="flex-1" onClick={declineGameInvite}>
                <X className="w-4 h-4 mr-2" /> Decline
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Matchmaking overlay */}
      {(isMatchmaking || matchedOpponent) && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-6 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
            {matchedOpponent ? (
              <>
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg"
                  style={{ background: matchedOpponent.avatarColor }}
                >
                  {matchedOpponent.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold">Match Found!</h2>
                  <p className="text-muted-foreground text-sm">
                    Playing against{" "}
                    <span className="font-semibold text-foreground">{matchedOpponent.nickname}</span>
                    {matchedOpponent.country && <span className="ml-1">({matchedOpponent.country})</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-green-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-4 border-green-500/40 animate-ping" style={{ animationDelay: "150ms" }} />
                  <Globe2 className="w-10 h-10 text-green-500 relative z-10" />
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold">Finding a Match</h2>
                  <p className="text-muted-foreground text-sm flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {matchmakingStatus}
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={cancelMatchmaking}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="lg:col-span-2 space-y-6">
        <h1 className="text-3xl font-bold">Play Chess</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="bg-card border-border hover:border-green-500 transition-colors cursor-pointer group"
            onClick={startMatchmaking}
          >
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Play Online</h3>
                <p className="text-sm text-muted-foreground">Auto-match with another player in real-time</p>
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

      {/* Right panel: Friends / Players */}
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
            {/* Tab header */}
            <div className="p-2 border-b border-border flex items-center gap-1">
              <button
                onClick={() => setTab("friends")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "friends" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                Friends
                {totalPending > 0 && (
                  <Badge className="bg-red-500 text-white text-[10px] h-4 px-1 min-w-[16px]">{totalPending}</Badge>
                )}
              </button>
              <button
                onClick={() => setTab("players")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "players" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <Users className="w-3.5 h-3.5" />
                Players
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowSearch(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {tab === "friends" ? (
              <>
                {/* Pending incoming */}
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

                {/* Pending outgoing */}
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

                {/* Friends list */}
                <div className="p-2 flex-1 overflow-auto max-h-96 space-y-1">
                  {loading ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
                  ) : friendData.friends.length > 0 ? (
                    friendData.friends.map((friend) => {
                      const profile = friend.profile;
                      const name = profile?.nickname || friend.userId.slice(0, 8);
                      const color = profile?.avatarColor || "#555";
                      return (
                        <div key={friend.requestId} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
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
                          <div className="flex items-center gap-1 shrink-0">
                            {(() => { const ag = getPlayerActiveGame(friend.userId); return ag ? (
                              <Link href={`/spectate/${ag.id}`}>
                                <Button size="sm" variant="outline" className="h-auto py-0.5 px-2 text-xs border-red-500/40 text-red-500 hover:bg-red-500/10 flex flex-col items-center leading-tight gap-0">
                                  <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                    Watch
                                  </span>
                                  <span className="text-[9px] text-red-400/80 font-normal truncate max-w-[80px]">
                                    {ag.whitePlayer.nickname} vs {ag.blackPlayer.nickname}
                                  </span>
                                </Button>
                              </Link>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => challengePlayer(friend.userId, true)}
                              >
                                <Swords className="w-3 h-3" />
                                Challenge
                              </Button>
                            ); })()}
                            <Link href={`/profile/${friend.userId}`}>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
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
              </>
            ) : (
              /* Players tab */
              <div className="p-2 overflow-auto max-h-[500px] space-y-1">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
                ) : allPlayers.length > 0 ? (
                  allPlayers.map((player) => {
                    const status = getFriendStatus(player.userId);
                    return (
                      <div key={player.userId} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <Link href={`/profile/${player.userId}`} className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: player.avatarColor || "#3b82f6" }}>
                            {(player.nickname || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{player.nickname}</p>
                            {player.country && <p className="text-xs text-muted-foreground">{player.country}</p>}
                          </div>
                        </Link>
                        <div className="flex items-center gap-1 shrink-0">
                          {(() => { const ag = getPlayerActiveGame(player.userId); return ag ? (
                            <Link href={`/spectate/${ag.id}`}>
                              <Button size="sm" variant="outline" className="h-auto py-0.5 px-2 text-xs border-red-500/40 text-red-500 hover:bg-red-500/10 flex flex-col items-center leading-tight gap-0">
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                  Watch
                                </span>
                                <span className="text-[9px] text-red-400/80 font-normal truncate max-w-[80px]">
                                  {ag.whitePlayer.nickname} vs {ag.blackPlayer.nickname}
                                </span>
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => challengePlayer(player.userId, status === "friends")}
                            >
                              <Swords className="w-3 h-3" />
                              Play
                            </Button>
                          ); })()}
                          {status === "none" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sendFriendRequest(player.userId)} title="Add friend">
                              <UserPlus className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">No other players yet</div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
