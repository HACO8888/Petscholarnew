import Link from "next/link";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, comments, users, studyRoomMembers } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";

type TabKey = "helpers" | "studytime" | "dept";

type RankRow = {
  userId: string;
  name: string | null;
  image: string | null;
  /** 主要計分值 */
  score: number;
  /** 顯示在名稱下方的細目（可為 null） */
  detail: string | null;
};

const TABS: { key: TabKey; tab: string; title: string; subtitle: string }[] = [
  {
    key: "helpers",
    tab: "學術互助榜",
    title: "學術互助排行",
    subtitle: "依被採納解答數計分",
  },
  {
    key: "studytime",
    tab: "自習參與榜",
    title: "自習參與排行",
    subtitle: "依加入的自習室數量計分",
  },
  {
    key: "dept",
    tab: "學科貢獻榜",
    title: "學科貢獻排行",
    subtitle: "依發佈的提問與貼文數計分",
  },
];

const TAB_KEYS: TabKey[] = ["helpers", "studytime", "dept"];

function unitFor(key: TabKey): string {
  if (key === "studytime") return "間";
  return "分";
}

/** 互助榜：依 authorId 聚合留言，被採納解答 ×20 + 一般回覆 ×5 */
async function loadHelpers(): Promise<RankRow[]> {
  const rows = await db
    .select({
      userId: comments.authorId,
      name: sql<string | null>`max(${users.name})`,
      image: sql<string | null>`max(${users.image})`,
      fallbackName: sql<string | null>`max(${comments.authorName})`,
      adopted: sql<number>`sum(case when ${comments.isAdopted} then 1 else 0 end)::int`,
      answers: sql<number>`count(*)::int`,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.hidden, false), isNotNull(comments.authorId)))
    .groupBy(comments.authorId)
    .orderBy(
      desc(sql`sum(case when ${comments.isAdopted} then 1 else 0 end)`),
      desc(sql`count(*)`),
    )
    .limit(20);

  return rows.map((r) => ({
    userId: r.userId as string,
    name: r.name ?? r.fallbackName,
    image: r.image,
    score: r.adopted * 20 + (r.answers - r.adopted) * 5,
    detail: `採納 ${r.adopted} · 回覆 ${r.answers}`,
  }));
}

/** 自習參與榜：依使用者加入的自習室數量聚合 */
async function loadStudytime(): Promise<RankRow[]> {
  const rows = await db
    .select({
      userId: studyRoomMembers.userId,
      name: sql<string | null>`max(${users.name})`,
      image: sql<string | null>`max(${users.image})`,
      rooms: sql<number>`count(*)::int`,
    })
    .from(studyRoomMembers)
    .leftJoin(users, eq(users.id, studyRoomMembers.userId))
    .groupBy(studyRoomMembers.userId)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    score: r.rooms,
    detail: `加入 ${r.rooms} 間自習室`,
  }));
}

/** 學科貢獻榜：依 authorId 聚合貼文數（被採納解答另加權） */
async function loadDept(): Promise<RankRow[]> {
  const rows = await db
    .select({
      userId: posts.authorId,
      name: sql<string | null>`max(${users.name})`,
      image: sql<string | null>`max(${users.image})`,
      fallbackName: sql<string | null>`max(${posts.authorName})`,
      postCount: sql<number>`count(*)::int`,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.hidden, false), isNotNull(posts.authorId)))
    .groupBy(posts.authorId)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return rows.map((r) => ({
    userId: r.userId as string,
    name: r.name ?? r.fallbackName,
    image: r.image,
    score: r.postCount * 10,
    detail: `發佈 ${r.postCount} 篇`,
  }));
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const { tab } = await searchParams;
  const activeKey: TabKey = TAB_KEYS.includes(tab as TabKey)
    ? (tab as TabKey)
    : "helpers";
  const activeTab = TABS.find((t) => t.key === activeKey)!;
  const unit = unitFor(activeKey);

  let ranked: RankRow[];
  if (activeKey === "studytime") {
    ranked = await loadStudytime();
  } else if (activeKey === "dept") {
    ranked = await loadDept();
  } else {
    ranked = await loadHelpers();
  }

  // 當前使用者成就（依真實資料計算，對齊 legacy 六項；門檻以真實 DB 來源定義）
  let achievements:
    | {
        id: string;
        name: string;
        icon: string;
        desc: string;
        current: number;
        target: number;
        earned: boolean;
      }[]
    | null = null;
  if (userId) {
    const [{ ac }] = await db
      .select({ ac: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), eq(comments.hidden, false)));
    const [{ adopted }] = await db
      .select({ adopted: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), eq(comments.isAdopted, true)));
    const [{ rooms }] = await db
      .select({ rooms: sql<number>`count(*)::int` })
      .from(studyRoomMembers)
      .where(eq(studyRoomMembers.userId, userId));
    const pet = await getOrCreatePet(userId);

    achievements = [
      {
        id: "calc_savior",
        name: "微積分救星",
        icon: "🧮",
        desc: "解答區累計 3 次被採納，幫助他人解決學術難題。",
        current: adopted,
        target: 3,
        earned: adopted >= 3,
      },
      {
        id: "lab_master",
        name: "實驗室大師",
        icon: "🔬",
        desc: "累計回覆達到 20 則，於各學術區踴躍貢獻。",
        current: ac,
        target: 20,
        earned: ac >= 20,
      },
      {
        id: "lit_collector",
        name: "文獻考究狂",
        icon: "📚",
        desc: "寵物等級提升至 2 等級以上，展現學術研習深度。",
        current: pet.level,
        target: 2,
        earned: pet.level >= 2,
      },
      {
        id: "coin_millionaire",
        name: "金幣富豪",
        icon: "💰",
        desc: "累計金幣餘額達到 150 枚，展現出色的理財能力。",
        current: pet.coins,
        target: 150,
        earned: pet.coins >= 150,
      },
      {
        id: "room_creator",
        name: "自習先驅",
        icon: "🚪",
        desc: "加入至少 1 個自習室，帶動同儕學習氛圍。",
        current: rooms,
        target: 1,
        earned: rooms >= 1,
      },
      {
        id: "academic_explorer",
        name: "學術探索者",
        icon: "🧭",
        desc: "註冊成為 PetScholar 學術村民，開啟學術成長之旅。",
        current: 1,
        target: 1,
        earned: true,
      },
    ];
  }

  const unlockedCount = achievements
    ? achievements.filter((a) => a.earned).length
    : 0;

  // 領獎台前三名（依序：第 2 名、第 1 名、第 3 名）
  const rank1 = ranked[0] ?? null;
  const rank2 = ranked[1] ?? null;
  const rank3 = ranked[2] ?? null;

  return (
    <main className="w-full max-w-7xl flex flex-col gap-xl">
      {/* Header Section */}
      <header className="flex flex-col gap-sm">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          學術榮譽榜
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          表彰在解答與探索領域展現卓越成就的學習者。展現你的實力，解鎖專屬成就勳章。
        </p>
      </header>

      {/* Leaderboard Tab Selector */}
      <div className="flex bg-surface-container-low p-1 rounded-full border border-outline-variant/30 w-full max-w-xl self-start mb-sm">
        {TABS.map((t) => {
          const isActive = t.key === activeKey;
          return (
            <Link
              key={t.key}
              href={t.key === "helpers" ? "/leaderboard" : `/leaderboard?tab=${t.key}`}
              className={`flex-1 py-2 px-4 font-bold text-body-md rounded-full transition-all text-center ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {t.tab}
            </Link>
          );
        })}
      </div>

      {/* Top 3 Podium Section */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-lg flex flex-col items-center justify-center min-h-[360px] relative pt-16">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle at center, #4b6172 2px, transparent 2px)",
            backgroundSize: "24px 24px",
          }}
        ></div>
        {ranked.length === 0 ? (
          <p className="z-10 font-body-md text-body-md text-secondary">尚無排行資料。</p>
        ) : (
          <div className="flex items-end justify-center gap-sm md:gap-lg h-64 z-10 w-full max-w-3xl">
            {/* 2nd Place */}
            {rank2 ? (
              <div className="flex flex-col items-center w-1/3">
                <div className="relative mb-sm">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-surface-container-lowest shadow-md overflow-hidden bg-secondary-container flex items-center justify-center">
                    {rank2.image ? (
                       
                      <img src={rank2.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary font-bold bg-surface-container-highest text-lg">
                        {rank2.name?.[0] ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-surface-container text-on-surface-variant w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm border border-outline-variant font-label-md">
                    2
                  </div>
                </div>
                <div className="font-label-md text-label-md text-on-surface font-bold text-center truncate w-full">
                  {rank2.name ?? "匿名使用者"}
                </div>
                <div className="font-body-md text-body-md text-secondary">
                  {rank2.score.toLocaleString()} {unit}
                </div>
                <div className="w-full bg-secondary-container h-24 md:h-32 mt-md rounded-t-xl border-t border-x border-outline-variant opacity-80"></div>
              </div>
            ) : (
              <div className="w-1/3"></div>
            )}

            {/* 1st Place */}
            {rank1 ? (
              <div className="flex flex-col items-center w-1/3 relative">
                <div className="absolute -top-10 text-tertiary-container animate-pulse">
                  <span className="material-symbols-outlined text-4xl icon-fill" style={{ fontSize: "40px" }}>
                    kid_star
                  </span>
                </div>
                <div className="relative mb-sm">
                  <div className="w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-tertiary-container shadow-lg overflow-hidden bg-primary-container flex items-center justify-center">
                    {rank1.image ? (
                       
                      <img src={rank1.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-secondary text-lg bg-surface-container-highest">
                        {rank1.name?.[0] ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-tertiary-container text-on-tertiary-container w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md border border-tertiary-fixed font-headline-md text-lg">
                    1
                  </div>
                </div>
                <div className="font-label-md text-label-md text-on-surface font-bold text-center truncate w-full text-base">
                  {rank1.name ?? "匿名使用者"}
                </div>
                <div className="font-body-md text-body-md text-primary font-semibold">
                  {rank1.score.toLocaleString()} {unit}
                </div>
                <div className="w-full bg-primary-container h-32 md:h-40 mt-md rounded-t-xl border-t border-x border-primary-fixed-dim shadow-[inset_0_4px_6px_rgba(0,0,0,0.05)]"></div>
              </div>
            ) : (
              <div className="w-1/3"></div>
            )}

            {/* 3rd Place */}
            {rank3 ? (
              <div className="flex flex-col items-center w-1/3">
                <div className="relative mb-sm">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-surface-container-lowest shadow-md overflow-hidden bg-tertiary-fixed-dim flex items-center justify-center">
                    {rank3.image ? (
                       
                      <img src={rank3.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary font-bold bg-surface-container-highest text-lg">
                        {rank3.name?.[0] ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-surface-variant text-on-surface-variant w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm border border-outline-variant font-label-md">
                    3
                  </div>
                </div>
                <div className="font-label-md text-label-md text-on-surface font-bold text-center truncate w-full">
                  {rank3.name ?? "匿名使用者"}
                </div>
                <div className="font-body-md text-body-md text-secondary">
                  {rank3.score.toLocaleString()} {unit}
                </div>
                <div className="w-full bg-surface-container-highest h-20 md:h-28 mt-md rounded-t-xl border-t border-x border-outline-variant opacity-70"></div>
              </div>
            ) : (
              <div className="w-1/3"></div>
            )}
          </div>
        )}
      </section>

      {/* Two Column Layout: Rankings List & Achievements Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
        {/* Rankings List */}
        <section className="flex flex-col gap-md">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface">{activeTab.title}</h2>
            <span className="font-label-md text-label-md text-secondary">{activeTab.subtitle}</span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden">
            {ranked.length === 0 ? (
              <p className="p-md font-body-md text-body-md text-secondary">尚無排行資料。</p>
            ) : (
              ranked.map((r, i) => (
                <div
                  key={r.userId}
                  className="flex items-center justify-between p-md border-b border-surface-variant last:border-b-0 hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-md">
                    <div className="w-8 font-label-md text-label-md text-secondary font-bold text-center">
                      {i + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-outline-variant/30 bg-surface-container flex items-center justify-center">
                      {r.image ? (
                         
                        <img src={r.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-secondary font-bold bg-surface-container">
                          {r.name?.[0] ?? "?"}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-body-md text-body-md font-medium text-on-surface">
                        {r.name ?? "匿名使用者"}
                      </div>
                      {r.detail && (
                        <div className="text-[10px] text-secondary">{r.detail}</div>
                      )}
                    </div>
                  </div>
                  <div className="font-body-md text-body-md text-on-surface-variant">
                    {r.score.toLocaleString()} {unit}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Achievement Showcase (Bento Grid) */}
        <section className="flex flex-col gap-md">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface">成就展示館</h2>
            {achievements && (
              <span className="bg-primary-container text-on-primary-container px-sm py-1 rounded-full font-label-md text-label-md">
                已解鎖 {unlockedCount}/{achievements.length}
              </span>
            )}
          </div>
          {achievements ? (
            <div className="grid grid-cols-2 gap-sm md:gap-md auto-rows-[140px]">
              {achievements.map((a) => {
                const isLocked = !a.earned;
                const percent = Math.min(100, Math.round((a.current / a.target) * 100));
                return (
                  <div
                    key={a.id}
                    className={`bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-md flex flex-col justify-between hover:-translate-y-1 transition-transform relative overflow-hidden group ${
                      isLocked ? "opacity-65" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-2xl ${
                          isLocked
                            ? "bg-surface-container-highest grayscale"
                            : "bg-tertiary-container"
                        }`}
                      >
                        {a.icon}
                      </div>
                      {isLocked ? (
                        <span className="material-symbols-outlined text-outline text-sm">lock</span>
                      ) : (
                        <span className="text-tertiary font-bold text-[10px] flex items-center gap-xs">
                          <span className="material-symbols-outlined text-sm icon-fill text-tertiary">
                            check_circle
                          </span>
                          已解鎖
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-label-md text-label-md text-on-surface font-bold text-base mb-xs truncate">
                        {a.name}
                      </h3>
                      <p className="font-label-md text-[10px] text-secondary line-clamp-1 mb-1">
                        {a.desc}
                      </p>
                      <div className="flex items-center gap-xs">
                        <div className="flex-1 bg-surface-container h-1 rounded-full overflow-hidden">
                          <div
                            className={`${isLocked ? "bg-secondary" : "bg-tertiary"} h-full rounded-full`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-bold text-secondary shrink-0">
                          {Math.min(a.current, a.target)}/{a.target}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-lg">
              <p className="font-body-md text-body-md text-secondary">登入後可查看你的成就徽章。</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
