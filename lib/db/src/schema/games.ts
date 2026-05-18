import { pgTable, text, uuid, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const chessGamesTable = pgTable("chess_games", {
  id: uuid("id").defaultRandom().primaryKey(),
  whitePlayerId: text("white_player_id").notNull(),
  blackPlayerId: text("black_player_id"),
  status: text("status").notNull().default("waiting"),
  gameMode: text("game_mode").notNull().default("casual"),
  fen: text("fen").notNull().default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  winner: text("winner"),
  pgn: text("pgn").default("").notNull(),
  moves: jsonb("moves").default([]).$type<string[]>(),
  whiteRatingBefore: integer("white_rating_before"),
  blackRatingBefore: integer("black_rating_before"),
  whiteRatingChange: integer("white_rating_change"),
  blackRatingChange: integer("black_rating_change"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertChessGameSchema = createInsertSchema(chessGamesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChessGame = typeof chessGamesTable.$inferInsert;
export type ChessGame = typeof chessGamesTable.$inferSelect;
export type GameStatus = "waiting" | "active" | "completed" | "abandoned";
