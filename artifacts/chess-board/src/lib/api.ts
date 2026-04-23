const BASE = "/api";

async function req<T>(
  path: string,
  opts: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...rest } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    req<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (username: string, email: string, password: string) =>
    req<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),
  me: (token: string) => req<User>("/auth/me", { token }),

  // Profile
  getMyProfile: (token: string) => req<Profile>("/profile", { token }),
  saveProfile: (token: string, data: Partial<Profile>) =>
    req<Profile>("/profile", { method: "POST", token, body: JSON.stringify(data) }),
  getProfiles: (userIds: string[]) =>
    req<{ profiles: Profile[] }>(`/profiles?userIds=${userIds.join(",")}`),
  searchProfiles: (token: string, q: string) =>
    req<{ profiles: Profile[] }>(`/profiles/search?q=${encodeURIComponent(q)}`, { token }),
  getAllPlayers: (token: string) =>
    req<{ profiles: Profile[] }>("/players", { token }),
  deleteAccount: (token: string) =>
    req<{ success: boolean }>("/account", { method: "DELETE", token }),

  // Friends
  getFriends: (token: string) => req<FriendData>("/friends", { token }),
  sendFriendRequest: (token: string, toUserId: string) =>
    req<{ success: boolean }>("/friends/request", {
      method: "POST",
      token,
      body: JSON.stringify({ toUserId }),
    }),
  acceptFriendRequest: (token: string, requestId: string) =>
    req<{ success: boolean }>(`/friends/accept/${requestId}`, { method: "POST", token }),
  declineFriendRequest: (token: string, requestId: string) =>
    req<{ success: boolean }>(`/friends/decline/${requestId}`, { method: "POST", token }),
  challengeFriend: (token: string, toUserId: string) =>
    req<{ success: boolean; gameId: string }>(`/challenge/${toUserId}`, {
      method: "POST",
      token,
    }),
  inviteFriend: (token: string, toUserId: string) =>
    req<{ success: boolean; gameId: string }>("/friends/invite", {
      method: "POST",
      token,
      body: JSON.stringify({ toUserId }),
    }),

  // Games
  getMyGames: (token: string) => req<{ games: Game[] }>("/my/games", { token }),
  getGame: (token: string, id: string) => req<Game>(`/games/${id}`, { token }),
  createGame: (token: string) => req<Game>("/games", { method: "POST", token }),
  joinGame: (token: string, id: string) =>
    req<{ success: boolean }>(`/games/${id}/join`, { method: "POST", token }),
  makeMove: (token: string, id: string, move: string) =>
    req<Game>(`/games/${id}/move`, {
      method: "POST",
      token,
      body: JSON.stringify({ move }),
    }),

  // Active games (spectator)
  getActiveGames: () => req<{ games: ActiveGame[] }>("/games/active"),

  // Leaderboard
  getLeaderboard: () => req<{ leaderboard: LeaderboardEntry[] }>("/leaderboard"),

  // Local AI game
  getGameState: () => req<LocalGameState>("/game/state"),
  getGameHistory: () => req<{ moves: LocalMove[] }>("/game/history"),
  localMove: (move: string) =>
    req<LocalGameState>("/game/move", {
      method: "POST",
      body: JSON.stringify({ move, source: "ui" }),
    }),
  undoMove: () => req<LocalGameState>("/game/undo", { method: "POST" }),
  resetGame: () => req<LocalGameState>("/game/reset", { method: "POST" }),

  // Analysis
  analyze: (fen: string, depth = 12, previousFen?: string, lastMove?: string) =>
    req<AnalysisResult>("/analyze", {
      method: "POST",
      body: JSON.stringify({ fen, depth, previousFen, lastMove }),
    }),
};

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Profile {
  userId: string;
  nickname: string;
  country: string;
  avatarUrl?: string | null;
  avatarColor: string;
  email?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FriendEntry {
  requestId: string;
  userId: string;
  profile: Profile | null;
  since?: string;
  createdAt?: string;
}

export interface FriendData {
  friends: FriendEntry[];
  pendingIn: FriendEntry[];
  pendingOut: FriendEntry[];
  openGameId: string | null;
}

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

export interface Game {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  status: "waiting" | "active" | "completed";
  fen: string;
  winner: "white" | "black" | "draw" | null;
  pgn: string;
  moves: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalGameState {
  fen: string;
  turn: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  status: string;
}

export interface LocalMove {
  san: string;
  fen: string;
  move: string;
}

export interface AnalysisResult {
  evaluation: string;
  evaluationScore: number;
  bestMoveSan: string;
  bestMoveUci: string;
  moveQuality: string;
  reviewTitle: string;
  reviewCommentary: string;
}

export interface ActiveGame {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  fen: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  whitePlayer: { nickname: string; avatarColor: string };
  blackPlayer: { nickname: string; avatarColor: string };
}
