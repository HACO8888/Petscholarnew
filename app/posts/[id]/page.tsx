import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, boards, comments } from "@/db/schema";
import { RichContent, renderContentHtml } from "@/lib/rich-content";
import { buildCommentTree, countNodes } from "@/lib/comment-tree";
import { formatDateTime } from "@/lib/format";
import CommentThread from "@/components/CommentThread";
import CommentTreeSvg from "@/components/CommentTreeSvg";
import { addComment } from "@/app/posts/actions";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) notFound();

  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, post.boardId))
    .limit(1);

  const commentRows = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, id));

  const tree = buildCommentTree(commentRows, renderContentHtml, formatDateTime);
  const total = countNodes(tree);

  return (
    <section className="max-w-3xl">
      <Link href={board ? `/boards/${board.id}` : "/boards"} className="text-label-md text-secondary hover:underline">
        ← {board ? `${board.icon} ${board.name}` : "看板"}
      </Link>

      <article className="mt-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 dark:bg-surface-container">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-headline-md font-semibold text-on-background">{post.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {post.solved ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-container px-2 py-0.5 text-label-md font-medium text-on-primary-container">
                <span className="material-symbols-outlined text-[14px] icon-fill">check_circle</span>
                已解決
              </span>
            ) : (
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-secondary">待解答</span>
            )}
            {post.bounty > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-container px-2 py-0.5 text-label-md font-medium text-on-tertiary-container">
                <span className="material-symbols-outlined text-[14px]">paid</span>
                {post.bounty}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-label-md text-secondary">
          <span className="font-medium">{post.authorName}</span>
          {post.department && <span>· {post.department}</span>}
          <span>· {formatDateTime(post.createdAt)}</span>
        </div>

        <RichContent
          html={renderContentHtml(post.content)}
          className="mt-4 text-body-md leading-7 text-on-surface-variant"
        />

        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-secondary-container px-2 py-0.5 text-label-md text-on-secondary-container">
                #{t}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* 留言樹 SVG 視覺化 */}
      <div className="mt-6">
        <h2 className="mb-2 text-body-lg font-semibold text-on-background">留言樹狀結構</h2>
        <p className="mb-2 text-label-md text-secondary">點擊節點可跳至對應留言。</p>
        <CommentTreeSvg nodes={tree} rootLabel={post.title} />
      </div>

      {/* 回覆區 */}
      <div className="mt-6">
        <h2 className="mb-3 text-body-lg font-semibold text-on-background">{total} 則回覆</h2>

        {session?.user ? (
          <form
            action={addComment}
            className="mb-4 space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 dark:bg-surface-container"
          >
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="parentId" value="" />
            <textarea
              name="content"
              required
              rows={3}
              placeholder="輸入你的解答或回覆（支援 $LaTeX$ 數學式）"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-2 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint"
            >
              送出回覆
            </button>
          </form>
        ) : (
          <p className="mb-4 text-body-md text-secondary">
            <Link href="/login" className="text-primary hover:underline">登入</Link> 後即可回覆。
          </p>
        )}

        <CommentThread
          nodes={tree}
          postId={post.id}
          postAuthorId={post.authorId}
          currentUserId={session?.user?.id ?? null}
        />
      </div>
    </section>
  );
}
