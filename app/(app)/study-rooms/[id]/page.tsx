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
      joinedAt: studyRoomMembers.joinedAt,
    })
    .from(studyRoomMembers)
    .innerJoin(users, eq(studyRoomMembers.userId, users.id))
    .where(eq(studyRoomMembers.roomId, id))
    .orderBy(asc(studyRoomMembers.joinedAt));

  const members = memberRows.map((m) => ({
    id: m.userId,
    name: m.name ?? "成員",
    isSelf: m.userId === userId,
  }));

  const canManage =
    room.createdBy === userId || session?.user?.role === "admin";

  return (
    <StudyRoomDetail
      room={{
        id: room.id,
        name: room.name,
        subject: room.subject,
        description: room.description,
        capacity: room.capacity,
      }}
      members={members}
      memberCount={members.length}
      meName={session?.user?.name ?? "你"}
      canManage={canManage}
    />
  );
}
