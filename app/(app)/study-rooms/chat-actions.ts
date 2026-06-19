"use server";

/**
 * 自習室聊天的 admin 接口（server actions）。
 *
 * 目前不含 admin UI，僅提供日後後台呼叫的伺服器函式：
 * - `adminGetRoomMessages(roomId, opts)`：列出某房訊息（含已隱藏）。
 * - `adminSetMessageHidden(messageId, hidden)`：隱藏 / 取消隱藏一則訊息。
 *
 * 兩者皆要求呼叫者為系統管理員（role === "admin"）。
 */
import { auth } from "@/auth";
import {
  adminListRoomMessages,
  setMessageHidden,
  type AdminChatMessageDTO,
} from "@/lib/chat";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("需要系統管理員權限");
  }
}

/** admin：列出某自習室的訊息（預設含已隱藏、最新在前） */
export async function adminGetRoomMessages(
  roomId: string,
  opts: { limit?: number; includeHidden?: boolean } = {},
): Promise<AdminChatMessageDTO[]> {
  await requireAdmin();
  if (!roomId) throw new Error("缺少 roomId");
  return adminListRoomMessages(roomId, opts);
}

/** admin：隱藏一則聊天訊息（hidden = true 後一般使用者不再看得到） */
export async function adminHideMessage(messageId: string): Promise<boolean> {
  await requireAdmin();
  if (!messageId) throw new Error("缺少 messageId");
  return setMessageHidden(messageId, true);
}

/** admin：取消隱藏一則聊天訊息 */
export async function adminUnhideMessage(messageId: string): Promise<boolean> {
  await requireAdmin();
  if (!messageId) throw new Error("缺少 messageId");
  return setMessageHidden(messageId, false);
}
