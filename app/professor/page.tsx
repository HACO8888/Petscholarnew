import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, comments, boards } from "@/db/schema";
import AccessDenied from "@/components/AccessDenied";
import { formatDateTime } from "@/lib/format";

export default async function ProfessorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "professor" && session.user.role !== "admin") {
    return <AccessDenied need="課程教授或助教" />;
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.hidden, false));
  const [{ solved }] = await db
    .select({ solved: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.hidden, false), eq(posts.solved, true)));
  const [{ answers }] = await db
    .select({ answers: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.hidden, false));
  const unsolved = total - solved;
  const solvedRate = total > 0 ? Math.round((solved / total) * 100) : 0;

  const byBoard = await db
    .select({ name: boards.name, icon: boards.icon, c: sql<number>`count(${posts.id})::int` })
    .from(boards)
    .leftJoin(posts, and(eq(posts.boardId, boards.id), eq(posts.hidden, false)))
    .groupBy(boards.id, boards.name, boards.icon, boards.sortOrder)
    .orderBy(boards.sortOrder);

  // 課程 Hashtags / 學習難點：依真實貼文標籤彙整，並計算各標籤的採納（已解決）比例。
  const tagRows = await db
    .select({ tags: posts.tags, solved: posts.solved })
    .from(posts)
    .where(eq(posts.hidden, false));
  const tagStats = new Map<string, { total: number; solved: number }>();
  for (const r of tagRows) {
    for (const t of r.tags) {
      const cur = tagStats.get(t) ?? { total: 0, solved: 0 };
      cur.total += 1;
      if (r.solved) cur.solved += 1;
      tagStats.set(t, cur);
    }
  }
  const tagList = [...tagStats.entries()]
    .map(([tag, s]) => ({
      tag,
      total: s.total,
      solved: s.solved,
      rate: s.total > 0 ? Math.round((s.solved / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
  // 熱門 Hashtags 取前 12 名；學習難點以「未解決最多」優先排序取前 6 名。
  const topTags = tagList.slice(0, 12);
  const difficulty = [...tagList]
    .sort((a, b) => b.total - b.solved - (a.total - a.solved) || a.rate - b.rate)
    .slice(0, 6);

  const pending = await db
    .select({
      id: posts.id,
      title: posts.title,
      authorName: posts.authorName,
      boardName: boards.name,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(and(eq(posts.hidden, false), eq(posts.solved, false)))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  const stats = [
    { label: "總提問數", value: total },
    { label: "已解決", value: solved },
    { label: "待解答", value: unsolved },
    { label: "解決率", value: `${solvedRate}%` },
    { label: "總回覆數", value: answers },
  ];

  return (
    <section className="tab-section active" id="sect-professor">
      <div className="mb-lg rounded-lg border-b border-outline-variant/30 bg-gradient-to-r from-purple-500/10 to-transparent p-md pb-3">
        <h1 className="text-headline-lg font-semibold text-purple-700 dark:text-purple-400">🎓 課程教授管理主頁</h1>
        <p className="text-body-md text-secondary">追蹤本學期核心課程 Hashtags 標籤，掌握學生在解題遇到的常見盲點與難度。</p>
      </div>

      <div className="mb-lg grid grid-cols-2 gap-md sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm dark:bg-surface-container-high"
          >
            <p className="text-headline-md font-bold text-primary">{s.value}</p>
            <p className="text-label-md text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        {/* 課程熱門 Hashtags（依真實貼文標籤彙整） */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <h3 className="mb-2 flex items-center gap-1 text-body-lg font-bold text-purple-700 dark:text-purple-400">
            <span className="material-symbols-outlined">local_offer</span> 課程熱門 Hashtags
          </h3>
          <p className="text-xs text-secondary">彙整討論版上學生實際使用的課程標籤與提問數，掌握學生的發問方向。</p>

          {topTags.length === 0 ? (
            <p className="mt-lg text-body-md text-secondary">目前尚無任何課程標籤。</p>
          ) : (
            <div className="mt-lg flex flex-wrap gap-2">
              {topTags.map((t) => (
                <span
                  key={t.tag}
                  className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-secondary-container px-3 py-1 text-label-md text-on-secondary-container"
                >
                  <span>#{t.tag}</span>
                  <span className="rounded-full bg-on-secondary-container/15 px-1.5 text-[10px] font-bold">{t.total}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 學生學習難點統計分析（依真實貼文標籤與採納狀況計算） */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <h3 className="mb-2 flex items-center gap-1 text-body-lg font-bold text-purple-700 dark:text-purple-400">
            <span className="material-symbols-outlined">analytics</span> 學生學習難點統計分析
          </h3>
          <p className="text-xs text-secondary">依各標籤的提問與採納解答比例，找出待解決最多的學習難點。</p>

          {difficulty.length === 0 ? (
            <p className="mt-lg text-body-md text-secondary">目前尚無足夠的提問資料可供分析。</p>
          ) : (
            <div className="mt-lg space-y-sm">
              {difficulty.map((d) => (
                <div key={d.tag}>
                  <div className="mb-1 flex justify-between text-xs font-semibold">
                    <span>#{d.tag}</span>
                    <span className="font-bold text-primary">
                      {d.rate}% ({d.solved}/{d.total} 已解決)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${d.rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 各學院提問分佈 */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <h3 className="mb-2 flex items-center gap-1 text-body-lg font-bold text-purple-700 dark:text-purple-400">
            <span className="material-symbols-outlined">dashboard</span> 各學院提問分佈
          </h3>
          <p className="text-xs text-secondary">依討論版統計目前的提問數量，掌握各學院的發問熱度。</p>

          <div className="mt-lg space-y-sm">
            {byBoard.map((b) => (
              <div key={b.name}>
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1">
                    <span>{b.icon}</span>
                    <span>{b.name}</span>
                  </span>
                  <span className="font-bold text-primary">
                    {b.c} 篇 ({total > 0 ? Math.round((b.c / total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${total > 0 ? (b.c / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 待解答的提問 */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <h3 className="mb-md flex items-center gap-1 text-body-lg font-bold text-purple-700 dark:text-purple-400">
            <span className="material-symbols-outlined">lightbulb</span> 待解答的提問
          </h3>

          <div className="space-y-2 text-xs">
            {pending.length === 0 ? (
              <p className="text-body-md text-secondary">目前沒有待解答的提問 🎉</p>
            ) : (
              pending.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="group relative block rounded border border-outline-variant/20 bg-surface-container p-sm no-underline transition-colors hover:border-primary/40"
                >
                  <div className="mb-1 flex items-center gap-1 font-bold text-primary">
                    <span className="rounded bg-primary-container px-1.5 py-[1px] text-[10px] text-on-primary-container">
                      #{p.boardName}
                    </span>
                    {p.authorName ? (
                      <span className="text-[11px] font-normal text-secondary">{p.authorName}</span>
                    ) : null}
                  </div>
                  <p className="text-[13px] leading-relaxed text-on-surface">{p.title}</p>
                  <p className="mt-1 text-[11px] text-secondary">{formatDateTime(p.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
