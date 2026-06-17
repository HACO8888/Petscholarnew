"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { studyRooms, studyRoomMembers } from "@/db/schema";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function joinRoom(formData: FormData) {
  const userId = await requireUserId();
  const roomId = String(formData.get("roomId") ?? "");
  if (!roomId) throw new Error("缺少自習室");

  const [room] = await db
    .select()
    .from(studyRooms)
    .where(eq(studyRooms.id, roomId))
    .limit(1);
  if (!room) throw new Error("自習室不存在");

  const [already] = await db
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

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(studyRoomMembers)
    .where(eq(studyRoomMembers.roomId, roomId));
  if (c >= room.capacity) throw new Error("自習室已滿");

  await db
    .insert(studyRoomMembers)
    .values({ roomId, userId })
    .onConflictDoNothing();
  revalidatePath("/study-rooms");
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
  revalidatePath("/study-rooms");
}
