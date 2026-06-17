import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { studyRooms, studyRoomMembers, users } from "@/db/schema";
import { createRoom, joinRoom, leaveRoom } from "./actions";

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
    .orderBy(asc(studyRooms.sortOrder));

  // 各房成員（真實使用者頭像/名稱），用於卡片底部頭像堆疊
  const memberRows = await db
    .select({
      roomId: studyRoomMembers.roomId,
      image: users.image,
      name: users.name,
      joinedAt: studyRoomMembers.joinedAt,
    })
    .from(studyRoomMembers)
    .innerJoin(users, eq(studyRoomMembers.userId, users.id))
    .orderBy(asc(studyRoomMembers.joinedAt));

  const membersByRoom = new Map<
    string,
    { image: string | null; name: string | null }[]
  >();
  for (const m of memberRows) {
    const list = membersByRoom.get(m.roomId) ?? [];
    list.push({ image: m.image, name: m.name });
    membersByRoom.set(m.roomId, list);
  }

  let joined = new Set<string>();
  if (userId) {
    const mine = await db
      .select({ roomId: studyRoomMembers.roomId })
      .from(studyRoomMembers)
      .where(eq(studyRoomMembers.userId, userId));
    joined = new Set(mine.map((m) => m.roomId));
  }

  return (
    <div className="max-w-6xl mx-auto space-y-xl">
      {/* Page Header */}
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">自習室</h1>
        <p className="font-body-md text-body-md text-secondary">加入自習室與其他同學一起專注學習</p>
      </header>

      {/* Active Study Rooms */}
      <section>
        <div className="flex items-center justify-between mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">meeting_room</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">活躍自習室</h2>
          </div>
          {userId ? (
            <details className="relative group/create">
              <summary className="list-none cursor-pointer px-md py-xs bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant transition-colors shadow-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-[16px]">add</span> 建立房間
              </summary>
              <form
                action={createRoom}
                className="absolute right-0 z-10 mt-sm w-80 bg-surface-container-lowest dark:bg-surface-container-high rounded-2xl border border-outline-variant/40 shadow-xl p-md space-y-md"
              >
                <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1">
                  <span>📡</span> 建立自習室
                </h3>
                <div>
                  <label
                    htmlFor="room-name"
                    className="block text-xs font-bold text-secondary mb-1"
                  >
                    自習室名稱
                  </label>
                  <input
                    id="room-name"
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    placeholder="例：微積分期末衝刺營"
                    className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="room-subject"
                    className="block text-xs font-bold text-secondary mb-1"
                  >
                    科目 / 主題（選填）
                  </label>
                  <input
                    id="room-subject"
                    name="subject"
                    type="text"
                    maxLength={40}
                    placeholder="例：微積分"
                    className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="room-description"
                    className="block text-xs font-bold text-secondary mb-1"
                  >
                    說明（選填）
                  </label>
                  <input
                    id="room-description"
                    name="description"
                    type="text"
                    maxLength={120}
                    placeholder="例：專注模式，請勿開麥。"
                    className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="room-capacity"
                    className="block text-xs font-bold text-secondary mb-1"
                  >
                    人數上限
                  </label>
                  <input
                    id="room-capacity"
                    name="capacity"
                    type="number"
                    min={2}
                    max={12}
                    defaultValue={8}
                    className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-5 py-2 bg-primary text-on-primary rounded-lg font-bold text-xs hover:bg-surface-tint shadow transition-all"
                >
                  建立並加入
                </button>
              </form>
            </details>
          ) : (
            <Link
              href="/login"
              className="px-md py-xs bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant transition-colors shadow-sm flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> 登入以建立
            </Link>
          )}
        </div>
        {rooms.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-xl border border-outline-variant/50 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">meeting_room</span>
            <p className="font-body-md text-body-md text-secondary mt-sm">
              目前還沒有自習室
              {userId ? "，點「建立房間」開一間吧！" : "，登入後即可建立。"}
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {rooms.map((room) => {
            const isMember = joined.has(room.id);
            const full = room.members >= room.capacity && !isMember;
            const roomMembers = membersByRoom.get(room.id) ?? [];
            const avatars = roomMembers.slice(0, 3);
            const extra = room.members - avatars.length;
            return (
              <div
                key={room.id}
                className="bg-surface-bright rounded-xl p-md border border-outline-variant shadow-sm hover:shadow-md transition-shadow group flex items-start gap-md dark:bg-surface-container"
              >
                <div className="w-16 h-16 rounded-lg bg-primary-container flex-shrink-0 flex items-center justify-center text-on-primary-container">
                  <span className="material-symbols-outlined text-[32px]">menu_book</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-xs gap-sm">
                    <h3 className="font-body-lg text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                      {room.name}
                    </h3>
                    {room.subject && (
                      <span className="shrink-0 bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
                        {room.subject}
                      </span>
                    )}
                  </div>
                  <p className="font-body-md text-body-md text-secondary mb-sm line-clamp-1">{room.description}</p>
                  <div className="flex items-center justify-between gap-sm">
                    <div className="flex items-center gap-sm">
                      {avatars.length > 0 && (
                        <div className="flex -space-x-2">
                          {avatars.map((m, i) =>
                            m.image ? (
                              <img
                                key={i}
                                alt={m.name ?? "成員"}
                                src={m.image}
                                className="w-6 h-6 rounded-full border border-surface object-cover bg-surface-container-high"
                              />
                            ) : (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full border border-surface bg-secondary-container flex items-center justify-center text-on-secondary-container"
                              >
                                <span className="material-symbols-outlined text-[14px]">person</span>
                              </div>
                            ),
                          )}
                          {extra > 0 && (
                            <div className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-secondary">
                              +{extra}
                            </div>
                          )}
                        </div>
                      )}
                      <span className="font-label-md text-label-md text-secondary flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[16px]">group</span>
                        {room.members} / {room.capacity}
                      </span>
                    </div>
                    {userId ? (
                      <form action={isMember ? leaveRoom : joinRoom}>
                        <input type="hidden" name="roomId" value={room.id} />
                        <button
                          type="submit"
                          disabled={full}
                          className={`rounded-full px-4 py-1.5 font-label-md text-label-md font-bold transition-all disabled:opacity-50 flex items-center gap-xs ${
                            isMember
                              ? "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                              : "bg-primary text-on-primary hover:bg-surface-tint"
                          }`}
                        >
                          {isMember ? "離開" : full ? "已滿" : "加入"}
                          {!isMember && !full && (
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          )}
                        </button>
                      </form>
                    ) : (
                      <Link
                        href="/login"
                        className="text-primary font-label-md text-label-md hover:underline flex items-center gap-xs"
                      >
                        登入以加入
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </section>
    </div>
  );
}
