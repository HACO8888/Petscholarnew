import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, comments } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";

export default async function LeaderboardPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // 排行榜：依「被採納解答數」與「總回覆數」排序（取自真實留言資料）
  const rows = await db
    .select({
      name: comments.authorName,
      adopted: sql<number>`sum(case when ${comments.isAdopted} then 1 else 0 end)::int`,
      answers: sql<number>`count(*)::int`,
    })
    .from(comments)
    .where(eq(comments.hidden, false))
    .groupBy(comments.authorName)
    .orderBy(
      desc(sql`sum(case when ${comments.isAdopted} then 1 else 0 end)`),
      desc(sql`count(*)`),
    )
    .limit(20);

  const ranked = rows.map((r) => ({
    ...r,
    points: r.adopted * 20 + (r.answers - r.adopted) * 5,
  }));

  // 當前使用者成就（依真實資料計算）
  let achievements: { name: string; icon: string; desc: string; earned: boolean }[] | null = null;
  if (userId) {
    const [{ pc }] = await db
      .select({ pc: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.authorId, userId), eq(posts.hidden, false)));
    const [{ ac }] = await db
      .select({ ac: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), eq(comments.hidden, false)));
    const [{ adopted }] = await db
      .select({ adopted: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), eq(comments.isAdopted, true)));
    const pet = await getOrCreatePet(userId);

    achievements = [
      { name: "好學新手", icon: "🌱", desc: "發佈第一篇提問或回覆", earned: pc > 0 || ac > 0 },
      { name: "解題達人", icon: "🧠", desc: "有解答被採納", earned: adopted > 0 },
      { name: "等級達人", icon: "⭐", desc: "寵物達到 5 級", earned: pet.level >= 5 },
      { name: "金幣富翁", icon: "💰", desc: "累積 200 金幣", earned: pet.coins >= 200 },
    ];
  }

  const unlockedCount = achievements ? achievements.filter((a) => a.earned).length : 0;

  // 領獎台前三名（依序：第 2 名、第 1 名、第 3 名）
  const rank1 = ranked[0] ?? null;
  const rank2 = ranked[1] ?? null;
  const rank3 = ranked[2] ?? null;

  return (
    <main className="w-full max-w-7xl flex flex-col gap-xl">
      {/* Header Section */}
      <header className="flex flex-col gap-sm">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          本週榮譽榜
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          表彰在解答與探索領域展現卓越成就的學習者。展現你的實力，解鎖專屬成就勳章。
        </p>
      </header>

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
                    <div className="w-full h-full flex items-center justify-center text-secondary font-bold bg-surface-container-highest text-lg">
                      {rank2.name?.[0] ?? "?"}
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-surface-container text-on-surface-variant w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm border border-outline-variant font-label-md">
                    2
                  </div>
                </div>
                <div className="font-label-md text-label-md text-on-surface font-bold text-center truncate w-full">
                  {rank2.name}
                </div>
                <div className="font-body-md text-body-md text-secondary">
                  {rank2.points.toLocaleString()} 分
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
                    <div className="w-full h-full flex items-center justify-center font-bold text-secondary text-lg bg-surface-container-highest">
                      {rank1.name?.[0] ?? "?"}
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-tertiary-container text-on-tertiary-container w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md border border-tertiary-fixed font-headline-md text-lg">
                    1
                  </div>
                </div>
                <div className="font-label-md text-label-md text-on-surface font-bold text-center truncate w-full text-base">
                  {rank1.name}
                </div>
                <div className="font-body-md text-body-md text-primary font-semibold">
                  {rank1.points.toLocaleString()} 分
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
                    <div className="w-full h-full flex items-center justify-center text-secondary font-bold bg-surface-container-highest text-lg">
                      {rank3.name?.[0] ?? "?"}
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-surface-variant text-on-surface-variant w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm border border-outline-variant font-label-md">
                    3
                  </div>
                </div>
                <div className="font-label-md text-label-md text-on-surface font-bold text-center truncate w-full">
                  {rank3.name}
                </div>
                <div className="font-body-md text-body-md text-secondary">
                  {rank3.points.toLocaleString()} 分
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
            <h2 className="font-headline-md text-headline-md text-on-surface">學術互助排行</h2>
            <span className="font-label-md text-label-md text-secondary">依被採納解答數計分</span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden">
            {ranked.length === 0 ? (
              <p className="p-md font-body-md text-body-md text-secondary">尚無排行資料。</p>
            ) : (
              ranked.map((r, i) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between p-md border-b border-surface-variant last:border-b-0 hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-md">
                    <div className="w-8 font-label-md text-label-md text-secondary font-bold text-center">
                      {i + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-outline-variant/30 bg-surface-container flex items-center justify-center">
                      <div className="w-full h-full flex items-center justify-center text-secondary font-bold bg-surface-container">
                        {r.name?.[0] ?? "?"}
                      </div>
                    </div>
                    <div>
                      <div className="font-body-md text-body-md font-medium text-on-surface">
                        {r.name}
                      </div>
                      <div className="text-[10px] text-secondary">
                        採納 {r.adopted} · 回覆 {r.answers}
                      </div>
                    </div>
                  </div>
                  <div className="font-body-md text-body-md text-on-surface-variant">
                    {r.points.toLocaleString()} 分
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
                return (
                  <div
                    key={a.name}
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
                      <p className="font-label-md text-[10px] text-secondary line-clamp-2">
                        {a.desc}
                      </p>
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
