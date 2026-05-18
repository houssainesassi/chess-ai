export type GameResult = "win" | "loss" | "draw";

function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < 30) return 32;
  if (gamesPlayed < 100) return 24;
  return 16;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateElo(
  ratingA: number,
  ratingB: number,
  result: GameResult,
  gamesPlayedA: number,
): { newRating: number; change: number } {
  const k = kFactor(gamesPlayedA);
  const expected = expectedScore(ratingA, ratingB);
  const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  const change = Math.round(k * (score - expected));
  const newRating = Math.max(100, ratingA + change);
  return { newRating, change };
}

export function calculateEloForGame(
  whiteRating: number,
  blackRating: number,
  winner: "white" | "black" | "draw",
  whiteGames: number,
  blackGames: number,
): {
  whiteNewRating: number;
  blackNewRating: number;
  whiteChange: number;
  blackChange: number;
} {
  const whiteResult: GameResult =
    winner === "white" ? "win" : winner === "draw" ? "draw" : "loss";
  const blackResult: GameResult =
    winner === "black" ? "win" : winner === "draw" ? "draw" : "loss";

  const { newRating: whiteNewRating, change: whiteChange } = calculateElo(
    whiteRating, blackRating, whiteResult, whiteGames,
  );
  const { newRating: blackNewRating, change: blackChange } = calculateElo(
    blackRating, whiteRating, blackResult, blackGames,
  );

  return { whiteNewRating, blackNewRating, whiteChange, blackChange };
}
