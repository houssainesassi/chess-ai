import { useEffect, useRef, useState, createContext, useContext } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Swords, X } from "lucide-react";
import { api } from "@/lib/api";

interface GameInvite {
  gameId: string;
  fromUserId: string;
  fromNickname: string;
  fromAvatarColor: string;
  fromCountry?: string;
}

interface NotificationsContextValue {
  unreadCount: number;
  clearUnread: () => void;
}

export const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  clearUnread: () => {},
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

export function SocketNotificationProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const socketRef = useRef<Socket | null>(null);
  const [pendingInvite, setPendingInvite] = useState<GameInvite | null>(null);
  const [declining, setDeclining] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial unread count from API
  useEffect(() => {
    if (!token) return;
    api.getNotifications(token)
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io({
      path: "/api/socket.io",
      auth: { token },
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("registerUser", { userId: user.id });
    });

    const heartbeatInterval = setInterval(() => {
      if (socket.connected) socket.emit("heartbeat", { userId: user.id });
    }, 25_000);

    socket.on("gameInvite", (data: GameInvite) => {
      setPendingInvite(data);
    });

    socket.on("friendRequest", (_data: { requestId: string; fromUserId: string }) => {
      toast({
        title: "New friend request",
        description: "Someone wants to be your friend.",
      });
    });

    socket.on("friendAccepted", (_data: { by: string }) => {
      toast({ title: "Friend request accepted!" });
    });

    socket.on("gameInviteDeclined", (data: { byNickname: string }) => {
      toast({
        title: "Challenge declined",
        description: `${data.byNickname} declined your challenge.`,
        variant: "destructive",
      });
    });

    socket.on("newNotification", (_data: { id: string; type: string; message: string }) => {
      setUnreadCount((c) => c + 1);
    });

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, [token, user?.id]);

  const clearUnread = () => setUnreadCount(0);

  const acceptInvite = () => {
    if (!pendingInvite) return;
    const gameId = pendingInvite.gameId;
    setPendingInvite(null);
    setLocation(`/game/${gameId}`);
  };

  const declineInvite = async () => {
    if (!pendingInvite || !token) return;
    setDeclining(true);
    try {
      await fetch("/api/friends/invite/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameId: pendingInvite.gameId }),
      });
    } catch (_) {}
    setDeclining(false);
    setPendingInvite(null);
  };

  return (
    <NotificationsContext.Provider value={{ unreadCount, clearUnread }}>
      {children}

      {pendingInvite && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 relative">
            <button
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              onClick={declineInvite}
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg"
              style={{ background: pendingInvite.fromAvatarColor }}
            >
              {(pendingInvite.fromNickname || "?").charAt(0).toUpperCase()}
            </div>

            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Swords className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Challenge!</h2>
              </div>
              <p className="text-muted-foreground text-sm">
                <span className="font-semibold text-foreground">{pendingInvite.fromNickname}</span>
                {pendingInvite.fromCountry && (
                  <span className="text-muted-foreground ml-1">({pendingInvite.fromCountry})</span>
                )}{" "}
                wants to play chess with you
              </p>
            </div>

            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={acceptInvite}>Accept</Button>
              <Button variant="outline" className="flex-1" onClick={declineInvite} disabled={declining}>
                Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </NotificationsContext.Provider>
  );
}
