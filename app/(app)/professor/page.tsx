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

  const totalPosts = tagRows.length;
  const solvedPosts = tagRows.filter((r) => r.solved).length;
  const unsolvedPosts = totalPosts - solvedPosts;
  const solvedRate = totalPosts > 0 ? Math.round((solvedPosts / totalPosts) * 100) : 0;

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
    .filter((d) => d.total - d.solved > 0)
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
    { label: "本學期提問總數", value: totalPosts },
    { label: "待解答提問", value: unsolvedPosts },
    { label: "已解決提問", value: solvedPosts },
    { label: "整體解決率", value: `${solvedRate}%` },
  ];

  return (
    <section id="sect-professor">
      <div className="mb-lg border-b border-outline-variant/30 pb-3 bg-gradient-to-r from-primary/10 to-transparent p-md rounded-lg">
        <h1 className="font-semibold text-headline-lg text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">school</span>
          課程教授管理主頁
        </h1>
        <p className="text-secondary text-body-md">
          追蹤本學期課程 Hashtags 標籤的使用情形，掌握學生在解題上遇到的常見盲點與難度。
        </p>
      </div>

      {/* Overview stats — 全部取自真實 DB 統計 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm sm:gap-md mb-lg">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm"
          >
            <div className="text-headline-md font-bold text-primary tabular-nums break-all">{s.value}</div>
            <div className="text-secondary text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Hashtag overview — 依真實貼文標籤彙整 */}
        <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
          <h3 className="font-bold text-body-lg text-on-surface mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-primary">local_offer</span> 課程 Hashtags 使用概況
          </h3>
          <p className="text-secondary text-xs">
            以下為學生在提問中實際使用的標籤，依使用次數排序，可看出本學期討論的熱門主題。
          </p>

          {topTags.length === 0 ? (
            <p className="text-secondary text-xs mt-lg">目前還沒有任何帶標籤的提問。</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-lg" id="professor-tags-list">
              {topTags.map((t) => (
                <span
                  key={t.tag}
                  className="bg-primary/10 text-primary dark:bg-primary/20 font-bold text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-sm max-w-full"
                >
                  <span className="truncate">#{t.tag}</span>
                  <span className="text-on-surface/60 font-semibold tabular-nums shrink-0">{t.total}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Misconceptions & Charts */}
        <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
          <h3 className="font-bold text-body-lg text-on-surface mb-md flex items-center gap-1">
            <span className="material-symbols-outlined text-primary">analytics</span> 學生學習難點統計分析
          </h3>

          {/* Custom stat bars — 各標籤解決率，未解決最多者優先 */}
          {difficulty.length === 0 ? (
            <p className="text-secondary text-xs mb-lg">目前沒有待解決的標籤難點 🎉</p>
          ) : (
            <div className="space-y-sm mb-lg">
              {difficulty.map((d) => (
                <div key={d.tag}>
                  <div className="flex justify-between gap-2 text-xs font-semibold mb-1">
                    <span className="truncate">#{d.tag}</span>
                    <span className="text-primary font-bold shrink-0 tabular-nums">
                      {d.rate}%（{d.solved}/{d.total} 已解決）
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-low dark:bg-surface h-2.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${d.rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <h4 className="font-bold text-xs text-on-surface border-t border-outline-variant/20 pt-md mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-base">help</span> 待解答提問（最新）
          </h4>
          <div className="space-y-2 text-xs" id="professor-pending">
            {pending.length === 0 ? (
              <p className="text-secondary text-[11px]">目前沒有待解答的提問 🎉</p>
            ) : (
              pending.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="block bg-surface-container-low dark:bg-surface p-md rounded-xl border-l-4 border-primary no-underline transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <h5 className="font-bold text-xs text-on-surface break-words">
                    <span className="text-primary">#{p.boardName}</span>　{p.title}
                  </h5>
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
