import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { studyRooms, studyRoomMembers, users, pets } from "@/db/schema";
import StudyRoomCreateForm from "@/components/StudyRoomCreateForm";

function initial(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export default async function StudyRoomsPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // 使用者金幣餘額（真實寵物錢包）
  let coins: number | null = null;
  if (userId) {
    const [pet] = await db
      .select({ coins: pets.coins })
      .from(pets)
      .where(eq(pets.userId, userId))
      .limit(1);
    coins = pet?.coins ?? 0;
  }

  // 別名 user 表用於 join 建立者名稱（不外洩密碼明碼，只取 hasPassword 旗標）
  const creators = alias(users, "creators");
  const rooms = await db
    .select({
      id: studyRooms.id,
      name: studyRooms.name,
      subject: studyRooms.subject,
      description: studyRooms.description,
      capacity: studyRooms.capacity,
      hasPassword: sql<boolean>`(${studyRooms.password} is not null)`,
      creatorName: creators.name,
      members: sql<number>`(select count(*)::int from ${studyRoomMembers} where ${studyRoomMembers.roomId} = ${studyRooms.id})`,
    })
    .from(studyRooms)
    .leftJoin(creators, eq(studyRooms.createdBy, creators.id))
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

  // ---- 學習雷達（真實資料） ----
  // 在線人數：目前正在自習室中的不重複使用者數
  const [{ onlineCount }] = await db
    .select({
      onlineCount: sql<number>`count(distinct ${studyRoomMembers.userId})::int`,
    })
    .from(studyRoomMembers);

  // 雷達頭像：取自習室成員（真實使用者）；若無成員，改用最近註冊使用者作為夥伴
  type RadarPin = {
    id: string;
    name: string | null;
    image: string | null;
  };

  const radarFromMembers = await db
    .selectDistinctOn([studyRoomMembers.userId], {
      id: users.id,
      name: users.name,
      image: users.image,
    })
    .from(studyRoomMembers)
    .innerJoin(users, eq(studyRoomMembers.userId, users.id))
    .orderBy(asc(studyRoomMembers.userId))
    .limit(12);

  let radarPins: RadarPin[] = radarFromMembers;
  if (radarPins.length === 0) {
    radarPins = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(8);
  }

  return (
    <div className="space-y-xl">
      {/* Page Header */}
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">
            自習室
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            加入自習室與其他同學一起專注學習
          </p>
        </div>
        {coins !== null && (
          <div className="flex items-center gap-sm bg-surface-container px-md py-sm rounded-full shadow-sm flex-shrink-0">
            <span className="material-symbols-outlined text-tertiary">
              account_balance_wallet
            </span>
            <span className="font-label-md text-label-md text-on-surface whitespace-nowrap">
              餘額: {coins} 枚金幣
            </span>
          </div>
        )}
      </header>

      {/* Study Radar Section */}
      <section className="bg-surface-container-low rounded-xl p-lg border border-outline-variant/50">
        <div className="flex items-center justify-between gap-sm mb-md">
          <div className="flex items-center gap-sm min-w-0 flex-wrap">
            <span className="material-symbols-outlined text-primary">radar</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              學習雷達
            </h2>
            {onlineCount > 0 && (
              <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-label-md text-[10px] whitespace-nowrap">
                自習室成員 {onlineCount} 人
              </span>
            )}
          </div>
        </div>

        {radarPins.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-lg gap-sm">
            <span className="material-symbols-outlined text-secondary text-[40px]">
              radar
            </span>
            <p className="font-body-md text-body-md text-secondary">
              目前還沒有同學在自習室中，成為第一個開始專注的人吧！
            </p>
          </div>
        ) : (
          <div className="flex gap-md overflow-x-auto hide-scrollbar pb-sm">
            {radarPins.map((pin) => (
              <div
                key={pin.id}
                title={pin.name ?? "同學"}
                className="flex flex-col items-center min-w-[72px] sm:min-w-[80px] group"
              >
                <div className="w-16 h-16 rounded-full bg-surface relative p-1 border-2 border-transparent group-hover:border-primary transition-colors">
                  {pin.image ? (
                     
                    <img
                      alt={pin.name ?? "同學"}
                      className="w-full h-full rounded-full object-cover"
                      src={pin.image}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-body-lg">
                      {initial(pin.name)}
                    </div>
                  )}
                </div>
                <span className="font-label-md text-label-md text-on-surface mt-xs truncate w-full text-center">
                  {pin.name ?? "同學"}
                </span>
              </div>
            ))}
          </div>
        )}
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
            <StudyRoomCreateForm />
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
              const isFull = room.members >= room.capacity;
              const roomMembers = membersByRoom.get(room.id) ?? [];
              const shownMembers = roomMembers.slice(0, 2);
              const extra = room.members - shownMembers.length;
              const isHot = idx === 0;
              // 整張卡片可點擊進入詳情頁；未登入則導向登入
              const href = userId ? `/study-rooms/${room.id}` : "/login";
              return (
                <Link
                  key={room.id}
                  id={`room-card-${room.id}`}
                  href={href}
                  className="bg-surface-bright rounded-xl p-md border border-outline-variant shadow-sm hover:shadow-md hover:border-primary/40 transition-all group flex items-start gap-md no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-16 h-16 rounded-lg bg-primary-container flex-shrink-0 flex items-center justify-center text-on-primary-container relative">
                    <span className="material-symbols-outlined text-[32px]">
                      menu_book
                    </span>
                    {room.hasPassword && (
                      <span
                        title="此自習室需密碼"
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow"
                      >
                        <span className="material-symbols-outlined text-[15px]">lock</span>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-xs gap-2">
                      <h3 className="font-body-lg text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                        {room.subject || room.name}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isMember && (
                          <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
                            已加入
                          </span>
                        )}
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
                    </div>
                    <p className="font-body-md text-body-md text-secondary mb-xs line-clamp-1">
                      {room.description || room.name}
                    </p>
                    <p className="mb-xs flex flex-wrap items-center gap-x-3 gap-y-0.5 font-label-md text-label-md text-secondary">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]" aria-hidden>group</span>
                        {room.members}/{room.capacity} 人
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-[15px]" aria-hidden>person</span>
                        {room.creatorName ?? "系統房間"}
                      </span>
                    </p>
                    <div className="flex items-center justify-between mt-sm">
                      <div className="flex -space-x-2">
                        {shownMembers.map((m, i) =>
                          m.image ? (

                            <img
                              key={i}
                              alt={m.name ?? "成員"}
                              className="w-6 h-6 rounded-full border border-surface object-cover"
                              src={m.image}
                            />
                          ) : (
                            <div
                              key={i}
                              title={m.name ?? "成員"}
                              className="w-6 h-6 rounded-full border border-surface bg-secondary-container flex items-center justify-center text-on-secondary-container text-[10px] font-bold"
                            >
                              {initial(m.name)}
                            </div>
                          ),
                        )}
                        {extra > 0 && (
                          <div className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-secondary">
                            +{extra}
                          </div>
                        )}
                        {room.members === 0 && (
                          <span className="text-[10px] text-secondary">尚無人加入，當第一個吧！</span>
                        )}
                      </div>
                      <span className="text-primary font-label-md text-label-md flex items-center gap-xs group-hover:underline">
                        {userId ? "進入" : "登入以加入"}{" "}
                        <span className="material-symbols-outlined text-[16px]">
                          arrow_forward
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
