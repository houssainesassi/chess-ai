import { eq } from "drizzle-orm";
import { db, usersTable, chessGamesTable } from "@workspace/db";
import { calculateEloForGame } from "./elo";
import { logger } from "./logger";

export async function applyRatingUpdate(
  gameId: string,
  winner: "white" | "black" | "draw",
): Promise<{ whiteChange: number; blackChange: number } | null> {
  try {
    const [game] = await db
      .select()
      .from(chessGamesTable)
      .where(eq(chessGamesTable.id, gameId));

    if (!game || game.gameMode !== "ranked" || !game.blackPlayerId) return null;
    if (game.whiteRatingChange !== null && game.whiteRatingChange !== undefined) {
      return null;
    }

    const [whiteUser, blackUser] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, game.whitePlayerId)).then(r => r[0]),
      db.select().from(usersTable).where(eq(usersTable.id, game.blackPlayerId)).then(r => r[0]),
    ]);

    if (!whiteUser || !blackUser) return null;

    const { whiteNewRating, blackNewRating, whiteChange, blackChange } =
      calculateEloForGame(
        whiteUser.rating,
        blackUser.rating,
        winner,
        whiteUser.gamesPlayed,
        blackUser.gamesPlayed,
      );

    await Promise.all([
      db.update(usersTable)
        .set({ rating: whiteNewRating, gamesPlayed: whiteUser.gamesPlayed + 1, updatedAt: new Date() })
        .where(eq(usersTable.id, game.whitePlayerId)),
      db.update(usersTable)
        .set({ rating: blackNewRating, gamesPlayed: blackUser.gamesPlayed + 1, updatedAt: new Date() })
        .where(eq(usersTable.id, game.blackPlayerId)),
      db.update(chessGamesTable)
        .set({
          whiteRatingBefore: whiteUser.rating,
          blackRatingBefore: blackUser.rating,
          whiteRatingChange: whiteChange,
          blackRatingChange: blackChange,
        })
        .where(eq(chessGamesTable.id, gameId)),
    ]);

    logger.info(
      { gameId, whiteChange, blackChange, whiteNewRating, blackNewRating },
      "Elo ratings updated",
    );

    return { whiteChange, blackChange };
  } catch (err) {
    logger.error({ err, gameId }, "Failed to apply rating update");
    return null;
  }
}
