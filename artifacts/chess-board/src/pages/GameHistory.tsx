import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useMyGames } from "@/hooks/use-my-games";
import { useProfiles } from "@/hooks/use-profile";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getCountryByCode } from "@/lib/countries";
import { ArrowLeft, Trophy, Minus, Skull, Clock } from "lucide-react";

export default function GameHistoryPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [, navigate] = useLocation();
  const { user } = useUser();
  const { data: games, isLoading } = useMyGames();

  const opponentIds = [
    ...new Set(
      (games ?? [])
        .map((g) => (g.whitePlayerId === user?.id ? g.blackPlayerId : g.whitePlayerId))
        .filter(Boolean) as string[]
    ),
  ];

  const { data: profiles } = useProfiles(opponentIds);
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.userId, p]));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-secondary/20 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/lobby")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Lobby
          </button>
          <h1 className="text-xl font-bold">Game History</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border border-border/30 bg-secondary/5 animate-pulse" />
            ))}
          </div>
        ) : !games || games.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded-xl text-muted-foreground">
            <Clock size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-1">No completed games yet</p>
            <p className="text-sm">Play a multiplayer game to see it here!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...games].reverse().map((game) => {
              const isWhite = game.whitePlayerId === user?.id;
              const opponentId = isWhite ? game.blackPlayerId : game.whitePlayerId;
              const opponent = opponentId ? profileMap[opponentId] : undefined;
              const opponentCountry = opponent ? getCountryByCode(opponent.country) : undefined;

              let resultLabel = "Draw";
              let ResultIcon = Minus;
              let resultColor = "text-yellow-400";

              if (game.winner === "draw") {
                resultLabel = "Draw";
                ResultIcon = Minus;
                resultColor = "text-yellow-400";
              } else if (
                (game.winner === "white" && isWhite) ||
                (game.winner === "black" && !isWhite)
              ) {
                resultLabel = "Win";
                ResultIcon = Trophy;
                resultColor = "text-green-400";
              } else {
                resultLabel = "Loss";
                ResultIcon = Skull;
                resultColor = "text-red-400";
              }

              const date = new Date(game.updatedAt);
              const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

              return (
                <button
                  key={game.id}
                  onClick={() => navigate(`/history/${game.id}`)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-secondary/10 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className={`flex flex-col items-center gap-0.5 w-12 flex-shrink-0 ${resultColor}`}>
                    <ResultIcon size={20} />
                    <span className="text-xs font-bold">{resultLabel}</span>
                  </div>

                  <PlayerAvatar profile={opponent} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      {opponentCountry && <span>{opponentCountry.flag}</span>}
                      <span className="truncate">
                        {opponent ? opponent.nickname : opponentId ? opponentId.slice(0, 8) + "…" : "Unknown"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isWhite ? "White" : "Black"} · {dateStr}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    Review →
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
