import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts, comments, users } from "@/db/schema";
import { readLevelUpSignal } from "@/lib/level-up-signal";
import LevelUpToast from "@/components/LevelUpToast";
import PostListItem, { type PostListData } from "@/components/PostListItem";

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
      authorId: posts.authorId,
      authorName: posts.authorName,
      authorImage: users.image,
      department: posts.department,
      boardName: boards.name,
      tags: posts.tags,
      solved: posts.solved,
      createdAt: posts.createdAt,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hidden} = false)`,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .leftJoin(users, eq(posts.authorId, users.id))
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
            <div className="mb-lg rounded-xl border border-outline-variant/20 bg-surface-container-low p-md dark:bg-surface-container">
              <h2 className="mb-sm flex items-center gap-1 text-label-md font-bold text-secondary">
                <span className="material-symbols-outlined text-[18px]" aria-hidden>trending_up</span> 熱門標籤
              </h2>
              <div className="flex flex-wrap gap-2">
                {topTags.map((t, i) => (
                  <span
                    key={t}
                    className={`rounded-full px-3.5 py-1.5 text-label-md font-semibold shadow-sm ${
                      i === 0
                        ? "bg-tertiary-container text-on-tertiary-container"
                        : "bg-surface-container-high text-on-surface-variant border border-outline-variant/40"
                    }`}
                  >
                    # {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-sm sm:gap-md mb-lg">
            {boardRows.map((b) => {
              const isActive = activeBoard?.id === b.id;
              const accent = b.color ?? "#4b6172";
              return (
                <Link
                  key={b.id}
                  href={isActive ? "/" : `/?dept=${b.id}`}
                  aria-pressed={isActive}
                  title={isActive ? `取消篩選：${b.name}` : `只看 ${b.name} 的提問`}
                  className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-md text-center no-underline transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                    isActive
                      ? "border-2 shadow-md"
                      : "border-outline-variant/30 bg-surface-container-lowest hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm dark:bg-surface-container-high"
                  }`}
                  style={
                    isActive
                      ? { borderColor: accent, backgroundColor: `${accent}15`, boxShadow: `0 10px 15px -3px ${accent}25` }
                      : undefined
                  }
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: accent }}
                    >
                      <span className="material-symbols-outlined text-[12px] icon-fill">check</span>
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${accent}22`, color: accent }}
                  >
                    {b.icon ?? "📚"}
                  </span>
                  <h3 className={`text-body-md sm:text-body-lg leading-tight text-on-surface ${isActive ? "font-bold" : "font-semibold"}`}>{b.name}</h3>
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
                <PostListItem
                  key={p.id}
                  post={{ ...p, department: p.department ?? p.boardName } as PostListData}
                />
              ))
            )}
          </div>
        </section>
    </>
  );
}
