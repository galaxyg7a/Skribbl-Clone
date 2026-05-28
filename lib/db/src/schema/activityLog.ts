import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  time: timestamp("time", { withTimezone: true }).notNull().defaultNow(),
  ip: text("ip").notNull(),
  username: text("username").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
export type InsertActivityLog = typeof activityLogTable.$inferInsert;
