import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  varchar,
  boolean,
  jsonb,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Auth.js（@auth/drizzle-adapter）標準資料表 + PetScholar 自訂欄位。
 * 採資料庫 session 策略。
 */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // ---- PetScholar 自訂欄位 ----
  role: varchar("role", { length: 20 }).notNull().default("student"),
  gender: varchar("gender", { length: 20 }),
  petStyle: varchar("pet_style", { length: 40 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = "student" | "ta" | "professor" | "admin";

// ---- 論壇：看板 / 文章 / 樹狀留言 ----

export const boards = pgTable("board", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: varchar("color", { length: 16 }),
  description: text("description"),
  departments: jsonb("departments").$type<string[]>().default([]).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const posts = pgTable("post", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  boardId: varchar("board_id", { length: 32 })
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  department: text("department"),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  bounty: integer("bounty").default(0).notNull(),
  solved: boolean("solved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comments = pgTable("comment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  // 樹狀結構：自我參照父留言
  parentId: text("parent_id").references((): AnyPgColumn => comments.id, {
    onDelete: "cascade",
  }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  isAdopted: boolean("is_adopted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Board = typeof boards.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
