import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // "friend_request" | "friend_accepted" | "game_invite" | "direct_message"
  fromUserId: text("from_user_id"),
  refId: text("ref_id"),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
