import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const friendRequestsTable = pgTable("friend_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FriendRequest = typeof friendRequestsTable.$inferSelect;
export type InsertFriendRequest = typeof friendRequestsTable.$inferInsert;
export type FriendRequestStatus = "pending" | "accepted" | "declined";
