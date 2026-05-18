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
  declineGameInvite: (token: string, gameId: string) =>
    req<{ success: boolean }>("/friends/invite/decline", {
      method: "POST",
      token,
      body: JSON.stringify({ gameId }),
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
  getLeaderboard: (opts?: { mode?: "global" | "country" | "friends"; country?: string; friendIds?: string[] }) => {
    const params = new URLSearchParams();
    if (opts?.mode) params.set("mode", opts.mode);
    if (opts?.country) params.set("country", opts.country);
    if (opts?.friendIds?.length) params.set("friendIds", opts.friendIds.join(","));
    const qs = params.toString();
    return req<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard${qs ? "?" + qs : ""}`);
  },

  // Online status
  getStatusUsers: (token: string) => req<{ users: PlayerStatus[] }>("/status/users", { token }),

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

  // Notifications
  getNotifications: (token: string) =>
    req<{ notifications: NotificationItem[]; unreadCount: number }>("/notifications", { token }),
  markAllNotificationsRead: (token: string) =>
    req<{ success: boolean }>("/notifications/read-all", { method: "POST", token }),

  // Direct Messages
  getConversations: (token: string) =>
    req<{ conversations: Conversation[] }>("/messages", { token }),
  getMessagesWithUser: (token: string, partnerId: string) =>
    req<{ messages: DirectMessage[]; partner: Conversation["partner"] | null }>(`/messages/${partnerId}`, { token }),
  sendMessage: (token: string, partnerId: string, message: string) =>
    req<DirectMessage>(`/messages/${partnerId}`, {
      method: "POST",
      token,
      body: JSON.stringify({ message }),
    }),
  markMessagesSeen: (token: string, partnerId: string) =>
    req<{ success: boolean }>(`/messages/${partnerId}/seen`, { method: "POST", token }),
};

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Profile {
  userId: string;
  username: string;
  nickname: string;
  fullName?: string | null;
  country: string;
  city?: string | null;
  age?: number | null;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarColor: string;
  rating?: number;
  gamesPlayed?: number;
  isOnline?: boolean;
  email?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  fromUserId: string | null;
  refId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  seenAt: Date | null;
  createdAt: Date;
}

export interface Conversation {
  partnerId: string;
  lastMessage: string;
  lastSenderId: string;
  lastMessageAt: Date;
  unreadCount: number;
  lastSeenAt: Date | null;
  partner: {
    userId: string;
    username: string;
    nickname: string;
    avatarColor: string | null;
    avatarUrl: string | null;
    isOnline: boolean;
  } | null;
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
  rating: number;
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
  gameMode: "ranked" | "casual";
  fen: string;
  winner: "white" | "black" | "draw" | null;
  pgn: string;
  moves: string[];
  lastMove?: string | null;
  moveHistory?: any[];
  capturedPieces?: { white: string[]; black: string[] };
  whiteRatingBefore?: number | null;
  blackRatingBefore?: number | null;
  whiteRatingChange?: number | null;
  blackRatingChange?: number | null;
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

export interface PlayerStatus {
  id: string;
  username: string;
  nickname: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  country: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  wins: number;
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
