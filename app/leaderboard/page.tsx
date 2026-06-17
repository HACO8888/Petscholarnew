import Link from "next/link";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  posts,
  comments,
  users,
  studyRoomMembers,
  couponRedemptions,
} from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { redeemCoupon } from "./actions";
import { WELFARE_ITEMS } from "./welfare-data";

type TabKey = "weekly" | "dept";

type RankRow = {
  userId: string;
  name: string | null;
  image: string | null;
  /** 主要計分值 */
  points: number;
  /** 顯示在名稱旁的系所/細目（可為 null） */
  dept: string | null;
};

const TABS: { key: TabKey; tab: string }[] = [
  { key: "weekly", tab: "全校英雄榜" },
  { key: "dept", tab: "系所排行" },
];

const TAB_KEYS: TabKey[] = ["weekly", "dept"];

/** 成就徽章（對齊 legacy badges-showcase 四項），解鎖狀態由真實資料判定 */
type Badge = {
  name: string;
  icon: string;
  desc: string;
  owned: boolean;
};

/** 全校英雄榜（weekly）：依 authorId 聚合留言，被採納解答 ×20 + 一般回覆 ×5，全校共同排名 */
async function loadWeekly(): Promise<RankRow[]> {
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
    points: r.adopted * 20 + (r.answers - r.adopted) * 5,
    dept: null,
  }));
}

/** 系所排行（dept）：依 authorId 聚合貼文數，作為系所貢獻排名 */
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

  const { tab } = await searchParams;
  const activeKey: TabKey = TAB_KEYS.includes(tab as TabKey)
    ? (tab as TabKey)
    : "weekly";

  const ranked: RankRow[] =
    activeKey === "dept" ? await loadDept() : await loadWeekly();

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
    <section className="tab-section active" id="sect-welfare">
      <div className="mb-lg border-b border-outline-variant/30 pb-3">
        <h1 className="font-semibold text-headline-lg text-on-background">
          排行榜與成就福利社
        </h1>
        <p className="text-secondary text-body-md">
          解鎖成就徽章以在福利社兌換校園實體優惠折價券。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        {/* Left: Achievements & Welfare Coupons */}
        <div className="lg:col-span-7 space-y-lg">
          {/* Badge Showcase */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
            <h3 className="font-bold text-body-lg text-on-surface mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-primary">
                military_tech
              </span>{" "}
              我的成就徽章
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-sm">
              {badges ? (
                badges.map((b) => (
                  <div
                    key={b.name}
                    title={b.desc}
                    className={`flex flex-col items-center justify-center p-2 bg-surface-container-low dark:bg-surface border border-outline-variant/30 rounded-xl relative group ${
                      b.owned ? "" : "opacity-40 filter grayscale"
                    }`}
                  >
                    <span className="text-3xl">{b.icon}</span>
                    <span className="text-[10px] font-bold text-on-surface mt-1">
                      {b.name}
                    </span>
                    {b.owned && (
                      <span className="absolute top-1 right-1 text-[8px] bg-green-100 text-green-700 px-1 rounded-full">
                        已得
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="col-span-full text-secondary text-body-md">
                  登入後可查看你的成就徽章。
                </p>
              )}
            </div>
          </div>

          {/* Coupon Welfare Shop */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
            <h3 className="font-bold text-body-lg text-tertiary flex items-center gap-1 mb-3">
              <span className="material-symbols-outlined">local_activity</span>{" "}
              學生特約福利社
            </h3>
            <div className="space-y-md">
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
                  isUnlocked = ownedBadgeNames.includes(
                    coupon.reqValue as string,
                  );
                }
                const redeemedCode = redeemedMap.get(coupon.id);
                const isRedeemed = redeemedCode != null;
                return (
                  <div
                    key={coupon.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low dark:bg-surface border border-outline-variant/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{coupon.icon}</span>
                      <div>
                        <h4 className="font-bold text-xs text-on-surface">
                          {coupon.name}
                        </h4>
                        <p className="text-[10px] text-secondary leading-normal">
                          {coupon.desc}
                        </p>
                        <span className="text-[9px] font-bold text-tertiary">
                          {reqText}
                        </span>
                      </div>
                    </div>
                    {userId == null ? (
                      <Link
                        href="/login"
                        className="font-bold text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all bg-surface-container text-secondary border border-outline-variant/30 hover:opacity-95 whitespace-nowrap"
                      >
                        登入兌換
                      </Link>
                    ) : isRedeemed ? (
                      <span className="font-mono font-bold text-xs py-1.5 px-3 rounded-lg bg-tertiary-container text-on-tertiary-container border border-tertiary/30 whitespace-nowrap">
                        {redeemedCode}
                      </span>
                    ) : isUnlocked ? (
                      <form action={redeemCoupon}>
                        <input type="hidden" name="couponId" value={coupon.id} />
                        <button
                          type="submit"
                          className="font-bold text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all bg-tertiary text-on-tertiary hover:opacity-95 whitespace-nowrap"
                        >
                          免費兌換
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="font-bold text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all bg-surface-container text-secondary cursor-not-allowed border border-outline-variant/30 whitespace-nowrap"
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
          </div>
        </div>

        {/* Right: Leaderboards */}
        <div className="lg:col-span-5 bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex border-b border-outline-variant/30 mb-md">
            {TABS.map((t) => {
              const isActive = t.key === activeKey;
              return (
                <Link
                  key={t.key}
                  href={
                    t.key === "weekly"
                      ? "/leaderboard"
                      : `/leaderboard?tab=${t.key}`
                  }
                  className={`flex-1 py-2 font-bold text-body-md ${
                    isActive
                      ? "text-primary border-b-2 border-primary"
                      : "text-secondary border-b-2 border-transparent hover:text-primary"
                  }`}
                >
                  {t.tab}
                </Link>
              );
            })}
          </div>

          <div className="space-y-md">
            <div className="grid grid-cols-12 text-xs font-bold text-secondary pb-1 border-b border-outline-variant/20">
              <span className="col-span-2">排名</span>
              <span className="col-span-7">系所/姓名</span>
              <span className="col-span-3 text-right">本週積分</span>
            </div>
            <div className="space-y-2.5">
              {ranked.length === 0 ? (
                <p className="text-xs text-secondary py-2">尚無排行資料。</p>
              ) : (
                ranked.map((u, i) => {
                  const isSelf = userId != null && u.userId === userId;
                  const selfBg = isSelf
                    ? "bg-primary-container/20 border border-primary/20 rounded-lg"
                    : "";
                  const nameDisplay = isSelf
                    ? `${u.name ?? "匿名使用者"} (我)`
                    : (u.name ?? "匿名使用者");
                  return (
                    <div
                      key={u.userId}
                      className={`grid grid-cols-12 items-center text-xs py-1.5 px-2 ${selfBg}`}
                    >
                      <div className="col-span-2">
                        {i === 0 ? (
                          <span className="text-xl">🥇</span>
                        ) : i === 1 ? (
                          <span className="text-xl">🥈</span>
                        ) : i === 2 ? (
                          <span className="text-xl">🥉</span>
                        ) : (
                          <span className="font-bold text-secondary text-xs">
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <div className="col-span-7 font-bold text-on-surface flex items-center gap-1.5">
                        {u.image ? (
                          <span className="w-5 h-5 rounded-full overflow-hidden inline-flex shrink-0">
                            { }
                            <img
                              src={u.image}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </span>
                        ) : (
                          <span>👤</span>
                        )}
                        <span>{nameDisplay}</span>
                        {u.dept && (
                          <span className="text-[9px] text-secondary ml-1 font-normal">
                            ({u.dept})
                          </span>
                        )}
                      </div>
                      <div className="col-span-3 text-right font-bold text-primary dark:text-primary-fixed-dim">
                        {u.points}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
