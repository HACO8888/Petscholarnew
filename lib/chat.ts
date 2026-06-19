/**
 * 自習室文字聊天的伺服器端資料層。
 *
 * 同時被以下使用：
 * - `server.mjs`（Socket.IO custom server）：載入歷史、寫入新訊息、驗證 session。
 * - `app/(app)/study-rooms/chat-actions.ts`（admin server actions）：查詢與隱藏訊息。
 *
 * 所有公開的訊息查詢都會排除 `hidden = true` 的訊息。
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  chatMessages,
  sessions,
  studyRoomMembers,
  studyRooms,
  users,
} from "@/db/schema";

/** 載入歷史時預設回傳的最大訊息數 */
export const DEFAULT_HISTORY_LIMIT = 50;
/** 單則訊息最大字元數（與 client 端一致） */
export const MAX_MESSAGE_LENGTH = 1000;

/** 廣播 / 回傳給 client 的訊息形狀（不含 hidden，因為 hidden 訊息根本不回傳） */
export interface ChatMessageDTO {
  id: string;
  roomId: string;
  userId: string | null;
  authorName: string;
  content: string;
  createdAt: string; // ISO 字串，方便跨 server/client 序列化
}

/** admin 列表用的形狀（含 hidden 狀態） */
export interface AdminChatMessageDTO extends ChatMessageDTO {
  hidden: boolean;
}

interface ChatRow {
  id: string;
  roomId: string;
  userId: string | null;
  authorName: string;
  content: string;
  hidden: boolean;
  createdAt: Date;
}

function toDTO(row: ChatRow): ChatMessageDTO {
  return {
    id: row.id,
    roomId: row.roomId,
    userId: row.userId,
    authorName: row.authorName,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 自習室是否存在 */
export async function roomExists(roomId: string): Promise<boolean> {
  const [room] = await db
    .select({ id: studyRooms.id })
    .from(studyRooms)
    .where(eq(studyRooms.id, roomId))
    .limit(1);
  return !!room;
}

/** 使用者是否為某自習室成員（只有成員可送訊息） */
export async function isRoomMember(
  roomId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ roomId: studyRoomMembers.roomId })
    .from(studyRoomMembers)
    .where(
      and(
        eq(studyRoomMembers.roomId, roomId),
        eq(studyRoomMembers.userId, userId),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * 載入某房最近 N 則「未隱藏」訊息，依時間「正序」回傳（最舊在前，方便直接 append 顯示）。
 */
export async function loadRoomHistory(
  roomId: string,
  limit: number = DEFAULT_HISTORY_LIMIT,
): Promise<ChatMessageDTO[]> {
  // 先取最近 N 則（降序），再反轉成正序
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(eq(chatMessages.roomId, roomId), eq(chatMessages.hidden, false)),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(Math.max(1, Math.min(limit, 200)));
  return rows.reverse().map(toDTO);
}

/**
 * 寫入一則訊息並回傳完整 DTO（給 server 廣播用）。
 * 不在此驗證成員資格 / 房間存在，呼叫端（server.mjs）需先驗。
 */
export async function saveMessage(input: {
  roomId: string;
  userId: string | null;
  authorName: string;
  content: string;
}): Promise<ChatMessageDTO> {
  const content = input.content.trim().slice(0, MAX_MESSAGE_LENGTH);
  const [row] = await db
    .insert(chatMessages)
    .values({
      roomId: input.roomId,
      userId: input.userId,
      authorName: input.authorName.slice(0, 200) || "成員",
      content,
    })
    .returning();
  return toDTO(row as ChatRow);
}

/**
 * 由 Auth.js 的「資料庫 session cookie」解析出使用者。
 * 資料庫 session 策略下，cookie 值即為 `session.session_token`，可直接查表。
 * 回傳 null 表示未登入 / session 失效。
 */
export async function resolveSessionUser(
  sessionToken: string | undefined | null,
): Promise<{ id: string; name: string } | null> {
  if (!sessionToken) return null;
  const [row] = await db
    .select({
      userId: sessions.userId,
      expires: sessions.expires,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.sessionToken, sessionToken))
    .limit(1);
  if (!row) return null;
  if (row.expires.getTime() < Date.now()) return null; // 已過期
  return { id: row.userId, name: row.name ?? "成員" };
}

// ---- 以下為 admin 用接口（之後可接後台 UI） ----

/**
 * admin：列出某房訊息（含已隱藏），預設依時間「降序」（最新在前）。
 */
export async function adminListRoomMessages(
  roomId: string,
  opts: { limit?: number; includeHidden?: boolean } = {},
): Promise<AdminChatMessageDTO[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const where =
    opts.includeHidden === false
      ? and(eq(chatMessages.roomId, roomId), eq(chatMessages.hidden, false))
      : eq(chatMessages.roomId, roomId);
  const rows = await db
    .select()
    .from(chatMessages)
    .where(where)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...toDTO(r as ChatRow), hidden: r.hidden }));
}

/** admin：設定某訊息的隱藏狀態，回傳是否有更新到列 */
export async function setMessageHidden(
  messageId: string,
  hidden: boolean,
): Promise<boolean> {
  const updated = await db
    .update(chatMessages)
    .set({ hidden })
    .where(eq(chatMessages.id, messageId))
    .returning({ id: chatMessages.id });
  return updated.length > 0;
}
