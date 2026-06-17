import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { studyRooms, studyRoomMembers } from "@/db/schema";
import { joinRoom, leaveRoom } from "./actions";

export default async function StudyRoomsPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const rooms = await db
    .select({
      id: studyRooms.id,
      name: studyRooms.name,
      subject: studyRooms.subject,
      description: studyRooms.description,
      capacity: studyRooms.capacity,
      members: sql<number>`(select count(*)::int from ${studyRoomMembers} where ${studyRoomMembers.roomId} = ${studyRooms.id})`,
    })
    .from(studyRooms)
    .orderBy(studyRooms.sortOrder);

  let joined = new Set<string>();
  if (userId) {
    const mine = await db
      .select({ roomId: studyRoomMembers.roomId })
      .from(studyRoomMembers)
      .where(eq(studyRoomMembers.userId, userId));
    joined = new Set(mine.map((m) => m.roomId));
  }

  return (
    <section>
      <div className="mb-lg">
        <h1 className="text-headline-lg font-semibold text-on-background">自習室</h1>
        <p className="mt-1 text-body-md text-secondary">加入讀書房間，與同學一起共讀、完成讀書目標。</p>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => {
          const isMember = joined.has(room.id);
          const full = room.members >= room.capacity && !isMember;
          return (
            <div
              key={room.id}
              className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 dark:bg-surface-container"
            >
              <h2 className="text-body-lg font-semibold text-on-background">{room.name}</h2>
              {room.subject && (
                <span className="mt-1 inline-block w-fit rounded-full bg-secondary-container px-2 py-0.5 text-label-md text-on-secondary-container">
                  {room.subject}
                </span>
              )}
              <p className="mt-2 flex-1 text-label-md text-secondary">{room.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-label-md text-secondary">
                  👥 {room.members} / {room.capacity}
                </span>
                {userId ? (
                  <form action={isMember ? leaveRoom : joinRoom}>
                    <input type="hidden" name="roomId" value={room.id} />
                    <button
                      type="submit"
                      disabled={full}
                      className={`rounded-full px-4 py-1.5 text-label-md font-bold transition-all disabled:opacity-50 ${
                        isMember
                          ? "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                          : "bg-primary text-on-primary hover:bg-surface-tint"
                      }`}
                    >
                      {isMember ? "離開" : full ? "已滿" : "加入"}
                    </button>
                  </form>
                ) : (
                  <Link href="/login" className="text-label-md text-primary hover:underline">
                    登入以加入
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
