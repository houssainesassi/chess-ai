import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Globe2, Bot, Plus, Swords, UserPlus, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LobbyPage() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [lbRes, frRes] = await Promise.all([
          fetch("/api/leaderboard"),
          fetch("/api/friends", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        if (lbRes.ok) { const d = await lbRes.json(); setLeaderboard(Array.isArray(d) ? d : (d.leaderboard || [])); }
        if (frRes.ok) { const d = await frRes.json(); setFriends(Array.isArray(d) ? d : (d.friends || [])); }
      } catch (err) {
        console.error("Failed to fetch lobby data", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchData();
  }, [token]);

  const startAIGame = async () => {
    try {
      await fetch("/api/game/reset", { method: "POST" });
      setLocation("/game");
    } catch (err) {
      toast({ title: "Error", description: "Failed to start game", variant: "destructive" });
    }
  };

  const createOnlineGame = async () => {
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to create game");
      const game = await res.json();
      setLocation(`/game/${game.id}`);
    } catch (err) {
      toast({ title: "Error", description: "Failed to create online game", variant: "destructive" });
    }
  };

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
                <p className="text-sm text-muted-foreground">Play vs a person of similar rating</p>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <Badge variant="secondary" className="bg-muted text-muted-foreground"><Clock className="w-3 h-3 mr-1"/> 10 min</Badge>
                <Badge variant="secondary" className="bg-muted text-muted-foreground"><Swords className="w-3 h-3 mr-1"/> Ranked</Badge>
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

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Top Players</h2>
          <Card className="bg-card border-border overflow-hidden">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading leaderboard...</div>
              ) : leaderboard.length > 0 ? (
                leaderboard.map((player, i) => {
                  const name = player.nickname || player.username || player.userId?.slice(0, 8) || "Player";
                  return (
                  <div key={player.userId || i} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className={`font-mono text-lg w-6 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                        #{i + 1}
                      </span>
                      <div className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold" style={{ background: player.avatarColor || "#555" }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{player.wins || 0} Wins</span>
                      <Badge variant="outline" className="font-mono text-sm border-primary/20 text-primary bg-primary/10">
                        {player.gamesPlayed || 0} games
                      </Badge>
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-muted-foreground">No players found</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="bg-card border-border h-full max-h-[800px] flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold">Friends</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2 flex-1 overflow-auto space-y-1">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading friends...</div>
            ) : friends.length > 0 ? (
              friends.map(friend => {
                const profile = friend.profile;
                const name = profile?.nickname || friend.username || "Friend";
                return (
                <div key={friend.id} className="flex items-center justify-between p-2 rounded hover:bg-muted transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold" style={{ background: profile?.avatarColor || "#555" }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card bg-gray-500`}></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{friend.status}</span>
                </div>
                );
              })
            ) : (
              <div className="p-8 text-center flex flex-col items-center">
                <Users className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No friends yet</p>
                <Button variant="outline" size="sm" className="mt-4">Find Friends</Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
