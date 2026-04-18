import { useEffect } from "react";
import { useLocation } from "wouter";
import { usePlayers } from "@/hooks/use-friends";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getCountryByCode } from "@/lib/countries";
import { ArrowLeft, Users, Mail } from "lucide-react";

export default function AdminUsersPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [, navigate] = useLocation();
  const { data: players, isLoading } = usePlayers();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/lobby")}
            className="p-2 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Users size={20} className="text-primary" />
            <h1 className="text-xl font-bold">Registered Users</h1>
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {players ? `${players.length} total` : ""}
          </span>
        </div>

        {isLoading && (
          <div className="text-center text-muted-foreground py-12">Loading users…</div>
        )}

        {!isLoading && (!players || players.length === 0) && (
          <div className="text-center text-muted-foreground py-12">No users found.</div>
        )}

        {players && players.length > 0 && (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/20">
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Player</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1"><Mail size={13} /> Email</span>
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Country</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, i) => {
                  const country = getCountryByCode(player.country);
                  return (
                    <tr
                      key={player.userId}
                      className={`border-b border-border/30 last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/5"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar profile={player} size="sm" showFlag={false} />
                          <span className="font-medium">{player.nickname}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(player as any).email ?? <span className="text-xs text-border">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {country ? `${country.flag} ${country.name}` : player.country || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(player.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
