import { pgTable, text, uuid, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  nickname: text("nickname"),
  country: text("country"),
  city: text("city"),
  age: integer("age"),
  bio: text("bio"),
  avatarColor: text("avatar_color"),
  avatarUrl: text("avatar_url"),
  isOnline: boolean("is_online").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
