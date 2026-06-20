import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts, comments, users } from "@/db/schema";
import PostListItem, { type PostListData } from "@/components/PostListItem";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board: boardId } = await params;

  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) notFound();

  const postRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      authorId: posts.authorId,
      authorName: posts.authorName,
      authorImage: users.image,
      department: posts.department,
      tags: posts.tags,
      solved: posts.solved,
      createdAt: posts.createdAt,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hidden} = false)`,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.boardId, boardId), eq(posts.hidden, false)))
    .orderBy(desc(posts.createdAt));

  const accent = board.color ?? "#4b6172";

  return (
    <section>
      <Link
        href="/boards"
        className="mb-md inline-flex items-center gap-1 text-label-md font-medium text-secondary no-underline transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_back</span>
        所有看板
      </Link>

      {/* 看板識別標頭：以看板色為強調，icon 置於色票方塊內 */}
      <div
        className="mb-lg flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between dark:bg-surface-container-high"
        style={{ borderTopColor: accent, borderTopWidth: 3 }}
      >
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              {board.icon ?? "📚"}
            </span>
            <div className="min-w-0">
              <h1 className="text-headline-lg font-semibold text-on-surface break-words">{board.name}</h1>
              <p className="mt-0.5 inline-flex items-center gap-1 text-label-md text-secondary">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>forum</span>
                {postRows.length} 則提問
              </p>
            </div>
          </div>
          {board.description && (
            <p className="mt-3 text-body-md text-on-surface-variant">{board.description}</p>
          )}
          {board.departments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {board.departments.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-md text-on-surface-variant dark:bg-surface-variant"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
        <Link
          href={`/posts/new?board=${board.id}`}
          className="inline-flex shrink-0 items-center justify-center gap-1 self-start whitespace-nowrap rounded-full bg-primary px-4 py-2 text-center text-label-md font-bold text-on-primary no-underline shadow-sm transition-all hover:bg-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>edit_square</span>
          發佈新提問
        </Link>
      </div>

      <div className="space-y-3">
        {postRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest px-4 py-12 text-center dark:bg-surface-container">
            <span className="material-symbols-outlined text-[48px] text-outline" aria-hidden>forum</span>
            <p className="text-body-md text-secondary">這個看板還沒有提問，來當第一個發問的人吧！</p>
            <Link
              href={`/posts/new?board=${board.id}`}
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-label-md font-bold text-on-primary no-underline shadow-sm transition-all hover:bg-surface-tint"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>edit_square</span> 發佈新提問
            </Link>
          </div>
        ) : (
          postRows.map((p) => <PostListItem key={p.id} post={p as PostListData} />)
        )}
      </div>
    </section>
  );
}
