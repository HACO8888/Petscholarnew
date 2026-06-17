import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts } from "@/db/schema";

export default async function BoardsPage() {
  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);
  const countRows = await db
    .select({ boardId: posts.boardId, c: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.hidden, false))
    .groupBy(posts.boardId);
  const counts = new Map(countRows.map((r) => [r.boardId, r.c]));

  // 熱門標籤：彙整真實貼文標籤
  const tagRows = await db
    .select({ tags: posts.tags })
    .from(posts)
    .where(eq(posts.hidden, false));
  const tagCount = new Map<string, number>();
  for (const r of tagRows) {
    for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  return (
    <section>
      {/* Header Section */}
      <div className="mb-xl flex flex-col items-start justify-between gap-md md:flex-row md:items-center">
        <div>
          <h1 className="mb-xs text-headline-lg font-semibold text-on-surface">學院看板</h1>
          <p className="text-body-lg text-on-surface-variant">探索各學院的專業知識、討論與學習資源。</p>
        </div>
      </div>

      {/* Trending Tags */}
      {topTags.length > 0 && (
        <div className="mb-xl">
          <h2 className="mb-md text-headline-md font-semibold text-on-surface">熱門標籤</h2>
          <div className="flex flex-wrap gap-sm">
            {topTags.map((t, i) => (
              <span
                key={t}
                className={`cursor-default rounded-full px-4 py-2 text-label-md shadow-sm transition-colors ${
                  i === 0
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : "border border-outline-variant bg-surface-container-high text-on-surface hover:bg-surface-variant"
                }`}
              >
                # {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Department Cards (Bento Grid) */}
      <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
        {boardRows.map((b) => (
          <Link
            key={b.id}
            href={`/boards/${b.id}`}
            className="group relative overflow-hidden rounded-xl border border-surface-container-highest bg-surface no-underline shadow-sm transition-shadow hover:shadow-md dark:bg-surface-container-low"
          >
            <div
              className="relative flex h-32 items-end"
              style={{ backgroundColor: b.color ?? "#4b6172" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute right-3 top-2 text-6xl opacity-30">{b.icon}</span>
              <h3 className="relative m-md text-headline-md font-bold text-white">{b.name}</h3>
            </div>
            <div className="p-md">
              <div className="mb-md flex flex-wrap gap-xs">
                {b.departments.map((d) => (
                  <span
                    key={d}
                    className="rounded-md border border-outline-variant bg-surface-container px-2 py-1 text-[11px] text-on-surface-variant"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <p className="text-label-md text-secondary">{counts.get(b.id) ?? 0} 篇提問</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
