import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts } from "@/db/schema";
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
            <span key={t} className="bg-primary-container/40 text-on-primary-container font-semibold text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-primary-container transition-all">
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
              className={`rounded-xl border bg-surface-container-lowest dark:bg-surface-container-high p-md flex flex-col items-center justify-center text-center cursor-pointer transition-all no-underline ${isActive ? "scale-95 font-bold" : "border-outline-variant/30 hover:border-primary/40 hover:scale-[1.02]"}`}
              style={
                isActive && b.color
                  ? {
                      borderColor: b.color,
                      backgroundColor: `${b.color}15`,
                      boxShadow: `0 10px 15px -3px ${b.color}25`,
                      borderWidth: "2px",
                    }
                  : undefined
              }
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
              className="block bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-xl p-md shadow-sm hover:shadow-md transition-all cursor-pointer relative no-underline"
            >
              <div className="flex justify-between items-start mb-sm gap-2">
                <h3 className="font-bold text-body-lg text-primary dark:text-primary-fixed-dim">{p.title}</h3>
                <span
                  className="text-xs font-bold text-yellow-600 bg-yellow-500/10 px-2 py-0.5 rounded"
                  style={p.solved ? { background: "rgba(0,0,0,0.05)", color: "#666" } : undefined}
                >
                  🪙 {p.solved ? "已結算" : `懸賞 ${p.bounty}`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-secondary mb-2">
                <span className="bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.2 rounded text-[10px]">{p.department ?? p.boardName}</span>
                <span>提問學生: <strong>{p.authorName}</strong></span>
                <span>•</span>
                <span>{formatDateTime(p.createdAt)}</span>
                <span>•</span>
                <span className={p.solved ? "text-green-600 font-bold" : "text-yellow-600 font-bold"}>{p.solved ? "已解決" : "未解決"}</span>
              </div>
              <div className="flex flex-wrap gap-sm">
                {p.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] rounded">#{t}</span>
                ))}
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
