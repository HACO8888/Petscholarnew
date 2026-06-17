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

  // 各房成員（真實使用者名稱），用於「當前人員」列表
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

  // 雷達為裝飾性掃描動畫，靜態呈現附近讀書據點（非真人資料）
  const radarPins = [
    { id: "pin-lib", name: "K書中心", x: 32, y: 28, icon: "📖" },
    { id: "pin-ee", name: "電機系自習室", x: 72, y: 44, icon: "⚡" },
    { id: "pin-red", name: "紅樓咖啡館", x: 55, y: 72, icon: "🏫" },
  ];

  return (
    <section id="sect-radar">
      <style
        dangerouslySetInnerHTML={{
          __html: `
.radar-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(75, 97, 114, 0.3);
  border-radius: 50%;
  animation: radar-pulse 3s linear infinite;
  pointer-events: none;
}
.radar-circle.circle-1 { width: 100px; height: 100px; animation-delay: 0s; }
.radar-circle.circle-2 { width: 200px; height: 200px; animation-delay: 1s; }
.radar-circle.circle-3 { width: 300px; height: 300px; animation-delay: 2s; }
@keyframes radar-pulse {
  0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
}
.radar-sweep {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150px;
  height: 150px;
  background: conic-gradient(from 0deg, rgba(75, 97, 114, 0.15) 0%, transparent 50%);
  transform-origin: top left;
  animation: radar-sweep-anim 4s linear infinite;
  pointer-events: none;
}
@keyframes radar-sweep-anim {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.radar-scanner-container {
  position: relative;
  width: 100%;
  height: 320px;
  background: #f0f2f5;
  border: 1px solid #c3c7cc;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}
.dark .radar-scanner-container {
  background: #090e18;
  border-color: rgba(255, 255, 255, 0.08);
}
.radar-pin {
  position: absolute;
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: transform 0.2s;
}
.radar-pin:hover {
  transform: translate(-50%, -50%) scale(1.2);
}
`,
        }}
      />
      <div className="mb-lg">
        <h1 className="font-semibold text-headline-lg text-on-background">自習室</h1>
        <p className="text-secondary text-body-md">加入自習小組，與同儕一起進步、為寵物賺取經驗！</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        {/* Scanner Card */}
        <div className="lg:col-span-5 bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm">
          <h3 className="font-bold text-body-lg text-on-surface mb-md flex items-center gap-1">
            <span className="material-symbols-outlined text-primary">radar</span> 一起讀書雷達
          </h3>

          <div className="radar-scanner-container relative">
            <div className="radar-circle circle-1" />
            <div className="radar-circle circle-2" />
            <div className="radar-circle circle-3" />
            <div className="radar-sweep" />
            <div className="radar-pins-container" id="radar-pins">
              {radarPins.map((p) => (
                <div
                  key={p.id}
                  className="radar-pin text-xl"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={p.name}
                >
                  {p.icon}
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-primary dark:text-primary-fixed bg-surface-container/10 pointer-events-none text-center">
              🏫
              <br />
              北科大
            </div>
          </div>

          <div className="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md py-2.5 rounded-lg mt-md shadow-sm transition-all flex items-center justify-center gap-1">
            <span className="material-symbols-outlined">refresh</span> 重新掃描附近讀書夥伴
          </div>
        </div>

        {/* Active Study Rooms list */}
        <div className="lg:col-span-7 bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-md border-b border-outline-variant/20 pb-3">
            <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1">
              <span className="material-symbols-outlined text-primary">meeting_room</span> 活躍中的讀書小組
            </h3>
            {userId ? (
              <details className="relative">
                <summary className="list-none cursor-pointer bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-0.5 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-xs">add</span> 發起邀約
                </summary>
                <form
                  action={createRoom}
                  className="absolute right-0 z-10 mt-sm w-80 bg-surface-container-lowest dark:bg-surface-container-high rounded-2xl border border-outline-variant/40 shadow-xl p-md space-y-md"
                >
                  <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1">
                    <span>📡</span> 發起邀約
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
                className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-0.5 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-xs">add</span> 登入以發起
              </Link>
            )}
          </div>

          <div className="space-y-md" id="study-rooms-list">
            {rooms.length === 0 ? (
              <p className="text-[11px] text-secondary">目前沒有活躍中的讀書小組。</p>
            ) : (
              rooms.map((room) => {
                const isMember = joined.has(room.id);
                const full = room.members >= room.capacity && !isMember;
                const roomMembers = membersByRoom.get(room.id) ?? [];
                const participants = roomMembers
                  .map((m) => m.name ?? "成員")
                  .join("、");
                return (
                  <div
                    key={room.id}
                    className="bg-surface-container-low dark:bg-surface p-md rounded-xl border border-outline-variant/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-md"
                    id={`room-card-${room.id}`}
                  >
                    <div className="flex-grow space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-body-lg text-on-surface">
                          {room.subject || room.name}
                        </h4>
                        {room.members >= room.capacity && (
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.2 rounded text-[9px] font-bold">
                            滿員
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-secondary space-x-md">
                        <span>📅 時間: {room.name}</span>
                        <span>📍 地點: {room.description || "—"}</span>
                      </div>
                      <p className="text-[10px] text-secondary">
                        👥 當前人員: {participants || "尚無人加入"} ({room.members}/
                        {room.capacity}人)
                      </p>
                    </div>
                    {userId ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/study-rooms/${room.id}`}
                          className="bg-surface-container border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1 no-underline"
                        >
                          <span className="material-symbols-outlined text-sm">
                            login
                          </span>{" "}
                          進入自習室
                        </Link>
                        <form action={isMember ? leaveRoom : joinRoom}>
                          <input type="hidden" name="roomId" value={room.id} />
                          <button
                            type="submit"
                            disabled={full}
                            className={
                              isMember
                                ? "bg-surface-container border border-outline-variant/30 text-secondary font-bold text-xs px-4 py-2 rounded-lg"
                                : "bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-sm disabled:opacity-50"
                            }
                          >
                            {isMember ? "離開共讀" : full ? "滿員" : "加入共讀"}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <Link
                        href="/login"
                        className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-sm"
                      >
                        登入以加入
                      </Link>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
