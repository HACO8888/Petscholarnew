import Link from "next/link";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  users,
  posts,
  comments,
  studyRoomMembers,
  couponRedemptions,
} from "@/db/schema";
import { getOrCreatePet, petTitle } from "@/lib/pet";
import { redeemCoupon } from "./actions";
import { WELFARE_ITEMS } from "./welfare-data";

type TabKey = "explorer" | "studytime" | "dept";

type RankRow = {
  userId: string;
  name: string | null;
  image: string | null;
  /** 主要計分值 */
  points: number;
  /** 顯示在名稱旁的系所/細目（可為 null） */
  dept: string | null;
};

const TABS: { key: TabKey; tab: string; title: string; unit: string }[] = [
  { key: "explorer", tab: "好奇探索者榜", title: "好奇探索者排行", unit: "分" },
  { key: "studytime", tab: "自習參與榜", title: "自習參與排行", unit: "間" },
  { key: "dept", tab: "學科貢獻榜", title: "學科貢獻排行", unit: "分" },
];

const TAB_KEYS: TabKey[] = ["explorer", "studytime", "dept"];

/** 成就徽章（對齊 legacy badges-showcase 四項），解鎖狀態由真實資料判定 */
type Badge = {
  name: string;
  icon: string;
  desc: string;
  owned: boolean;
};

/** 好奇探索者榜（explorer）：依作者 userId 聚合留言並 join users 取真實名稱／頭像，被採納 ×20 + 一般回覆 ×5 */
async function loadWeekly(): Promise<RankRow[]> {
  const rows = await db
    .select({
      userId: comments.authorId,
      name: users.name,
      image: users.image,
      adopted: sql<number>`sum(case when ${comments.isAdopted} then 1 else 0 end)::int`,
      answers: sql<number>`count(*)::int`,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.hidden, false), isNotNull(comments.authorId)))
    .groupBy(comments.authorId, users.name, users.image)
    .orderBy(
      desc(sql`sum(case when ${comments.isAdopted} then 1 else 0 end)`),
      desc(sql`count(*)`),
    )
    .limit(20);

  return rows.map((r) => ({
    userId: r.userId ?? "",
    name: r.name,
    image: r.image,
    points: r.adopted * 20 + (r.answers - r.adopted) * 5,
    dept: null,
  }));
}

/**
 * 自習參與榜（studytime）：依每位使用者實際加入的自習室數聚合 studyRoomMembers，
 * join users 取真實名稱／頭像／系所。points = 加入的自習室數量。
 */
async function loadStudyTime(): Promise<RankRow[]> {
  const rows = await db
    .select({
      userId: studyRoomMembers.userId,
      name: users.name,
      image: users.image,
      department: users.department,
      roomCount: sql<number>`count(*)::int`,
    })
    .from(studyRoomMembers)
    .innerJoin(users, eq(users.id, studyRoomMembers.userId))
    .groupBy(
      studyRoomMembers.userId,
      users.name,
      users.image,
      users.department,
    )
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    points: r.roomCount,
    dept: r.department,
  }));
}

/** 學科貢獻榜（dept）：依作者 userId 聚合貼文數並 join users 取真實名稱／頭像，貼文數 ×10 */
async function loadDept(): Promise<RankRow[]> {
  const rows = await db
    .select({
      userId: posts.authorId,
      name: users.name,
      image: users.image,
      postCount: sql<number>`count(*)::int`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.hidden, false), isNotNull(posts.authorId)))
    .groupBy(posts.authorId, users.name, users.image)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return rows.map((r) => ({
    userId: r.userId ?? "",
    name: r.name,
    image: r.image,
    points: r.postCount * 10,
    dept: null,
  }));
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  // 三個榜（explorer/dept/studytime）皆以真實 userId 聚合，故自我高亮一律以 userId 比對。

  const { tab } = await searchParams;
  const activeKey: TabKey = TAB_KEYS.includes(tab as TabKey)
    ? (tab as TabKey)
    : "explorer";
  const activeTab = TABS.find((t) => t.key === activeKey) ?? TABS[0];

  // 三個分頁皆為真實 DB 聚合：
  // explorer 用留言（被採納/回覆）聚合、dept 用貼文聚合、studytime 用自習室參與數聚合。
  const ranked: RankRow[] =
    activeKey === "dept"
      ? await loadDept()
      : activeKey === "studytime"
        ? await loadStudyTime()
        : await loadWeekly();

  const podium = ranked.slice(0, 3);
  // 顯示前三名以外的全部名次（查詢已 limit 20），先前只切 3..7 會把第 8 名以後靜默丟棄
  const listRows = ranked.slice(3);

  // 當前使用者成就（依真實資料計算，對齊 legacy 六項。門檻以真實 DB 來源定義）
  let achievements:
    | {
        id: string;
        name: string;
        icon: string;
        desc: string;
        current: number;
        target: number;
        earned: boolean;
        type: "large" | "small";
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
        icon: "calculate",
        desc: "解答區累計解答達到 3 次，幫助他人解決微積分等高等學術難題。",
        current: adopted,
        target: 3,
        earned: adopted >= 3,
        type: "large",
      },
      {
        id: "lab_master",
        name: "實驗室大師",
        icon: "science",
        desc: "累計回覆達到 20 則，在各學術區獲得高度讚譽。",
        current: ac,
        target: 20,
        earned: ac >= 20,
        type: "small",
      },
      {
        id: "lit_collector",
        name: "文獻考究狂",
        icon: "library_books",
        desc: "寵物等級提升至 2 等級以上，顯示寵物在學術研習中的深度成長。",
        current: pet.level,
        target: 2,
        earned: pet.level >= 2,
        type: "small",
      },
      {
        id: "coin_millionaire",
        name: "金幣富豪",
        icon: "monetization_on",
        desc: "累計金幣餘額達到 150 枚，顯示出色的學習與商城理財能力。",
        current: pet.coins,
        target: 150,
        earned: pet.coins >= 150,
        type: "small",
      },
      {
        id: "room_creator",
        name: "自習先驅",
        icon: "meeting_room",
        desc: "加入至少 1 個自習室，帶動同儕學習氛圍。",
        current: rooms,
        target: 1,
        earned: rooms >= 1,
        type: "small",
      },
      {
        id: "academic_explorer",
        name: "學術探索者",
        icon: "explore",
        desc: "註冊成為 PetScholar 學術村民，開啟遊戲化的學術成長之旅。",
        current: 1,
        target: 1,
        earned: true,
        type: "small",
      },
    ];
  }
  const unlockedCount = achievements
    ? achievements.filter((a) => a.earned).length
    : 0;

  // 成就徽章（legacy badges-showcase 四項），解鎖以真實資料判定
  let petLevel = 0;
  let badges: Badge[] | null = null;
  if (userId && achievements) {
    const adoptedEarned =
      achievements.find((a) => a.id === "calc_savior")?.earned ?? false;
    const repliesCount =
      achievements.find((a) => a.id === "lab_master")?.current ?? 0;
    const roomsCount =
      achievements.find((a) => a.id === "room_creator")?.current ?? 0;
    petLevel = achievements.find((a) => a.id === "lit_collector")?.current ?? 0;

    badges = [
      {
        name: "好學新手",
        icon: "🌱",
        desc: "註冊成為北科遊戲化論壇的一員。",
        owned: true,
      },
      {
        name: "解題達人",
        icon: "🎓",
        desc: "發表解答被他人成功採納為最佳解答。",
        owned: adoptedEarned,
      },
      {
        name: "共讀先鋒",
        icon: "📡",
        desc: "加入或建立一個課業共讀自修室。",
        owned: roomsCount >= 1,
      },
      {
        name: "熱心助人",
        icon: "💖",
        desc: "發表你的第一個解答留言。",
        owned: repliesCount >= 1,
      },
    ];
  }
  const ownedBadgeNames = badges
    ? badges.filter((b) => b.owned).map((b) => b.name)
    : [];

  // 目前使用者已兌換的優惠券（couponId -> code），用於顯示券碼或標記已兌換
  const redeemedMap = new Map<string, string>();
  if (userId) {
    const rows = await db
      .select({
        couponId: couponRedemptions.couponId,
        code: couponRedemptions.code,
      })
      .from(couponRedemptions)
      .where(eq(couponRedemptions.userId, userId));
    for (const r of rows) redeemedMap.set(r.couponId, r.code);
  }

  return (
    <div className="w-full flex flex-col gap-xl">
      {/* Header Section */}
      <header className="flex flex-col gap-sm">
        <div className="flex items-center gap-md">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-2xl icon-fill" aria-hidden>emoji_events</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            累計榮譽榜
          </h1>
        </div>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          表彰在解答與探索領域展現卓越成就的學習者。展現你的實力，解鎖專屬成就勳章。
        </p>
      </header>

      {/* Leaderboard Tab Selector */}
      <div className="flex bg-surface-container-low dark:bg-surface-container-high p-1 rounded-full border border-outline-variant/30 w-full max-w-xl self-start mb-sm">
        {TABS.map((t) => {
          const isActive = t.key === activeKey;
          return (
            <Link
              key={t.key}
              href={
                t.key === "explorer"
                  ? "/leaderboard"
                  : `/leaderboard?tab=${t.key}`
              }
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 py-2 px-2 sm:px-4 font-bold text-label-md sm:text-body-md rounded-full transition-all text-center whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm dark:bg-primary-fixed dark:text-on-primary-fixed"
                  : "text-secondary dark:text-secondary-fixed-dim hover:text-primary dark:hover:text-primary-fixed"
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
            backgroundImage:
              "radial-gradient(circle at center, #4b6172 2px, transparent 2px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="flex items-end justify-center gap-sm md:gap-lg h-64 z-10 w-full max-w-3xl">
          {podium.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-sm self-center px-md">
              <span className="material-symbols-outlined text-outline text-[48px]" style={{ fontSize: "48px" }} aria-hidden>
                workspace_premium
              </span>
              <p className="text-secondary font-body-md text-body-md max-w-xs">
                尚無排行資料。發表解答、加入自習室或提出問題，搶先登上頒獎台。
              </p>
            </div>
          ) : (
            // 顯示順序：第 2 名、第 1 名、第 3 名
            [podium[1], podium[0], podium[2]].map((member, slot) => {
              if (!member) return null;
              const rank = slot === 1 ? 1 : slot === 0 ? 2 : 3;
              const isSelf = userId != null && member.userId === userId;
              const nameSuffix = isSelf ? " (您)" : "";
              const avatar = member.image ? (
                 
                <img
                  src={member.image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-secondary text-lg bg-surface-container-highest">
                  {member.name?.[0] ?? "?"}
                </div>
              );

              if (rank === 1) {
                return (
                  <div
                    key={member.userId}
                    className={`flex flex-col items-center w-1/3 relative ${
                      isSelf ? "scale-105" : ""
                    }`}
                  >
                    <div className="absolute -top-10 text-tertiary-container animate-pulse">
                      <span
                        className="material-symbols-outlined text-4xl icon-fill"
                        style={{ fontSize: "40px" }}
                      >
                        kid_star
                      </span>
                    </div>
                    <div className="relative mb-sm">
                      <Link
                        href={`/u/${member.userId}`}
                        aria-label={`查看 ${member.name ?? "使用者"} 的公開檔案`}
                        className={`block w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-tertiary-container shadow-lg overflow-hidden bg-primary-container transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isSelf
                            ? "border-primary-fixed ring-4 ring-primary-container/50"
                            : ""
                        }`}
                      >
                        {avatar}
                      </Link>
                      <div className="absolute -bottom-2 -right-2 bg-tertiary-container text-on-tertiary-container w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md border border-tertiary-fixed font-headline-md text-lg">
                        1
                      </div>
                    </div>
                    <div
                      className={`font-label-md text-label-md text-on-surface font-bold text-center truncate w-full text-base ${
                        isSelf ? "text-primary" : ""
                      }`}
                    >
                      {(member.name ?? "匿名使用者") + nameSuffix}
                    </div>
                    <div className="font-body-md text-body-md text-primary font-semibold">
                      {member.points.toLocaleString()} {activeTab.unit}
                    </div>
                    <div className="w-full bg-primary-container h-32 md:h-40 mt-md rounded-t-xl border-t border-x border-primary-fixed-dim shadow-[inset_0_4px_6px_rgba(0,0,0,0.05)]" />
                  </div>
                );
              }
              if (rank === 2) {
                return (
                  <div
                    key={member.userId}
                    className="flex flex-col items-center w-1/3"
                  >
                    <div className="relative mb-sm">
                      <Link
                        href={`/u/${member.userId}`}
                        aria-label={`查看 ${member.name ?? "使用者"} 的公開檔案`}
                        className={`block w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-surface-container-lowest shadow-md overflow-hidden bg-secondary-container transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isSelf
                            ? "border-primary-fixed-dim ring-4 ring-primary-container/40"
                            : ""
                        }`}
                      >
                        {avatar}
                      </Link>
                      <div className="absolute -bottom-2 -right-2 bg-surface-container text-on-surface-variant w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm border border-outline-variant font-label-md">
                        2
                      </div>
                    </div>
                    <div
                      className={`font-label-md text-label-md text-on-surface font-bold text-center truncate w-full ${
                        isSelf ? "text-primary" : ""
                      }`}
                    >
                      {(member.name ?? "匿名使用者") + nameSuffix}
                    </div>
                    <div className="font-body-md text-body-md text-secondary">
                      {member.points.toLocaleString()} {activeTab.unit}
                    </div>
                    <div className="w-full bg-secondary-container h-24 md:h-32 mt-md rounded-t-xl border-t border-x border-outline-variant opacity-80" />
                  </div>
                );
              }
              return (
                <div
                  key={member.userId}
                  className="flex flex-col items-center w-1/3"
                >
                  <div className="relative mb-sm">
                    <Link
                      href={`/u/${member.userId}`}
                      aria-label={`查看 ${member.name ?? "使用者"} 的公開檔案`}
                      className={`block w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-surface-container-lowest shadow-md overflow-hidden bg-tertiary-fixed-dim transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isSelf
                          ? "border-primary-fixed-dim ring-4 ring-primary-container/40"
                          : ""
                      }`}
                    >
                      {avatar}
                    </Link>
                    <div className="absolute -bottom-2 -right-2 bg-surface-variant text-on-surface-variant w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm border border-outline-variant font-label-md">
                      3
                    </div>
                  </div>
                  <div
                    className={`font-label-md text-label-md text-on-surface font-bold text-center truncate w-full ${
                      isSelf ? "text-primary" : ""
                    }`}
                  >
                    {(member.name ?? "匿名使用者") + nameSuffix}
                  </div>
                  <div className="font-body-md text-body-md text-secondary">
                    {member.points.toLocaleString()} {activeTab.unit}
                  </div>
                  <div className="w-full bg-surface-container-highest h-20 md:h-28 mt-md rounded-t-xl border-t border-x border-outline-variant opacity-70" />
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Two Column Layout: Rankings List & Achievements Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
        {/* Weekly Rankings List */}
        <section className="flex flex-col gap-md">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              {activeTab.title}
            </h2>
            <span className="font-label-md text-label-md text-secondary">
              即時更新
            </span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden">
            {listRows.length === 0 ? (
              <div className="p-lg flex flex-col items-center text-center gap-xs text-secondary">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: "40px" }} aria-hidden>
                  format_list_numbered
                </span>
                <p className="font-body-md text-body-md">尚無更多排行資料。</p>
              </div>
            ) : (
              listRows.map((item, idx) => {
                const rank = idx + 4;
                const isSelf = userId != null && item.userId === userId;
                return (
                  <div
                    key={item.userId}
                    className={`flex items-center justify-between p-md border-b border-surface-variant transition-colors ${
                      isSelf
                        ? "bg-primary-container/20 hover:bg-primary-container/30"
                        : "hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center gap-md">
                      <div className="w-8 font-label-md text-label-md text-secondary font-bold text-center">
                        {rank}
                      </div>
                      <Link
                        href={`/u/${item.userId}`}
                        aria-label={`查看 ${item.name ?? "使用者"} 的公開檔案`}
                        className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-outline-variant/30 bg-surface-container block transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {item.image ? (

                          <img
                            src={item.image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-secondary font-bold bg-surface-container">
                            {item.name?.[0] ?? "?"}
                          </div>
                        )}
                      </Link>
                      <div>
                        <div
                          className={`font-body-md text-body-md font-medium text-on-surface ${
                            isSelf ? "font-bold text-primary" : ""
                          }`}
                        >
                          {(item.name ?? "匿名使用者") + (isSelf ? " (您)" : "")}
                        </div>
                        {item.dept ? (
                          <div className="text-[10px] text-secondary truncate max-w-[40vw] sm:max-w-none">
                            {item.dept}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={`font-body-md text-body-md ${
                        isSelf ? "font-bold text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      {item.points.toLocaleString()} {activeTab.unit}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Achievement Showcase (Bento Grid) */}
        <section className="flex flex-col gap-md">
          <div className="flex items-center justify-between gap-sm flex-wrap">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              成就展示館
            </h2>
            <div className="flex items-center gap-sm">
              {userId ? (
                <span className="bg-tertiary-container text-on-tertiary-container px-sm py-1 rounded-full font-label-md text-label-md font-bold">
                  🎖️ Lv.{petLevel}・{petTitle(petLevel)}
                </span>
              ) : null}
              <span className="bg-primary-container text-on-primary-container px-sm py-1 rounded-full font-label-md text-label-md">
                已解鎖 {unlockedCount}/{achievements?.length ?? 6}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-sm md:gap-md auto-rows-[140px]">
            {achievements ? (
              achievements.map((ach) => {
                const isLocked = !ach.earned;
                const percent = Math.min(
                  100,
                  (ach.current / ach.target) * 100,
                );
                const statusEl = ach.earned ? (
                  <span className="text-tertiary font-bold text-[10px] flex items-center gap-xs">
                    <span className="material-symbols-outlined text-sm icon-fill text-tertiary">
                      check_circle
                    </span>
                    已解鎖
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-outline text-sm">
                    lock
                  </span>
                );

                if (ach.type === "large") {
                  return (
                    <div
                      key={ach.id}
                      className={`col-span-2 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-md flex items-center gap-md hover:shadow-md transition-shadow relative overflow-hidden group ${
                        isLocked ? "opacity-65" : ""
                      }`}
                    >
                      <div className="absolute right-0 top-0 w-32 h-32 bg-primary-container rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div
                        className={`w-16 h-16 rounded-xl ${
                          isLocked
                            ? "bg-surface-container-highest text-secondary"
                            : "bg-primary-container text-primary"
                        } flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim shrink-0`}
                      >
                        <span
                          className={`material-symbols-outlined text-3xl ${
                            isLocked ? "" : "icon-fill"
                          }`}
                        >
                          {ach.icon}
                        </span>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="font-headline-md text-lg text-on-surface mb-1 truncate">
                            {ach.name}
                          </h3>
                          {statusEl}
                        </div>
                        <p className="font-body-md text-body-md text-secondary text-sm mb-2 line-clamp-2">
                          {ach.desc}
                        </p>
                        <div className="flex items-center gap-sm">
                          <div className="flex-1 bg-surface-container h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`${
                                isLocked ? "bg-secondary" : "bg-primary"
                              } h-full rounded-full`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-secondary">
                            {ach.current}/{ach.target}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={ach.id}
                    className={`bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-md flex flex-col justify-between hover:-translate-y-1 transition-transform cursor-pointer relative overflow-hidden group ${
                      isLocked ? "opacity-65" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div
                        className={`w-10 h-10 rounded-full ${
                          isLocked
                            ? "bg-surface-container-highest text-secondary"
                            : "bg-tertiary-container text-on-tertiary-container"
                        } flex items-center justify-center shrink-0`}
                      >
                        <span
                          className={`material-symbols-outlined ${
                            isLocked ? "" : "icon-fill"
                          }`}
                        >
                          {ach.icon}
                        </span>
                      </div>
                      {statusEl}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-label-md text-label-md text-on-surface font-bold text-base mb-xs truncate">
                        {ach.name}
                      </h3>
                      <p className="font-label-md text-[10px] text-secondary line-clamp-1 mb-1">
                        {ach.desc}
                      </p>
                      <div className="flex items-center gap-xs">
                        <div className="flex-1 bg-surface-container h-1 rounded-full overflow-hidden">
                          <div
                            className={`${
                              isLocked ? "bg-secondary" : "bg-tertiary"
                            } h-full rounded-full`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-secondary shrink-0">
                          {ach.current}/{ach.target}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="col-span-2 text-secondary font-body-md text-body-md self-center">
                登入後可查看你的成就展示館。
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Student Welfare Coupon Shop */}
      <section className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-sm">
            <span className="material-symbols-outlined text-tertiary icon-fill">
              local_activity
            </span>
            學生特約福利社
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            提升寵物等級或解鎖成就徽章，免費兌換北科校園周邊特約優惠券。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {WELFARE_ITEMS.map((coupon) => {
            let reqText: string;
            let isUnlocked: boolean;
            if (coupon.reqType === "level") {
              reqText =
                userId == null
                  ? `Lv.${coupon.reqValue} 級解鎖`
                  : `需寵物等級 ${coupon.reqValue}`;
              isUnlocked = petLevel >= (coupon.reqValue as number);
            } else {
              reqText = `需解鎖徽章: ${coupon.reqValue}`;
              isUnlocked = ownedBadgeNames.includes(coupon.reqValue as string);
            }
            const redeemedCode = redeemedMap.get(coupon.id);
            const isRedeemed = redeemedCode != null;
            return (
              <div
                key={coupon.id}
                className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-md flex items-center justify-between gap-md hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-md min-w-0">
                  <span className="text-3xl shrink-0">{coupon.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-label-md text-label-md text-on-surface font-bold text-sm truncate">
                      {coupon.name}
                    </h3>
                    <p className="font-body-md text-body-md text-secondary text-xs line-clamp-2">
                      {coupon.desc}
                    </p>
                    <span className="text-[10px] font-bold text-tertiary">
                      {reqText}
                    </span>
                  </div>
                </div>
                {userId == null ? (
                  <Link
                    href="/login"
                    className="font-label-md text-label-md font-bold py-1.5 px-3 rounded-full shadow-sm transition-all bg-surface-container text-secondary border border-outline-variant/30 hover:opacity-95 whitespace-nowrap shrink-0"
                  >
                    登入兌換
                  </Link>
                ) : isRedeemed ? (
                  <span className="font-mono font-bold text-xs py-1.5 px-3 rounded-full bg-tertiary-container text-on-tertiary-container border border-tertiary-fixed whitespace-nowrap shrink-0">
                    {redeemedCode}
                  </span>
                ) : isUnlocked ? (
                  <form action={redeemCoupon} className="shrink-0">
                    <input type="hidden" name="couponId" value={coupon.id} />
                    <button
                      type="submit"
                      className="font-label-md text-label-md font-bold py-1.5 px-3 rounded-full shadow-sm transition-all bg-tertiary text-on-tertiary hover:opacity-95 whitespace-nowrap"
                    >
                      免費兌換
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="font-label-md text-label-md font-bold py-1.5 px-3 rounded-full shadow-sm bg-surface-container text-secondary cursor-not-allowed border border-outline-variant/30 whitespace-nowrap shrink-0"
                    disabled
                  >
                    {coupon.reqType === "level"
                      ? `需等級 ${coupon.reqValue}`
                      : "未解鎖"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
