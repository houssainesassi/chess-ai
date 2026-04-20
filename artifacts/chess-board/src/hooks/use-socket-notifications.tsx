import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";

export function SocketNotificationProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const socketRef = useRef<Socket | null>(null);

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

    socket.on("gameInvite", (data: { gameId: string; fromNickname: string; fromAvatarColor: string }) => {
      toast({
        title: `${data.fromNickname || "Someone"} challenged you!`,
        description: "Click to join the game.",
        action: (
          <button
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            onClick={() => setLocation(`/game/${data.gameId}`)}
          >
            Accept
          </button>
        ),
      });
    });

    socket.on("friendRequest", (data: { requestId: string; fromUserId: string }) => {
      toast({
        title: "New friend request",
        description: "Someone wants to be your friend.",
      });
    });

    socket.on("friendAccepted", (data: { by: string }) => {
      toast({ title: "Friend request accepted!" });
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user?.id]);

  return <>{children}</>;
}
