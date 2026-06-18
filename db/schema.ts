import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  varchar,
  boolean,
  jsonb,
  index,
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
  department: varchar("department", { length: 60 }),
  bio: text("bio"),
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
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("post_board_idx").on(t.boardId),
  index("post_author_idx").on(t.authorId),
  index("post_author_name_idx").on(t.authorName),
  index("post_created_idx").on(t.createdAt),
]);

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
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("comment_post_idx").on(t.postId),
  index("comment_parent_idx").on(t.parentId),
  index("comment_author_idx").on(t.authorId),
  index("comment_author_name_idx").on(t.authorName),
]);

export type Board = typeof boards.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;

// ---- 寵物 / 商城 / 金幣 ----

export const pets = pgTable("pet", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("未命名小精靈"),
  hp: integer("hp").notNull().default(500),
  maxHp: integer("max_hp").notNull().default(500),
  exp: integer("exp").notNull().default(0),
  level: integer("level").notNull().default(1),
  coins: integer("coins").notNull().default(100),
  equippedHat: boolean("equipped_hat").notNull().default(false),
  equippedBackground: boolean("equipped_background").notNull().default(false),
  equippedRareStyle: boolean("equipped_rare_style").notNull().default(false),
  lastCheckIn: timestamp("last_check_in"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shopItems = pgTable("shop_item", {
  id: varchar("id", { length: 48 }).primaryKey(),
  name: text("name").notNull(),
  grade: varchar("grade", { length: 16 }),
  price: integer("price").notNull(),
  hpRestore: integer("hp_restore").notNull().default(0),
  expGain: integer("exp_gain").notNull().default(0),
  icon: text("icon"),
  description: text("description"),
  type: varchar("type", { length: 16 }).notNull().default("food"),
  accessoryType: varchar("accessory_type", { length: 16 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const inventory = pgTable(
  "inventory",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: varchar("item_id", { length: 48 })
      .notNull()
      .references(() => shopItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

export type Pet = typeof pets.$inferSelect;
export type ShopItem = typeof shopItems.$inferSelect;
export type InventoryRow = typeof inventory.$inferSelect;

// ---- 自習室 ----

export const studyRooms = pgTable("study_room", {
  id: varchar("id", { length: 48 }).primaryKey(),
  name: text("name").notNull(),
  subject: text("subject"),
  description: text("description"),
  capacity: integer("capacity").notNull().default(8),
  // 建立者（用於擁有權：限制建立數、允許建立者刪除）；舊種子房為 null
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const studyRoomMembers = pgTable(
  "study_room_member",
  {
    roomId: varchar("room_id", { length: 48 })
      .notNull()
      .references(() => studyRooms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.userId] }),
    index("srm_user_idx").on(t.userId),
  ],
);

// ---- 檢舉案件（管理後台） ----

export const reports = pgTable("report", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  targetType: varchar("target_type", { length: 16 }).notNull(), // post | comment
  targetId: text("target_id").notNull(),
  targetText: text("target_text"),
  reason: text("reason"),
  reporter: text("reporter"),
  // pending（待處理）| blocked（已封鎖）| rejected（已駁回）
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (t) => [
  index("report_status_idx").on(t.status),
  index("report_target_idx").on(t.targetType, t.targetId),
  index("report_created_idx").on(t.createdAt),
]);

export type StudyRoom = typeof studyRooms.$inferSelect;
export type Report = typeof reports.$inferSelect;

// ---- 福利社優惠券兌換紀錄 ----
export const couponRedemptions = pgTable(
  "coupon_redemption",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    couponId: varchar("coupon_id", { length: 48 }).notNull(),
    code: text("code").notNull(),
    redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.couponId] })],
);

export type CouponRedemption = typeof couponRedemptions.$inferSelect;
