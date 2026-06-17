import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

/**
 * Phase 1 最小 users 表，用於驗證資料庫連通性。
 * 後續階段（Phase 2 認證、Phase 3+ 各功能）會擴充欄位與新增資料表。
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }),
  role: varchar("role", { length: 20 }).notNull().default("student"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
