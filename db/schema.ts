import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  bigint,
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
  // 發問可附一張圖：本站服務 URL（/api/uploads/file?key=comments/{userId}/{uuid}.{ext}）
  image: text("image"),
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
  // 留言可附一張圖：本站服務 URL（/api/uploads/file?key=comments/{userId}/{uuid}.{ext}）
  image: text("image"),
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
  // 飢餓衰減錨點：上次「餵食/治療」或上次結算扣血的 epoch 毫秒。
  // 刻意用 bigint(ms) 而非 timestamp：timestamp without time zone 經 postgres-js 來回會有
  // 時區/精度偏移（讀回與寫入差 8 小時），整數毫秒則完全免疫。0＝尚未錨定（載入時補為現在）。
  hpUpdatedAt: bigint("hp_updated_at_ms", { mode: "number" }).notNull().default(0),
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
  // 食物的真實商品圖（Stitch 圖庫 URL）。商城與背包共用同一來源，避免圖文不符。
  // 配件無實體圖時為 null，改用 icon emoji 呈現。
  image: text("image"),
  description: text("description"),
  type: varchar("type", { length: 16 }).notNull().default("food"),
  accessoryType: varchar("accessory_type", { length: 16 }),
  // 等級解鎖：寵物達到此等級才能購買（0 = 無限制）
  minLevel: integer("min_level").notNull().default(0),
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

// 金幣交易明細：每一筆金幣增減都記一列，供個人檔案「金幣紀錄」呈現。
// pets.coins 仍是餘額的唯一真實來源；此表僅為可讀的歷史流水帳。
export const coinTransactions = pgTable(
  "coin_transaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 正數＝獲得、負數＝支出
    amount: integer("amount").notNull(),
    // 此筆異動後的金幣餘額（顯示用，避免前端重算）
    balanceAfter: integer("balance_after").notNull(),
    // 類型：ask|adopt|ta_verify|levelup|checkin|purchase|heal|opening
    reason: varchar("reason", { length: 24 }).notNull(),
    // 人類可讀說明，如「發問獎勵」「購買 鮮魚便當」
    description: text("description").notNull(),
    // 關聯來源 id（postId / itemId），可為 null
    refId: text("ref_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("coin_tx_user_created_idx").on(t.userId, t.createdAt)],
);

export type Pet = typeof pets.$inferSelect;
export type ShopItem = typeof shopItems.$inferSelect;
export type InventoryRow = typeof inventory.$inferSelect;
export type CoinTransaction = typeof coinTransactions.$inferSelect;

// ---- 自習室 ----

export const studyRooms = pgTable("study_room", {
  id: varchar("id", { length: 48 }).primaryKey(),
  name: text("name").notNull(),
  subject: text("subject"),
  description: text("description"),
  capacity: integer("capacity").notNull().default(8),
  // 建立者（用於擁有權：限制建立數、允許建立者刪除）。舊種子房為 null
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  // 進房密碼（null = 公開房，免密碼）
  password: text("password"),
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
    // 房間管理員（由創建者指定）：可禁麥/禁鏡/踢人/改房間資訊
    isModerator: boolean("is_moderator").notNull().default(false),
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

// ---- 自習室文字聊天（DB 持久化 + Socket.IO 即時廣播） ----

export const chatMessages = pgTable(
  "chat_message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roomId: varchar("room_id", { length: 48 })
      .notNull()
      .references(() => studyRooms.id, { onDelete: "cascade" }),
    // 作者刪除帳號時保留訊息但解除關聯
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // 快照作者顯示名稱（即使 user 被刪仍可顯示）
    authorName: text("author_name").notNull(),
    content: text("content").notNull(),
    // 由 admin 隱藏的訊息不會回傳給一般使用者
    hidden: boolean("hidden").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // 載入某房歷史（依時間）：以 (roomId, createdAt) 複合 index 加速
    index("chat_room_created_idx").on(t.roomId, t.createdAt),
    index("chat_user_idx").on(t.userId),
  ],
);

// 自習室語音通話的錄音（WebRTC 通話時由前端 MediaRecorder 錄下，上傳 MinIO/S3）
export const voiceRecordings = pgTable(
  "voice_recording",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roomId: varchar("room_id", { length: 48 })
      .notNull()
      .references(() => studyRooms.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    // MinIO 物件鍵（bucket 內路徑）
    objectKey: text("object_key").notNull(),
    contentType: varchar("content_type", { length: 64 }).notNull().default("audio/webm"),
    durationMs: integer("duration_ms"),
    sizeBytes: integer("size_bytes"),
    hidden: boolean("hidden").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("voice_room_created_idx").on(t.roomId, t.createdAt),
    index("voice_user_idx").on(t.userId),
  ],
);

export type StudyRoom = typeof studyRooms.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type VoiceRecording = typeof voiceRecordings.$inferSelect;

// ---- 科系（由管理員維護的清單。所有選科系處只能從此清單選） ----
export const departments = pgTable("department", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name").notNull(),
  // 所屬學院（對應 board.id，如 cmee/ceecs…。可為 null）
  college: varchar("college", { length: 32 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Department = typeof departments.$inferSelect;

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
