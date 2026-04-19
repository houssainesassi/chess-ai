import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

export interface MyGame {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  status: string;
  fen: string;
  pgn: string;
  winner: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useMyGames() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<MyGame[]>({
    queryKey: ["my-games"],
    enabled: !!isSignedIn,
    staleTime: 30_000,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/my/games", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch game history");
      const data = await res.json();
      return data.games as MyGame[];
    },
  });
}
