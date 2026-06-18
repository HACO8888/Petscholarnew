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

  // 各房成員（真實使用者），用於堆疊頭像
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
    <div className="space-y-xl">
      {/* Page Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">
            自習室
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            加入自習室與其他同學一起專注學習
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-sm bg-surface-container px-md py-sm rounded-full shadow-sm">
          <span className="material-symbols-outlined text-tertiary">
            account_balance_wallet
          </span>
          <span className="font-label-md text-label-md text-on-surface">
            餘額: 120 枚金幣
          </span>
        </div>
      </header>

      {/* Study Radar Section */}
      <section className="bg-surface-container-low rounded-xl p-lg border border-outline-variant/50">
        <div className="flex items-center justify-between mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">radar</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              學習雷達
            </h2>
            <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-label-md text-[10px]">
              附近在線 24 人
            </span>
          </div>
          <button className="text-primary hover:underline font-label-md text-label-md">
            查看全部
          </button>
        </div>
        <div className="flex gap-md overflow-x-auto hide-scrollbar pb-sm">
          {/* Radar Item 1 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-primary transition-colors">
              { }
              <img
                alt="Student 1"
                className="w-full h-full rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgxMHO6xe4zUswzQvFNoe85-NrjfXlpT91Lv4XcLSKWLz1ZjW1dc_DEFcCJbEQXRUF9VnnicIWemKTBkdByfMNTSXF6Q8dbO-AVEGp_xIRHfPwmoY-R6Xe8wvbOOgNgVRxC-NmZ1t2fQhTbQUvz4yjwB5m-i_ojzmmRPUuxcW4DKxaPf4fZpApVYSvt-QlE4_wUopPObW84JlD6UC_D2u-gVWU1C2cCuqCMnUIAngqeEYXyPMu6hlGXa2hT-otlxUlQVaFWD_vpHVr"
              />
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#4ade80] rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-on-surface mt-xs truncate w-full text-center">
              Alice
            </span>
          </div>
          {/* Radar Item 2 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-primary transition-colors">
              { }
              <img
                alt="Student 2"
                className="w-full h-full rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuwwTybjO4ML4U7OYzYl8S6-4K8tOtMz08IZZqKXtyI3fios2UykUf0enLDDoY4TR0vKKQAKNKrrvbX9f6WJx_wZL6_C8wl7ZkHPQfzacRfp2LAh4x7B-I_GK0TeKgs9CUCbZWwJi9MCoG1QuKLxmR_rXe2tiVjMJVBY18eHJsvGsVWoVqywAg99ojg-JnZiLlr0H2mngsiusXyCrNxPSYbIfZAf5Ug_yq4gTSxhFHtdCnQMDswrG8e_t97c0WG1W1XAbw29Hm2FeN"
              />
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#4ade80] rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-on-surface mt-xs truncate w-full text-center">
              Bob M.
            </span>
          </div>
          {/* Radar Item 3 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group opacity-60 hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-secondary transition-colors">
              <div className="w-full h-full rounded-full bg-secondary-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-secondary rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-secondary mt-xs truncate w-full text-center">
              Charlie
            </span>
          </div>
          {/* Radar Item 4 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-primary transition-colors">
              { }
              <img
                alt="Student 4"
                className="w-full h-full rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbrOvwbntl_YpDeGO76BqUGUVtrU2GHssDtmHVh8fBLmcvj0pvF5FSBH9E-LPNmP2OpTPIDFaTDed-bZLm0AQcwpquASQdq1LwKwKjADHSBaYa29Ck68vEmkbO1CM1ymm354mv4i4wuCkmr4PS3lrxG2TX1u9C0YnqQEyeBs91xRjqL9042NvkQvSeqnj84WLWheVMMIwaMVLSf4uiIGcljz7XxbFz5zxE4FbnGxty-deaPNDbIOTbxTgLz6kdVKvS9fZlvKLT3OgV"
              />
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#facc15] rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-on-surface mt-xs truncate w-full text-center">
              David
            </span>
          </div>
        </div>
      </section>

      {/* Active Study Rooms */}
      <section>
        <div className="flex items-center justify-between mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">
              meeting_room
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              活躍自習室
            </h2>
          </div>
          {userId ? (
            <details className="relative">
              <summary className="list-none cursor-pointer px-md py-xs bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant transition-colors shadow-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-[16px]">add</span>{" "}
                建立房間
              </summary>
              <form
                action={createRoom}
                className="absolute right-0 z-10 mt-sm w-80 bg-surface-container-lowest dark:bg-surface-container-high rounded-2xl border border-outline-variant/40 shadow-xl p-md space-y-md"
              >
                <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1">
                  <span>📡</span> 發起課業共讀邀約
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
                  className="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-0.5 transition-all shadow-sm"
                >
                  建立並加入
                </button>
              </form>
            </details>
          ) : (
            <Link
              href="/login"
              className="px-md py-xs bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant transition-colors shadow-sm flex items-center gap-xs no-underline"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>{" "}
              登入以建立
            </Link>
          )}
        </div>

        {rooms.length === 0 ? (
          <p className="font-body-md text-body-md text-secondary">
            目前沒有活躍自習室。
          </p>
        ) : (
          <div
            id="study-rooms-grid"
            className="grid grid-cols-1 md:grid-cols-2 gap-md"
          >
            {rooms.map((room, idx) => {
              const isMember = joined.has(room.id);
              const full = room.members >= room.capacity && !isMember;
              const isFull = room.members >= room.capacity;
              const roomMembers = membersByRoom.get(room.id) ?? [];
              const shownMembers = roomMembers.slice(0, 2);
              const extra = room.members - shownMembers.length;
              const isHot = idx === 0;
              return (
                <div
                  key={room.id}
                  id={`room-card-${room.id}`}
                  className="bg-surface-bright rounded-xl p-md border border-outline-variant shadow-sm hover:shadow-md transition-shadow group flex items-start gap-md"
                >
                  <div className="w-16 h-16 rounded-lg bg-primary-container flex-shrink-0 flex items-center justify-center text-on-primary-container">
                    <span className="material-symbols-outlined text-[32px]">
                      menu_book
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-xs">
                      <h3 className="font-body-lg text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                        {room.subject || room.name}
                      </h3>
                      {isFull ? (
                        <span className="bg-error-container text-on-error-container px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
                          滿員
                        </span>
                      ) : isHot ? (
                        <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
                          HOT
                        </span>
                      ) : null}
                    </div>
                    <p className="font-body-md text-body-md text-secondary mb-sm line-clamp-1">
                      {room.description || room.name}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {shownMembers.map((m, i) =>
                          m.image ? (
                             
                            <img
                              key={i}
                              alt={m.name ?? "Participant"}
                              className="w-6 h-6 rounded-full border border-surface object-cover"
                              src={m.image}
                            />
                          ) : (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full border border-surface bg-secondary-container flex items-center justify-center text-on-secondary-container"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                person
                              </span>
                            </div>
                          ),
                        )}
                        {extra > 0 && (
                          <div className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-secondary">
                            +{extra}
                          </div>
                        )}
                        {room.members === 0 && (
                          <span className="text-[10px] text-secondary">
                            尚無人加入 (0/{room.capacity})
                          </span>
                        )}
                      </div>
                      {userId ? (
                        <div className="flex items-center gap-sm">
                          <form action={isMember ? leaveRoom : joinRoom}>
                            <input
                              type="hidden"
                              name="roomId"
                              value={room.id}
                            />
                            <button
                              type="submit"
                              disabled={full}
                              className="text-primary font-label-md text-label-md hover:underline flex items-center gap-xs disabled:opacity-50"
                            >
                              {isMember ? "離開" : full ? "滿員" : "加入"}
                            </button>
                          </form>
                          <Link
                            href={`/study-rooms/${room.id}`}
                            className="text-primary font-label-md text-label-md hover:underline flex items-center gap-xs no-underline"
                          >
                            進入{" "}
                            <span className="material-symbols-outlined text-[16px]">
                              arrow_forward
                            </span>
                          </Link>
                        </div>
                      ) : (
                        <Link
                          href="/login"
                          className="text-primary font-label-md text-label-md hover:underline flex items-center gap-xs no-underline"
                        >
                          登入以加入{" "}
                          <span className="material-symbols-outlined text-[16px]">
                            arrow_forward
                          </span>
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
