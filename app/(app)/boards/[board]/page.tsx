import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts, comments } from "@/db/schema";
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
      authorName: posts.authorName,
      department: posts.department,
      tags: posts.tags,
      bounty: posts.bounty,
      solved: posts.solved,
      createdAt: posts.createdAt,
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hidden} = false)`,
    })
    .from(posts)
    .where(and(eq(posts.boardId, boardId), eq(posts.hidden, false)))
    .orderBy(desc(posts.createdAt));

  return (
    <section>
      <div className="mb-lg flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/boards" className="text-label-md text-secondary hover:underline">
            ← 所有看板
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-headline-lg font-semibold text-on-background break-words">
            {board.icon && <span aria-hidden="true">{board.icon}</span>}
            <span className="min-w-0">{board.name}</span>
          </h1>
          {board.description && (
            <p className="mt-1 text-body-md text-secondary">{board.description}</p>
          )}
          {board.departments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {board.departments.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-label-md text-secondary">{postRows.length} 則提問</p>
        </div>
        <Link
          href={`/posts/new?board=${board.id}`}
          className="shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-center text-label-md font-bold text-on-primary no-underline transition-all hover:bg-surface-tint sm:self-start sm:text-left"
        >
          發佈新提問
        </Link>
      </div>

      <div className="space-y-3">
        {postRows.length === 0 ? (
          <p className="text-body-md text-secondary">這個看板還沒有提問，來當第一個發問的人吧！</p>
        ) : (
          postRows.map((p) => <PostListItem key={p.id} post={p as PostListData} />)
        )}
      </div>
    </section>
  );
}
