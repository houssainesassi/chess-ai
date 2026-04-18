import { createContext, useCallback, useContext, useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAcceptFriendRequest, useDeclineFriendRequest, useDeclineGameInvite, useAcceptGameInvite } from "@/hooks/use-friends";
import { InviteNotifications, type NotifItem } from "@/components/InviteNotification";
import type { GameInvitePayload, FriendRequestPayload } from "@/components/InviteNotification";

interface GameInviteDeclinedPayload {
  gameId: string;
  byUserId: string;
  byNickname: string;
}

interface NotificationContextValue {
  registerUser: (userId: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({ registerUser: () => {} });

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);

  const acceptFriend = useAcceptFriendRequest();
  const declineFriend = useDeclineFriendRequest();
  const declineGame = useDeclineGameInvite();
  const acceptGame = useAcceptGameInvite();

  const dismiss = useCallback((id: string) => {
    setNotifs((n) => n.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (userIdRef.current) {
        socket.emit("registerUser", { userId: userIdRef.current });
      }
    });

    socket.on("gameInvite", (payload: GameInvitePayload) => {
      setNotifs((n) => [
        ...n,
        { id: `invite-${payload.gameId}`, type: "gameInvite", payload, ts: Date.now() },
      ]);
    });

    socket.on("friendRequest", (payload: FriendRequestPayload) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setNotifs((n) => [
        ...n,
        { id: `fr-${payload.requestId}`, type: "friendRequest", payload, ts: Date.now() },
      ]);
    });

    socket.on("friendAccepted", (payload: { requestId: string; byUserId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setNotifs((n) => [
        ...n,
        {
          id: `fa-${Date.now()}`,
          type: "friendAccepted",
          payload: { message: "Your friend request was accepted!" },
          ts: Date.now(),
        },
      ]);
    });

    socket.on("gameInviteDeclined", (payload: GameInviteDeclinedPayload) => {
      setNotifs((n) => [
        ...n,
        { id: `gid-${Date.now()}`, type: "gameInviteDeclined", payload, ts: Date.now() },
      ]);
    });

    socket.on("gameAccepted", (payload: { gameId: string }) => {
      navigate(`/game/${payload.gameId}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, navigate]);

  const registerUser = useCallback((userId: string) => {
    userIdRef.current = userId;
    if (socketRef.current?.connected) {
      socketRef.current.emit("registerUser", { userId });
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ registerUser }}>
      {children}
      <InviteNotifications
        notifs={notifs}
        onDismiss={dismiss}
        onAcceptFriend={(requestId) => acceptFriend.mutateAsync(requestId).catch(() => {})}
        onDeclineFriend={(requestId) => declineFriend.mutateAsync(requestId).catch(() => {})}
        onJoinGame={(gameId) => {
          dismiss(`invite-${gameId}`);
          acceptGame.mutateAsync(gameId).catch(() => {}).finally(() => {
            navigate(`/game/${gameId}`);
          });
        }}
        onDeclineGame={(gameId) => {
          dismiss(`invite-${gameId}`);
          declineGame.mutateAsync(gameId).catch(() => {});
        }}
      />
    </NotificationContext.Provider>
  );
}
