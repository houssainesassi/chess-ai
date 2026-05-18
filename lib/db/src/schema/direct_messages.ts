import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const directMessagesTable = pgTable("direct_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  message: text("message").notNull(),
  seenAt: timestamp("seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DirectMessage = typeof directMessagesTable.$inferSelect;
export type InsertDirectMessage = typeof directMessagesTable.$inferInsert;
