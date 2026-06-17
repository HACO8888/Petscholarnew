import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, boards } from "@/db/schema";
import AccessDenied from "@/components/AccessDenied";
import { formatDateTime } from "@/lib/format";

export default async function ProfessorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "professor" && session.user.role !== "admin") {
    return <AccessDenied need="課程教授或助教" />;
  }

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

  return (
    <section className="tab-section active" id="sect-professor">
      <div className="mb-lg border-b border-outline-variant/30 pb-3 bg-gradient-to-r from-purple-500/10 to-transparent p-md rounded-lg">
        <h1 className="font-semibold text-headline-lg text-purple-700 dark:text-purple-400">🎓 課程教授管理主頁</h1>
        <p className="text-secondary text-body-md">管理本學期核心課程 Hashtags 標籤，追蹤學生在解題遇到的常見盲點與難度。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Hashtag management */}
        <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
          <h3 className="font-bold text-body-lg text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined">local_offer</span> 課程專屬 Hashtags 管理
          </h3>
          <p className="text-secondary text-xs">新增或管理討論版專屬課程標籤，引導學生發問方向。</p>

          <div className="flex gap-2 mt-md">
            <input
              className="flex-grow bg-surface-container-low dark:bg-surface border border-outline-variant/40 rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              id="new-hashtag-input"
              placeholder="例：#拉氏轉換..."
            />
            <button className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-4 py-2 rounded-lg transition-all">
              新增標籤
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-lg" id="professor-tags-list">
            {topTags.map((t) => (
              <span
                key={t.tag}
                className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-bold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1 shadow-sm"
              >
                # {t.tag}
                <button className="text-purple-500 hover:text-purple-700 font-bold ml-1">&times;</button>
              </span>
            ))}
          </div>
        </div>

        {/* Misconceptions & Charts */}
        <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
          <h3 className="font-bold text-body-lg text-purple-700 dark:text-purple-400 mb-md flex items-center gap-1">
            <span className="material-symbols-outlined">analytics</span> 學生學習難點統計分析
          </h3>

          {/* Custom stat bars */}
          <div className="space-y-sm mb-lg">
            {difficulty.map((d) => (
              <div key={d.tag}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>#{d.tag}</span>
                  <span className="text-primary font-bold">
                    {d.rate}% ({d.solved}/{d.total} 已解決)
                  </span>
                </div>
                <div className="w-full bg-surface-container-low h-2.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${d.rate}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h4 className="font-bold text-xs text-on-surface border-t border-outline-variant/20 pt-md mb-2 flex items-center gap-0.5">
            <span className="material-symbols-outlined text-sm">lightbulb</span> 待解答的提問
          </h4>
          <div className="space-y-2 text-xs" id="professor-misconceptions">
            {pending.length === 0 ? (
              <p className="text-secondary text-[11px]">目前沒有待解答的提問 🎉</p>
            ) : (
              pending.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="block bg-surface-container-low dark:bg-surface p-md rounded-xl border-l-4 border-yellow-500 no-underline"
                >
                  <h4 className="font-bold text-xs text-on-surface">
                    #{p.boardName}　{p.title}
                  </h4>
                  <p className="text-secondary text-[11px] mt-1">
                    {p.authorName ? `${p.authorName} · ` : ""}
                    {formatDateTime(p.createdAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
