import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { studyRooms, studyRoomMembers, users } from "@/db/schema";
import StudyRoomDetail from "@/components/StudyRoomDetail";

export default async function StudyRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) redirect("/login");

  const [room] = await db
    .select()
    .from(studyRooms)
    .where(eq(studyRooms.id, id))
    .limit(1);
  if (!room) notFound();

  const memberRows = await db
    .select({
      userId: studyRoomMembers.userId,
      name: users.name,
      image: users.image,
      isModerator: studyRoomMembers.isModerator,
      joinedAt: studyRoomMembers.joinedAt,
    })
    .from(studyRoomMembers)
    .innerJoin(users, eq(studyRoomMembers.userId, users.id))
    .where(eq(studyRoomMembers.roomId, id))
    .orderBy(asc(studyRoomMembers.joinedAt));

  const members = memberRows.map((m) => ({
    id: m.userId,
    name: m.name ?? "成員",
    image: m.image ?? null,
    isSelf: m.userId === userId,
    isModerator: m.isModerator,
    isOwner: m.userId === room.createdBy,
  }));

  // 建立者顯示名稱（null = 系統房間）
  let creatorName: string | null = null;
  if (room.createdBy) {
    const [creator] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, room.createdBy))
      .limit(1);
    creatorName = creator?.name ?? "成員";
  }

  const isAdmin = session?.user?.role === "admin";
  const isOwner = room.createdBy === userId;
  const myMembership = members.find((m) => m.isSelf);
  const isModerator = Boolean(myMembership?.isModerator);

  const canEdit = isOwner || isAdmin;
  const canManage = isOwner || isAdmin; // 解散
  const canModerate = isOwner || isModerator || isAdmin; // 禁麥/禁鏡/踢人
  const isMember = Boolean(myMembership);
  const isFull = members.length >= room.capacity;

  return (
    <StudyRoomDetail
      room={{
        id: room.id,
        name: room.name,
        subject: room.subject,
        description: room.description,
        capacity: room.capacity,
        // 只回傳布林旗標，不外洩密碼明碼
        hasPassword: Boolean(room.password),
      }}
      members={members}
      memberCount={members.length}
      meId={userId}
      canManage={canManage}
      canEdit={canEdit}
      canModerate={canModerate}
      isMember={isMember}
      isFull={isFull}
      creatorName={creatorName}
    />
  );
}
