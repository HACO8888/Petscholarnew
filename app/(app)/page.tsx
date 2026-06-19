import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { readLevelUpSignal } from "@/lib/level-up-signal";
import LevelUpToast from "@/components/LevelUpToast";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const { dept } = await searchParams;
  const levelUp = await readLevelUpSignal();

  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);
  const activeBoard = dept ? boardRows.find((b) => b.id === dept) : undefined;

  const tagRows = await db.select({ tags: posts.tags }).from(posts).where(eq(posts.hidden, false));
  const tagCount = new Map<string, number>();
  for (const r of tagRows) for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);

  const postRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      authorName: posts.authorName,
      department: posts.department,
      boardName: boards.name,
      tags: posts.tags,
      bounty: posts.bounty,
      solved: posts.solved,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(activeBoard ? and(eq(posts.boardId, activeBoard.id), eq(posts.hidden, false)) : eq(posts.hidden, false))
    .orderBy(desc(posts.createdAt));

  return (
    <>
      <LevelUpToast
        initialLevel={levelUp?.newLevel ?? null}
        initialLevels={levelUp?.levels ?? null}
      />
      <section>
          <div className="mb-lg">
            <h1 className="font-semibold text-headline-lg text-on-surface">看板</h1>
            <p className="text-secondary text-body-md mt-xs">探索各學院與科系的專業課業討論。</p>
          </div>

          {topTags.length > 0 && (
            <div className="mb-lg bg-surface-container-low dark:bg-surface-container p-md rounded-xl border border-outline-variant/20">
              <h2 className="font-bold text-label-md text-secondary mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-base" aria-hidden>trending_up</span> 熱門標籤
              </h2>
              <div className="flex flex-wrap gap-2">
                {topTags.map((t) => (
                  <span key={t} className="bg-primary-container/40 text-on-primary-container font-semibold text-xs px-3.5 py-1.5 rounded-full shadow-sm">
                    # {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-sm sm:gap-md mb-lg">
            {boardRows.map((b) => {
              const isActive = activeBoard?.id === b.id;
              return (
                <Link
                  key={b.id}
                  href={isActive ? "/" : `/?dept=${b.id}`}
                  aria-pressed={isActive}
                  title={isActive ? `取消篩選：${b.name}` : `只看 ${b.name} 的提問`}
                  className={`rounded-xl border bg-surface-container-lowest dark:bg-surface-container-high p-md flex flex-col items-center justify-center text-center transition-all no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? "border-2 font-bold shadow-md" : "border-outline-variant/30 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-sm"}`}
                  style={isActive && b.color ? { borderColor: b.color, backgroundColor: `${b.color}15`, boxShadow: `0 10px 15px -3px ${b.color}25` } : undefined}
                >
                  <span className="text-3xl mb-2" aria-hidden>{b.icon}</span>
                  <h3 className="font-bold text-body-md sm:text-body-lg text-on-surface leading-tight">{b.name}</h3>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-md border-b border-outline-variant/30 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-bold text-headline-md text-on-surface truncate">{activeBoard ? `${activeBoard.name}提問` : "所有熱門提問"}</h2>
              <span className="shrink-0 bg-surface-container-high dark:bg-surface-variant text-on-surface-variant px-2.5 py-0.5 rounded-full text-xs font-semibold">{postRows.length} 篇貼文</span>
            </div>
            <Link href="/posts/new" className="shrink-0 bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-4 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-all no-underline">
              <span className="material-symbols-outlined text-[18px]">add_circle</span> 發佈新提問
            </Link>
          </div>

          <div className="space-y-3">
            {postRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest px-4 py-12 text-center dark:bg-surface-container-high">
                <span className="material-symbols-outlined text-[48px] text-outline" aria-hidden>forum</span>
                <p className="text-body-md text-secondary">
                  {activeBoard ? `「${activeBoard.name}」目前尚無提問。` : "目前尚無課業提問。"}歡迎成為第一個發問的人！
                </p>
                <Link href="/posts/new" className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-label-md font-bold text-on-primary no-underline shadow-sm transition-all hover:bg-surface-tint">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>add_circle</span> 發佈新提問
                </Link>
              </div>
            ) : (
              postRows.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="block rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 no-underline transition-all hover:border-primary/40 hover:shadow-sm dark:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 break-words text-body-lg font-semibold text-on-background">{p.title}</h3>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.solved ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-container px-2 py-0.5 text-label-md font-medium text-on-primary-container">
                          <span className="material-symbols-outlined text-[14px] icon-fill">check_circle</span>
                          已解決
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-secondary">
                          待解答
                        </span>
                      )}
                      {p.bounty > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-container px-2 py-0.5 text-label-md font-medium text-on-tertiary-container">
                          <span className="material-symbols-outlined text-[14px]">paid</span>
                          {p.bounty}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-label-md text-secondary">
                    <span className="font-medium">{p.authorName}</span>
                    <span>· {p.department ?? p.boardName}</span>
                    <span>· {formatDateTime(p.createdAt)}</span>
                  </div>
                  {p.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-secondary-container px-2 py-0.5 text-label-md text-on-secondary-container"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </section>
    </>
  );
}
