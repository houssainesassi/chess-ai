import { useQuery } from "@tanstack/react-query";

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  country: string | null;
  avatarUrl: string | null;
  avatarColor: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
}

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      const data = await res.json();
      return data.leaderboard as LeaderboardEntry[];
    },
  });
}
