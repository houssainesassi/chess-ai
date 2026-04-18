import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useMemo } from "react";

export interface UserProfile {
  userId: string;
  nickname: string;
  country: string;
  avatarUrl: string | null;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfilePayload {
  nickname: string;
  country: string;
  avatarUrl?: string | null;
  avatarColor: string;
}

const PROFILE_QUERY_KEY = ["profile"];

async function fetchWithAuth(
  url: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

export function useProfile() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<UserProfile | null>({
    queryKey: PROFILE_QUERY_KEY,
    enabled: !!isSignedIn,
    retry: false,
    queryFn: async () => {
      const res = await fetchWithAuth("/api/profile", getToken);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });
}

export function useProfiles(userIds: string[]) {
  const key = useMemo(() => userIds.slice().sort().join(","), [userIds]);

  return useQuery<UserProfile[]>({
    queryKey: ["profiles", key],
    enabled: userIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (!key) return [];
      const res = await fetch(`/api/profiles?userIds=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const data = await res.json();
      return data.profiles as UserProfile[];
    },
  });
}

export function useCreateProfile() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<UserProfile, Error, CreateProfilePayload>({
    mutationFn: async (payload) => {
      const res = await fetchWithAuth("/api/profile", getToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message ?? "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: (profile) => {
      qc.setQueryData(PROFILE_QUERY_KEY, profile);
    },
  });
}

export function useDeleteAccount() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetchWithAuth("/api/account", getToken, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message ?? "Failed to delete account");
      }
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}
