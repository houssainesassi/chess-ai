import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

export default function HistoryPage() {
  const { token } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/my/games", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setGames(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [token]);

  const stats = {
    total: games.length,
    wins: games.filter(g => g.winner === "me").length, // Simplification
    losses: games.filter(g => g.winner !== "me" && g.winner !== null).length,
    draws: games.filter(g => g.winner === "draw").length,
    accuracy: 84.5 // Mock for now
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Game History</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-sm">Total Games</span>
            <span className="text-2xl font-bold">{stats.total}</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-b-4 border-b-green-500">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-sm">Wins</span>
            <span className="text-2xl font-bold text-green-500">{stats.wins}</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-b-4 border-b-red-500">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-sm">Losses</span>
            <span className="text-2xl font-bold text-red-500">{stats.losses}</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-b-4 border-b-yellow-500">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-sm">Draws</span>
            <span className="text-2xl font-bold text-yellow-500">{stats.draws}</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-b-4 border-b-blue-500">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-sm">Avg Accuracy</span>
            <span className="text-2xl font-bold text-blue-500">{stats.accuracy}%</span>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <Tabs defaultValue="all">
          <div className="p-4 border-b border-border">
            <TabsList>
              <TabsTrigger value="all">All Games</TabsTrigger>
              <TabsTrigger value="online">Online</TabsTrigger>
              <TabsTrigger value="robot">vs Robot</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="all" className="m-0">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading history...</div>
              ) : games.length > 0 ? (
                games.map(game => (
                  <Link key={game.id} href={`/history/${game.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-12 rounded ${game.winner === 'me' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <div className="font-bold mb-1">vs {game.opponent || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">{new Date(game.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex gap-4 items-center">
                      <Badge variant="outline">{game.status}</Badge>
                      <Badge variant={game.winner === 'me' ? 'default' : 'destructive'} className={game.winner === 'me' ? 'bg-green-500 hover:bg-green-600' : ''}>
                        {game.winner === 'me' ? 'Victory' : game.winner === 'draw' ? 'Draw' : 'Defeat'}
                      </Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">No completed games found.</div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="online" className="p-8 text-center text-muted-foreground">Filtered online games</TabsContent>
          <TabsContent value="robot" className="p-8 text-center text-muted-foreground">Filtered robot games</TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
