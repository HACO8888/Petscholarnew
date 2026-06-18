"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { studyRooms, studyRoomMembers } from "@/db/schema";

// 每位使用者最多可建立的自習室數（避免無限建立造成垃圾/孤兒資料）
const MAX_ROOMS_PER_USER = 5;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

function revalidateRoom(roomId?: string) {
  revalidatePath("/study-rooms");
  if (roomId) revalidatePath(`/study-rooms/${roomId}`);
}

export async function joinRoom(formData: FormData) {
  const userId = await requireUserId();
  const roomId = String(formData.get("roomId") ?? "");
  if (!roomId) throw new Error("缺少自習室");

  await db.transaction(async (tx) => {
    // 鎖定房間列，序列化同房的併發加入，避免 count-then-insert 競態超員
    const [room] = await tx
      .select({ capacity: studyRooms.capacity })
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
      createdBy: userId,
      sortOrder: minOrder - 1,
    });

    // 建立者自動加入
    await tx
      .insert(studyRoomMembers)
      .values({ roomId: id, userId })
      .onConflictDoNothing();
  });

  revalidateRoom(id);
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
