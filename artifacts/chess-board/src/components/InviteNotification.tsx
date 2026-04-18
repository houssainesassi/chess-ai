import { useEffect } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getCountryByCode } from "@/lib/countries";
import { Swords, X, UserPlus, Check } from "lucide-react";

export interface GameInvitePayload {
  gameId: string;
  fromUserId: string;
  fromNickname: string;
  fromAvatarColor: string;
  fromAvatarUrl: string | null;
  fromCountry: string | null;
}

export interface FriendRequestPayload {
  requestId: string;
  fromUserId: string;
  fromNickname?: string;
}

interface NotifItem {
  id: string;
  type: "gameInvite" | "friendRequest" | "friendAccepted" | "gameInviteDeclined";
  payload: any;
  ts: number;
}

interface Props {
  notifs: NotifItem[];
  onDismiss: (id: string) => void;
  onAcceptFriend: (requestId: string) => void;
  onDeclineFriend: (requestId: string) => void;
  onJoinGame: (gameId: string) => void;
  onDeclineGame: (gameId: string) => void;
}

export function InviteNotifications({
  notifs,
  onDismiss,
  onAcceptFriend,
  onDeclineFriend,
  onJoinGame,
  onDeclineGame,
}: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {notifs.map((n) => (
        <NotifCard
          key={n.id}
          notif={n}
          onDismiss={() => onDismiss(n.id)}
          onAcceptFriend={onAcceptFriend}
          onDeclineFriend={onDeclineFriend}
          onJoinGame={onJoinGame}
          onDeclineGame={onDeclineGame}
        />
      ))}
    </div>
  );
}

function NotifCard({
  notif,
  onDismiss,
  onAcceptFriend,
  onDeclineFriend,
  onJoinGame,
  onDeclineGame,
}: {
  notif: NotifItem;
  onDismiss: () => void;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onJoinGame: (id: string) => void;
  onDeclineGame: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 30_000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (notif.type === "gameInvite") {
    const p = notif.payload as GameInvitePayload;
    const fakeProfile = {
      userId: p.fromUserId,
      nickname: p.fromNickname,
      country: p.fromCountry ?? "",
      avatarUrl: p.fromAvatarUrl,
      avatarColor: p.fromAvatarColor,
      createdAt: "",
      updatedAt: "",
    };
    const country = p.fromCountry ? getCountryByCode(p.fromCountry) : undefined;

    return (
      <div className="bg-card border border-border/60 rounded-xl shadow-xl p-4 w-72 animate-in slide-in-from-right-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Swords size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">GAME CHALLENGE</span>
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <PlayerAvatar profile={fakeProfile} size="md" showFlag={false} />
          <div>
            <div className="font-semibold text-sm">
              {country?.flag} {p.fromNickname}
            </div>
            <div className="text-xs text-muted-foreground">challenges you to a game!</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onJoinGame(p.gameId); onDismiss(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Check size={14} />
            Accept
          </button>
          <button
            onClick={() => { onDeclineGame(p.gameId); onDismiss(); }}
            className="flex-1 py-2 rounded-lg bg-secondary/60 text-sm hover:bg-secondary transition-colors border border-border/50"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  if (notif.type === "friendRequest") {
    const p = notif.payload as FriendRequestPayload & { fromNickname?: string };

    return (
      <div className="bg-card border border-border/60 rounded-xl shadow-xl p-4 w-72 animate-in slide-in-from-right-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <UserPlus size={14} className="text-green-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">FRIEND REQUEST</span>
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
        <div className="text-sm mb-4">
          <span className="font-semibold">{p.fromNickname ?? "Someone"}</span> wants to be your friend!
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onAcceptFriend(p.requestId); onDismiss(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-semibold hover:bg-green-500/30 transition-colors"
          >
            <Check size={14} />
            Accept
          </button>
          <button
            onClick={() => { onDeclineFriend(p.requestId); onDismiss(); }}
            className="flex-1 py-2 rounded-lg bg-secondary/60 text-sm hover:bg-secondary transition-colors border border-border/50"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  if (notif.type === "friendAccepted") {
    return (
      <div className="bg-card border border-border/60 rounded-xl shadow-xl p-4 w-72 animate-in slide-in-from-right-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-green-400" />
            <span className="text-sm">{notif.payload.message ?? "Friend request accepted!"}</span>
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (notif.type === "gameInviteDeclined") {
    return (
      <div className="bg-card border border-border/60 rounded-xl shadow-xl p-4 w-72 animate-in slide-in-from-right-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <X size={14} className="text-destructive" />
            <span className="text-sm">
              <span className="font-semibold">{notif.payload.byNickname}</span> declined your challenge.
            </span>
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export type { NotifItem };
