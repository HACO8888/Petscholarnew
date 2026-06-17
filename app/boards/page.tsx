import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts, comments } from "@/db/schema";
import { formatDateTime } from "@/lib/format";

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const { dept } = await searchParams;
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
      boardId: posts.boardId,
      boardName: boards.name,
      tags: posts.tags,
      bounty: posts.bounty,
      solved: posts.solved,
      createdAt: posts.createdAt,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hidden} = false)`,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(activeBoard ? and(eq(posts.boardId, activeBoard.id), eq(posts.hidden, false)) : eq(posts.hidden, false))
    .orderBy(desc(posts.createdAt));

  return (
    <section>
      <div className="mb-lg">
        <h1 className="font-semibold text-headline-lg text-on-background">看板</h1>
        <p className="text-secondary text-body-md">探索各學院與科系的專業課業討論。</p>
      </div>

      <div className="mb-lg bg-surface-container-low dark:bg-surface-container p-md rounded-xl border border-outline-variant/20">
        <h3 className="font-bold text-body-md text-secondary mb-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">trending_up</span> 熱門標籤
        </h3>
        <div className="flex flex-wrap gap-2">
          {topTags.map((t) => (
            <span key={t} className="bg-surface-container-high dark:bg-surface-variant text-on-surface-variant px-3 py-1 rounded-full text-xs font-medium">
              # {t}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md mb-lg">
        {boardRows.map((b) => {
          const isActive = activeBoard?.id === b.id;
          return (
            <Link
              key={b.id}
              href={isActive ? "/boards" : `/boards?dept=${b.id}`}
              className={`rounded-xl border bg-surface-container-lowest dark:bg-surface-container-high p-md flex flex-col items-center justify-center text-center cursor-pointer transition-all no-underline ${isActive ? "border-primary scale-95 font-bold" : "border-outline-variant/30 hover:border-primary/40 hover:scale-[1.02]"}`}
              style={isActive && b.color ? { borderColor: b.color, backgroundColor: `${b.color}15` } : undefined}
            >
              <span className="text-3xl mb-2">{b.icon}</span>
              <h4 className="font-bold text-body-lg text-on-surface mb-1">{b.name}</h4>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-md border-b border-outline-variant/30 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-headline-md text-on-surface">{activeBoard ? `${activeBoard.name}提問` : "所有熱門提問"}</h2>
          <span className="bg-surface-container-high dark:bg-surface-variant text-on-surface-variant px-2.5 py-0.5 rounded-full text-xs font-semibold">{postRows.length} 篇貼文</span>
        </div>
        <Link href="/posts/new" className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-4 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-all no-underline">
          <span className="material-symbols-outlined text-[18px]">add_circle</span> 發佈新提問
        </Link>
      </div>

      <div className="space-y-md">
        {postRows.length === 0 ? (
          <div className="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/30 rounded-xl text-center text-secondary py-10 text-xs">
            目前尚無課業提問。歡迎發表新問題！
          </div>
        ) : (
          postRows.map((p) => (
            <Link
              key={p.id}
              href={`/posts/${p.id}`}
              className="block bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/30 rounded-xl p-md hover:border-primary/40 hover:shadow-sm transition-all no-underline"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-body-lg text-on-surface">{p.title}</h3>
                <div className="flex shrink-0 items-center gap-2">
                  {p.solved ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-primary">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span> 已解決
                    </span>
                  ) : p.bounty > 0 ? (
                    <span className="inline-flex items-center gap-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full text-xs font-bold">
                      🪙 懸賞 {p.bounty}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-secondary">未解決</span>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-secondary">
                <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">{p.department ?? p.boardName}</span>
                <span>提問學生: {p.authorName}</span>
                <span>• {formatDateTime(p.createdAt)}</span>
                <span>• 💬 {p.commentCount}</span>
              </div>
              {p.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="text-[11px] text-primary">#{t}</span>
                  ))}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
