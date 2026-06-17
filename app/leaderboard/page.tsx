import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, comments } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

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

  return (
    <section className="max-w-3xl">
      <div className="mb-lg">
        <h1 className="text-headline-lg font-semibold text-on-background">排行榜與成就</h1>
        <p className="mt-1 text-body-md text-secondary">學術互助排行榜，依被採納解答數計分。</p>
      </div>

      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2 dark:bg-surface-container">
        {ranked.length === 0 ? (
          <p className="p-4 text-body-md text-secondary">尚無排行資料。</p>
        ) : (
          ranked.map((r, i) => (
            <div
              key={r.name}
              className="flex items-center gap-3 border-b border-outline-variant/20 px-3 py-2.5 last:border-0"
            >
              <span className="w-8 text-center text-body-lg font-bold text-secondary">
                {RANK_MEDAL[i] ?? i + 1}
              </span>
              <span className="flex-1 text-body-md font-medium text-on-background">{r.name}</span>
              <span className="text-label-md text-secondary">採納 {r.adopted} · 回覆 {r.answers}</span>
              <span className="w-16 text-right text-body-md font-bold text-primary">{r.points} 分</span>
            </div>
          ))
        )}
      </div>

      <h2 className="mt-8 mb-3 text-body-lg font-semibold text-on-background">我的成就</h2>
      {achievements ? (
        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
          {achievements.map((a) => (
            <div
              key={a.name}
              className={`rounded-xl border p-4 text-center transition-all ${
                a.earned
                  ? "border-primary/40 bg-primary-container/40"
                  : "border-outline-variant/30 bg-surface-container-low opacity-60 dark:bg-surface-container"
              }`}
            >
              <div className={`text-3xl ${a.earned ? "" : "grayscale"}`}>{a.icon}</div>
              <p className="mt-1 text-body-md font-semibold text-on-background">{a.name}</p>
              <p className="mt-0.5 text-label-md text-secondary">{a.desc}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-body-md text-secondary">登入後可查看你的成就徽章。</p>
      )}
    </section>
  );
}
