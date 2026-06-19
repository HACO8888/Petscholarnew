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
  const maxTagTotal = topTags.length > 0 ? topTags[0].total : 0;
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
    { label: "本學期提問總數", value: totalPosts, icon: "forum", tone: "primary" },
    { label: "待解答提問", value: unsolvedPosts, icon: "help", tone: "tertiary" },
    { label: "已解決提問", value: solvedPosts, icon: "task_alt", tone: "primary" },
    { label: "整體解決率", value: `${solvedRate}%`, icon: "donut_large", tone: "tertiary" },
  ] as const;

  return (
    <section id="sect-professor" className="space-y-lg">
      {/* Header */}
      <header className="rounded-xl border border-outline-variant/30 bg-gradient-to-r from-primary/10 to-transparent p-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-sm tracking-tight">
          <span className="material-symbols-outlined text-primary icon-fill" aria-hidden>
            school
          </span>
          課程教授管理主頁
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-xs max-w-2xl">
          追蹤本學期課程 Hashtags 標籤的使用情形，掌握學生在解題上遇到的常見盲點與難度。
        </p>
      </header>

      {/* Overview stats — 全部取自真實 DB 統計 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm sm:gap-md">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container-high p-md shadow-sm"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                s.tone === "primary"
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-tertiary-container text-on-tertiary-container"
              }`}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {s.icon}
              </span>
            </div>
            <div className="min-w-0">
              <div className="font-headline-md text-headline-md font-bold text-on-surface tabular-nums break-all leading-none">
                {s.value}
              </div>
              <div className="font-label-md text-label-md text-on-surface-variant mt-1">
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Hashtag overview — 依真實貼文標籤彙整 */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container-high p-lg shadow-sm">
          <h2 className="font-body-lg text-body-lg font-bold text-on-surface flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary" aria-hidden>
              local_offer
            </span>
            課程 Hashtags 使用概況
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            以下為學生在提問中實際使用的標籤，依使用次數排序，可看出本學期討論的熱門主題。
          </p>

          {topTags.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant mt-lg">
              目前還沒有任何帶標籤的提問。
            </p>
          ) : (
            <div className="flex flex-wrap gap-sm mt-lg" id="professor-tags-list">
              {topTags.map((t) => {
                // 以使用次數相對最熱門標籤的比例決定底色深淺，凸顯熱度層次。
                const heat = maxTagTotal > 0 ? t.total / maxTagTotal : 0;
                return (
                  <span
                    key={t.tag}
                    className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 font-label-md text-label-md font-bold shadow-sm ${
                      heat >= 0.66
                        ? "bg-primary text-on-primary"
                        : heat >= 0.33
                          ? "bg-primary/20 text-primary"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    <span className="truncate">#{t.tag}</span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        heat >= 0.66 ? "text-on-primary/70" : "text-on-surface/50"
                      }`}
                    >
                      {t.total}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Misconceptions & Charts */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container-high p-lg shadow-sm">
          <h2 className="font-body-lg text-body-lg font-bold text-on-surface flex items-center gap-sm mb-md">
            <span className="material-symbols-outlined text-primary" aria-hidden>
              analytics
            </span>
            學生學習難點統計分析
          </h2>

          {/* Custom stat bars — 各標籤解決率，未解決最多者優先 */}
          {difficulty.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
              目前沒有待解決的標籤難點 🎉
            </p>
          ) : (
            <div className="space-y-md mb-lg">
              {difficulty.map((d) => (
                <div key={d.tag}>
                  <div className="flex justify-between gap-2 font-label-md text-label-md font-semibold mb-1">
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

          <h3 className="font-label-md text-label-md font-bold text-on-surface border-t border-outline-variant/20 pt-md mb-sm flex items-center gap-xs">
            <span className="material-symbols-outlined text-base" aria-hidden>
              help
            </span>
            待解答提問（最新）
          </h3>
          <div className="space-y-sm" id="professor-pending">
            {pending.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                目前沒有待解答的提問 🎉
              </p>
            ) : (
              pending.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="block bg-surface-container-low dark:bg-surface p-md rounded-xl border-l-4 border-primary no-underline transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <h4 className="font-label-md text-label-md font-bold text-on-surface break-words">
                    <span className="text-primary">#{p.boardName}</span>　{p.title}
                  </h4>
                  <p className="font-body-md text-on-surface-variant text-[11px] mt-1">
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
