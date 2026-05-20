import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { api, type PlayerStatus } from "@/lib/api";
import { io, Socket } from "socket.io-client";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatLastSeen(dateStr: string | null, isOnline: boolean): string {
  if (isOnline) return "Online now";
  if (!dateStr) return "Unknown";

  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Avatar({ name, color }: { name: string; color: string | null }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
      style={{ background: color || "#3b82f6" }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full shrink-0 ${online ? "bg-green-500" : "bg-zinc-500"}`}
      title={online ? "Online" : "Offline"}
    />
  );
}

export default function PlayersPage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [players, setPlayers] = useState<PlayerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await api.getStatusUsers(token);
        if (!cancelled) setPlayers(data.users);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load players");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const socket = io({ path: "/api/socket.io", reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on("userStatusChanged", (data: { userId: string; isOnline: boolean; lastSeen: string }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === data.userId ? { ...p, isOnline: data.isOnline, lastSeen: data.lastSeen } : p
        )
      );
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [token]);

  const online = players.filter((p) => p.isOnline);
  const offline = players.filter((p) => !p.isOnline);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {online.length} online · {players.length} total
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Loading players…
        </div>
      )}

      {error && (
        <div className="text-destructive text-sm py-8 text-center">{error}</div>
      )}

      {!loading && !error && players.length === 0 && (
        <div className="text-muted-foreground text-sm py-8 text-center">No players found.</div>
      )}

      {!loading && !error && players.length > 0 && (
        <div className="space-y-1">
          {online.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">
                Online — {online.length}
              </p>
              {online.map((p) => (
                <PlayerRow key={p.id} player={p} onMessage={(id) => setLocation(`/messages/${id}`)} />
              ))}
              {offline.length > 0 && (
                <div className="pt-4 pb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Offline — {offline.length}
                  </p>
                </div>
              )}
            </>
          )}
          {offline.map((p) => (
            <PlayerRow key={p.id} player={p} onMessage={(id) => setLocation(`/messages/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, onMessage }: { player: PlayerStatus; onMessage: (id: string) => void }) {
  const displayName = player.nickname || player.username;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="relative">
        <Avatar name={displayName} color={player.avatarColor} />
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusDot online={player.isOnline} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {player.country ? `${player.country} · ` : ""}
          {formatLastSeen(player.lastSeen, player.isOnline)}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-sm font-semibold">{player.wins}</p>
          <p className="text-xs text-muted-foreground">wins</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title={`Message ${displayName}`}
          onClick={() => onMessage(player.id)}
        >
          <MessageCircle className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
