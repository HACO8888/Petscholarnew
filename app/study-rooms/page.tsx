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
    <div className="max-w-6xl mx-auto space-y-xl">
      {/* Page Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">自習室</h1>
          <p className="font-body-md text-body-md text-secondary">加入自習室與其他同學一起專注學習</p>
        </div>
        <div className="hidden sm:flex items-center gap-sm bg-surface-container px-md py-sm rounded-full shadow-sm">
          <span className="material-symbols-outlined text-tertiary">account_balance_wallet</span>
          <span className="font-label-md text-label-md text-on-surface">餘額: 120 枚金幣</span>
        </div>
      </header>

      {/* Study Radar Section */}
      <section className="bg-surface-container-low rounded-xl p-lg border border-outline-variant/50">
        <div className="flex items-center justify-between mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">radar</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">學習雷達</h2>
            <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-label-md text-[10px]">
              附近在線 24 人
            </span>
          </div>
          <button className="text-primary hover:underline font-label-md text-label-md">查看全部</button>
        </div>
        <div className="flex gap-md overflow-x-auto hide-scrollbar pb-sm">
          {/* Radar Item 1 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-primary transition-colors">
              <img
                alt="Student 1"
                className="w-full h-full rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgxMHO6xe4zUswzQvFNoe85-NrjfXlpT91Lv4XcLSKWLz1ZjW1dc_DEFcCJbEQXRUF9VnnicIWemKTBkdByfMNTSXF6Q8dbO-AVEGp_xIRHfPwmoY-R6Xe8wvbOOgNgVRxC-NmZ1t2fQhTbQUvz4yjwB5m-i_ojzmmRPUuxcW4DKxaPf4fZpApVYSvt-QlE4_wUopPObW84JlD6UC_D2u-gVWU1C2cCuqCMnUIAngqeEYXyPMu6hlGXa2hT-otlxUlQVaFWD_vpHVr"
              />
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#4ade80] rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-on-surface mt-xs truncate w-full text-center">Alice</span>
          </div>
          {/* Radar Item 2 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-primary transition-colors">
              <img
                alt="Student 2"
                className="w-full h-full rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuwwTybjO4ML4U7OYzYl8S6-4K8tOtMz08IZZqKXtyI3fios2UykUf0enLDDoY4TR0vKKQAKNKrrvbX9f6WJx_wZL6_C8wl7ZkHPQfzacRfp2LAh4x7B-I_GK0TeKgs9CUCbZWwJi9MCoG1QuKLxmR_rXe2tiVjMJVBY18eHJsvGsVWoVqywAg99ojg-JnZiLlr0H2mngsiusXyCrNxPSYbIfZAf5Ug_yq4gTSxhFHtdCnQMDswrG8e_t97c0WG1W1XAbw29Hm2FeN"
              />
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#4ade80] rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-on-surface mt-xs truncate w-full text-center">Bob M.</span>
          </div>
          {/* Radar Item 3 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group opacity-60 hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-secondary transition-colors">
              <div className="w-full h-full rounded-full bg-secondary-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-secondary rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-secondary mt-xs truncate w-full text-center">Charlie</span>
          </div>
          {/* Radar Item 4 */}
          <div className="flex flex-col items-center min-w-[80px] cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-primary transition-colors">
              <img
                alt="Student 4"
                className="w-full h-full rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbrOvwbntl_YpDeGO76BqUGUVtrU2GHssDtmHVh8fBLmcvj0pvF5FSBH9E-LPNmP2OpTPIDFaTDed-bZLm0AQcwpquASQdq1LwKwKjADHSBaYa29Ck68vEmkbO1CM1ymm354mv4i4wuCkmr4PS3lrxG2TX1u9C0YnqQEyeBs91xRjqL9042NvkQvSeqnj84WLWheVMMIwaMVLSf4uiIGcljz7XxbFz5zxE4FbnGxty-deaPNDbIOTbxTgLz6kdVKvS9fZlvKLT3OgV"
              />
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#facc15] rounded-full border-2 border-surface" />
            </div>
            <span className="font-label-md text-label-md text-on-surface mt-xs truncate w-full text-center">David</span>
          </div>
        </div>
      </section>

      {/* Active Study Rooms */}
      <section>
        <div className="flex items-center justify-between mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">meeting_room</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">活躍自習室</h2>
          </div>
          <button className="px-md py-xs bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant transition-colors shadow-sm flex items-center gap-xs">
            <span className="material-symbols-outlined text-[16px]">add</span> 建立房間
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {rooms.map((room) => {
            const isMember = joined.has(room.id);
            const full = room.members >= room.capacity && !isMember;
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
                    <span className="font-label-md text-label-md text-secondary flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px]">group</span>
                      {room.members} / {room.capacity}
                    </span>
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
      </section>
    </div>
  );
}
