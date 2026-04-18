import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import type { UserProfile } from "./use-profile";

export interface FriendEntry {
  requestId: string;
  userId: string;
  profile: UserProfile | null;
  since?: string;
  createdAt?: string;
}

export interface FriendsData {
  friends: FriendEntry[];
  pendingIn: FriendEntry[];
  pendingOut: FriendEntry[];
  openGameId: string | null;
}

async function fetchWithAuth(url: string, getToken: () => Promise<string | null>, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

export function usePlayers() {
  const { getToken } = useAuth();
  return useQuery<UserProfile[]>({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/players", getToken);
      if (!res.ok) throw new Error("Failed to load players");
      const data = await res.json();
      return data.profiles as UserProfile[];
    },
    staleTime: 30_000,
  });
}

export function useFriends() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<FriendsData>({
    queryKey: ["friends"],
    enabled: !!isSignedIn,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await fetchWithAuth("/api/friends", getToken);
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
  });
}

export function useSendFriendRequest() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (toUserId) => {
      const res = await fetchWithAuth("/api/friends/request", getToken, {
        method: "POST",
        body: JSON.stringify({ toUserId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message ?? "Failed to send request");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });
}

export function useAcceptFriendRequest() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (requestId) => {
      const res = await fetchWithAuth(`/api/friends/accept/${requestId}`, getToken, { method: "POST" });
      if (!res.ok) throw new Error("Failed to accept request");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });
}

export function useDeclineFriendRequest() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (requestId) => {
      const res = await fetchWithAuth(`/api/friends/decline/${requestId}`, getToken, { method: "POST" });
      if (!res.ok) throw new Error("Failed to decline request");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });
}

export function useRemoveFriend() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (friendUserId) => {
      const res = await fetchWithAuth(`/api/friends/${friendUserId}`, getToken, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove friend");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });
}

export function useSendGameInvite() {
  const { getToken } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: async (toUserId) => {
      const res = await fetchWithAuth("/api/friends/invite", getToken, {
        method: "POST",
        body: JSON.stringify({ toUserId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message ?? "Failed to send invite");
      }
    },
  });
}

export function useChallengePlayer() {
  const { getToken } = useAuth();

  return useMutation<{ gameId: string }, Error, string>({
    mutationFn: async (toUserId) => {
      const res = await fetchWithAuth(`/api/challenge/${toUserId}`, getToken, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message ?? "Failed to send challenge");
      }
      return res.json();
    },
  });
}

export function useDeclineGameInvite() {
  const { getToken } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: async (gameId) => {
      const res = await fetchWithAuth("/api/friends/invite/decline", getToken, {
        method: "POST",
        body: JSON.stringify({ gameId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message ?? "Failed to decline invite");
      }
    },
  });
}

export function useAcceptGameInvite() {
  const { getToken } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: async (gameId) => {
      const res = await fetchWithAuth(`/api/games/${gameId}/join`, getToken, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as any)?.message ?? "Failed to join game";
        if ((err as any)?.error === "already_in_game") return;
        throw new Error(msg);
      }
    },
  });
}

export function useProfileSearch(q: string) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<UserProfile[]>({
    queryKey: ["profile-search", q],
    enabled: !!isSignedIn && q.trim().length >= 2,
    staleTime: 10_000,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/profiles/search?q=${encodeURIComponent(q.trim())}`, getToken);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      return data.profiles as UserProfile[];
    },
  });
}
