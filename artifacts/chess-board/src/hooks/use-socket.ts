import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetGameStateQueryKey,
  getGetGameQueryKey,
} from "@workspace/api-client-react";
import type { GameState, GameSessionWithState } from "@workspace/api-client-react";

export interface ChatMessage {
  id: string;
  gameId: string;
  userId: string;
  username: string;
  message: string;
  createdAt: string;
}

export function useGameSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;

    socket.on("gameUpdate", (gameState: GameState) => {
      if (!gameState || !Array.isArray(gameState.moveHistory)) return;
      queryClient.setQueryData(getGetGameStateQueryKey(), gameState);
      queryClient.invalidateQueries({ queryKey: getGetGameStateQueryKey() });
    });

    socket.on("arduinoStatus", ({ connected }: { connected: boolean }) => {
      queryClient.setQueryData(getGetGameStateQueryKey(), (old: GameState | undefined) => {
        if (!old) return old;
        return { ...old, arduinoConnected: connected };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return socketRef.current;
}

export function useMultiplayerGameSocket(
  gameId: string,
  onChatMessage?: (msg: ChatMessage) => void
) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const onChatMessageRef = useRef(onChatMessage);
  onChatMessageRef.current = onChatMessage;

  useEffect(() => {
    if (!gameId) return;

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinGame", { gameId });
    });

    socket.on("roomUpdate", (gameState: GameState) => {
      if (!gameState || !Array.isArray(gameState.moveHistory)) return;
      queryClient.setQueryData(
        getGetGameQueryKey(gameId),
        (old: GameSessionWithState | undefined) => {
          if (!old) return old;
          return { ...old, ...gameState };
        }
      );
      queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) });
    });

    socket.on("chatMessage", (msg: ChatMessage) => {
      onChatMessageRef.current?.(msg);
    });

    return () => {
      socket.emit("leaveGame", { gameId });
      socket.disconnect();
    };
  }, [gameId, queryClient]);

  const sendMessage = useCallback(
    (userId: string, username: string, message: string) => {
      socketRef.current?.emit("sendMessage", { gameId, userId, username, message });
    },
    [gameId]
  );

  return { sendMessage };
}

export type { GameState };

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
}

export interface GameInviteDeclinedPayload {
  gameId: string;
  byUserId: string;
  byNickname: string;
}

export function useLobbySocket(
  userId: string | undefined,
  onGameInvite?: (payload: GameInvitePayload) => void,
  onFriendRequest?: (payload: FriendRequestPayload) => void,
  onFriendAccepted?: (payload: { requestId: string; byUserId: string }) => void,
  onGameInviteDeclined?: (payload: GameInviteDeclinedPayload) => void
) {
  const queryClient = useQueryClient();
  const onGameInviteRef = useRef(onGameInvite);
  const onFriendRequestRef = useRef(onFriendRequest);
  const onFriendAcceptedRef = useRef(onFriendAccepted);
  const onGameInviteDeclinedRef = useRef(onGameInviteDeclined);
  onGameInviteRef.current = onGameInvite;
  onFriendRequestRef.current = onFriendRequest;
  onFriendAcceptedRef.current = onFriendAccepted;
  onGameInviteDeclinedRef.current = onGameInviteDeclined;

  useEffect(() => {
    if (!userId) return;

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      socket.emit("registerUser", { userId });
    });

    socket.on("gameInvite", (payload: GameInvitePayload) => {
      onGameInviteRef.current?.(payload);
    });

    socket.on("friendRequest", (payload: FriendRequestPayload) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      onFriendRequestRef.current?.(payload);
    });

    socket.on("friendAccepted", (payload: { requestId: string; byUserId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      onFriendAcceptedRef.current?.(payload);
    });

    socket.on("gameInviteDeclined", (payload: GameInviteDeclinedPayload) => {
      onGameInviteDeclinedRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, queryClient]);
}
