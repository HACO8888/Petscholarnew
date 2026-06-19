"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { studyRooms, studyRoomMembers } from "@/db/schema";

// 每位使用者最多可建立的自習室數（避免無限建立造成垃圾/孤兒資料）
const MAX_ROOMS_PER_USER = 5;
const MAX_PASSWORD_LENGTH = 64;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

function revalidateRoom(roomId?: string) {
  revalidatePath("/study-rooms");
  if (roomId) revalidatePath(`/study-rooms/${roomId}`);
}

/** 解析密碼欄位：空字串視為「無密碼/移除密碼」。 */
function normalizePassword(raw: FormDataEntryValue | null): string | null {
  const pw = String(raw ?? "").trim().slice(0, MAX_PASSWORD_LENGTH);
  return pw ? pw : null;
}

/**
 * 取得呼叫者對某房的權限：
 *   isOwner（建立者）/ isModerator（被指定的房間管理員）/ isAdmin（系統管理員）。
 * 三者之一即為「房間管理員」（canModerate）。
 */
async function getRoomAuthority(roomId: string, userId: string, isAdmin: boolean) {
  const [room] = await db
    .select({ createdBy: studyRooms.createdBy })
    .from(studyRooms)
    .where(eq(studyRooms.id, roomId))
    .limit(1);
  if (!room) throw new Error("自習室不存在");

  const [membership] = await db
    .select({ isModerator: studyRoomMembers.isModerator })
    .from(studyRoomMembers)
    .where(
      and(
        eq(studyRoomMembers.roomId, roomId),
        eq(studyRoomMembers.userId, userId),
      ),
    )
    .limit(1);

  const isOwner = room.createdBy === userId;
  const isModerator = Boolean(membership?.isModerator);
  return {
    isOwner,
    isModerator,
    isAdmin,
    canModerate: isOwner || isModerator || isAdmin,
    canEdit: isOwner || isAdmin,
  };
}

export async function joinRoom(formData: FormData) {
  const userId = await requireUserId();
  const roomId = String(formData.get("roomId") ?? "");
  if (!roomId) throw new Error("缺少自習室");
  const providedPassword = String(formData.get("password") ?? "").trim();

  await db.transaction(async (tx) => {
    // 鎖定房間列，序列化同房的併發加入，避免 count-then-insert 競態超員
    const [room] = await tx
      .select({ capacity: studyRooms.capacity, password: studyRooms.password })
      .from(studyRooms)
      .where(eq(studyRooms.id, roomId))
      .for("update");
    if (!room) throw new Error("自習室不存在");

    const [already] = await tx
      .select({ roomId: studyRoomMembers.roomId })
      .from(studyRoomMembers)
      .where(
        and(
          eq(studyRoomMembers.roomId, roomId),
          eq(studyRoomMembers.userId, userId),
        ),
      )
      .limit(1);
    if (already) return; // 已加入

    // 有密碼的房：須提供正確密碼（明碼比對，非高安全需求）
    if (room.password && providedPassword !== room.password) {
      throw new Error("密碼錯誤");
    }

    const [{ c }] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(studyRoomMembers)
      .where(eq(studyRoomMembers.roomId, roomId));
    if (c >= room.capacity) throw new Error("自習室已滿");

    await tx
      .insert(studyRoomMembers)
      .values({ roomId, userId })
      .onConflictDoNothing();
  });

  revalidateRoom(roomId);
}

export async function createRoom(formData: FormData) {
  const userId = await requireUserId();

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 60);
  const description = String(formData.get("description") ?? "").trim().slice(0, 300);
  if (!name) throw new Error("請輸入自習室名稱");
  const password = normalizePassword(formData.get("password"));

  const capacityRaw = Number(formData.get("capacity"));
  const capacity =
    Number.isFinite(capacityRaw) && capacityRaw >= 2
      ? Math.min(Math.floor(capacityRaw), 12)
      : 8;

  // 限制每位使用者的建立數量
  const [{ mine }] = await db
    .select({ mine: sql<number>`count(*)::int` })
    .from(studyRooms)
    .where(eq(studyRooms.createdBy, userId));
  if (mine >= MAX_ROOMS_PER_USER) {
    throw new Error(`每人最多只能建立 ${MAX_ROOMS_PER_USER} 間自習室`);
  }

  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // 讓新建房間排在最前面（既有預設房 sortOrder 通常為 0）
    const [{ minOrder }] = await tx
      .select({ minOrder: sql<number>`coalesce(min(${studyRooms.sortOrder}), 0)::int` })
      .from(studyRooms);

    await tx.insert(studyRooms).values({
      id,
      name,
      subject: subject || null,
      description: description || null,
      capacity,
      password,
      createdBy: userId,
      sortOrder: minOrder - 1,
    });

    // 建立者自動加入，並設為房間管理員（is_moderator）
    await tx
      .insert(studyRoomMembers)
      .values({ roomId: id, userId, isModerator: true })
      .onConflictDoNothing();
  });

  revalidateRoom(id);
}

/**
 * 編輯自習室：標題/科目/說明/人數上限/密碼。
 * 僅建立者或系統管理員可編輯。人數上限不可低於目前成員數。
 */
export async function updateRoom(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  const roomId = String(formData.get("roomId") ?? "");
  if (!roomId) throw new Error("缺少自習室");

  const { canEdit } = await getRoomAuthority(roomId, userId, isAdmin);
  if (!canEdit) throw new Error("只有建立者或系統管理員可以編輯自習室");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 60);
  const description = String(formData.get("description") ?? "").trim().slice(0, 300);
  if (!name) throw new Error("請輸入自習室名稱");

  const capacityRaw = Number(formData.get("capacity"));
  let capacity =
    Number.isFinite(capacityRaw) && capacityRaw >= 2
      ? Math.min(Math.floor(capacityRaw), 12)
      : 8;

  // 密碼處理：勾選「移除密碼」則清空；否則空字串保持原密碼不變，有值則更新。
  const removePassword = String(formData.get("removePassword") ?? "") === "on";
  const passwordRaw = normalizePassword(formData.get("password"));

  await db.transaction(async (tx) => {
    // 人數上限不可低於目前成員數
    const [{ c }] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(studyRoomMembers)
      .where(eq(studyRoomMembers.roomId, roomId));
    if (capacity < c) capacity = c;

    const patch: {
      name: string;
      subject: string | null;
      description: string | null;
      capacity: number;
      password?: string | null;
    } = {
      name,
      subject: subject || null,
      description: description || null,
      capacity,
    };
    if (removePassword) patch.password = null;
    else if (passwordRaw !== null) patch.password = passwordRaw;

    await tx.update(studyRooms).set(patch).where(eq(studyRooms.id, roomId));
  });

  revalidateRoom(roomId);
}

/**
 * 指定/取消房間管理員（is_moderator）。僅建立者或系統管理員可操作。
 * 不允許對建立者自身降權（建立者恆為管理員）。
 */
export async function setRoomModerator(
  roomId: string,
  targetUserId: string,
  on: boolean,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  if (!roomId || !targetUserId) throw new Error("缺少參數");

  const [room] = await db
    .select({ createdBy: studyRooms.createdBy })
    .from(studyRooms)
    .where(eq(studyRooms.id, roomId))
    .limit(1);
  if (!room) throw new Error("自習室不存在");

  if (room.createdBy !== userId && !isAdmin) {
    throw new Error("只有建立者或系統管理員可以指定房間管理員");
  }
  // 建立者本身固定為管理員，不可在此被改動
  if (targetUserId === room.createdBy) {
    throw new Error("建立者恆為房間管理員");
  }

  await db
    .update(studyRoomMembers)
    .set({ isModerator: on })
    .where(
      and(
        eq(studyRoomMembers.roomId, roomId),
        eq(studyRoomMembers.userId, targetUserId),
      ),
    );

  revalidateRoom(roomId);
}

/**
 * 踢出成員：房間管理員（建立者/管理員/系統 admin）可移除某成員。
 * 不可踢建立者；不可踢比自己權限高者（管理員不可踢建立者，已涵蓋）。
 * 實際的 socket 斷線通知由 server.mjs 的 voice:kick 事件處理（或下次連線即被擋）。
 */
export async function kickMember(roomId: string, targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  if (!roomId || !targetUserId) throw new Error("缺少參數");

  const [room] = await db
    .select({ createdBy: studyRooms.createdBy })
    .from(studyRooms)
    .where(eq(studyRooms.id, roomId))
    .limit(1);
  if (!room) throw new Error("自習室不存在");

  const { canModerate } = await getRoomAuthority(roomId, userId, isAdmin);
  if (!canModerate) throw new Error("沒有踢人權限");

  if (targetUserId === room.createdBy) throw new Error("無法踢出建立者");
  if (targetUserId === userId) throw new Error("無法踢出自己");

  await db
    .delete(studyRoomMembers)
    .where(
      and(
        eq(studyRoomMembers.roomId, roomId),
        eq(studyRoomMembers.userId, targetUserId),
      ),
    );

  revalidateRoom(roomId);
}

export async function leaveRoom(formData: FormData) {
  const userId = await requireUserId();
  const roomId = String(formData.get("roomId") ?? "");
  if (!roomId) throw new Error("缺少自習室");

  await db
    .delete(studyRoomMembers)
    .where(
      and(
        eq(studyRoomMembers.roomId, roomId),
        eq(studyRoomMembers.userId, userId),
      ),
    );
  revalidateRoom(roomId);
}

/** 解散自習室：僅建立者或系統管理員可刪除（成員以 FK cascade 一併移除）。 */
export async function deleteRoom(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roomId = String(formData.get("roomId") ?? "");
  if (!roomId) throw new Error("缺少自習室");

  const [room] = await db
    .select({ createdBy: studyRooms.createdBy })
    .from(studyRooms)
    .where(eq(studyRooms.id, roomId))
    .limit(1);
  if (!room) throw new Error("自習室不存在");

  const isAdmin = session.user.role === "admin";
  if (room.createdBy !== session.user.id && !isAdmin) {
    throw new Error("只有建立者或系統管理員可以解散自習室");
  }

  await db.delete(studyRooms).where(eq(studyRooms.id, roomId));
  revalidatePath("/study-rooms");
  redirect("/study-rooms");
}
