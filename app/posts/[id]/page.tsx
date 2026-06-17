import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, boards, comments } from "@/db/schema";
import { RichContent, renderContentHtml } from "@/lib/rich-content";
import { buildCommentTree, countNodes } from "@/lib/comment-tree";
import { formatDateTime } from "@/lib/format";
import CommentThread from "@/components/CommentThread";
import CommentTreeSvg from "@/components/CommentTreeSvg";
import { addComment, reportPost } from "@/app/posts/actions";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post || post.hidden) notFound();

  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, post.boardId))
    .limit(1);

  const commentRows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.postId, id), eq(comments.hidden, false)));

  const tree = buildCommentTree(commentRows, renderContentHtml, formatDateTime);
  const total = countNodes(tree);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-lg">
      {/* Back Button */}
      <div>
        <Link
          href={board ? `/boards/${board.id}` : "/boards"}
          className="inline-flex items-center gap-xs text-secondary no-underline transition-colors hover:text-primary text-label-md"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {board ? `返回 ${board.icon} ${board.name}` : "返回討論版列表"}
        </Link>
      </div>

      {/* Question Detail Card */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container">
        <div className="flex flex-col gap-md">
          {/* Author + bounty/status row */}
          <div className="flex items-center justify-between border-b border-outline-variant pb-sm">
            <div className="flex items-center gap-sm text-secondary text-label-md">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container">
                <span className="material-symbols-outlined text-[18px] text-on-secondary-container">person</span>
              </div>
              <div>
                <div className="text-[14px] font-bold text-on-surface">{post.authorName}</div>
                <div className="text-[11px] text-secondary">
                  {post.department ? `${post.department} • ` : ""}
                  {formatDateTime(post.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-xs">
              {post.solved ? (
                <div className="flex items-center gap-xs rounded-full border border-outline-variant/20 bg-primary-container px-md py-[4px] text-on-primary-container shadow-sm">
                  <span className="material-symbols-outlined text-[16px] icon-fill">check_circle</span>
                  <span className="text-label-md font-bold">已解決</span>
                </div>
              ) : (
                <div className="flex items-center gap-xs rounded-full bg-surface-container-high px-md py-[4px] text-secondary">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  <span className="text-label-md font-bold">待解答</span>
                </div>
              )}
              {post.bounty > 0 && (
                <div className="flex items-center gap-xs rounded-full border border-outline-variant/20 bg-tertiary-container px-md py-[4px] text-on-tertiary-container shadow-sm">
                  <span className="material-symbols-outlined text-[16px]">generating_tokens</span>
                  <span className="text-label-md font-bold">💰 懸賞 {post.bounty}</span>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="mt-sm text-[24px] font-bold text-primary text-headline-md">{post.title}</h2>

          {/* Content (RichContent / KaTeX) */}
          <RichContent
            html={renderContentHtml(post.content)}
            className="whitespace-pre-wrap py-md leading-relaxed text-on-surface-variant text-body-lg"
          />

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-xs pt-sm">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-sm bg-secondary-container px-sm py-[2px] text-[11px] text-on-secondary-container text-label-md"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Report */}
          {session?.user && (
            <details className="pt-sm text-secondary text-label-md">
              <summary className="cursor-pointer hover:text-primary">檢舉此提問</summary>
              <form action={reportPost} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="postId" value={post.id} />
                <input
                  type="text"
                  name="reason"
                  placeholder="檢舉原因"
                  maxLength={100}
                  className="flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-on-surface outline-none focus:border-primary text-label-md"
                />
                <button
                  type="submit"
                  className="rounded-full border border-outline-variant px-3 py-1 text-on-surface-variant hover:bg-surface-container text-label-md"
                >
                  送出檢舉
                </button>
              </form>
            </details>
          )}
        </div>
      </div>

      {/* Comment Tree Visualizer */}
      <div className="flex flex-col gap-sm">
        <h3 className="flex items-center gap-xs text-body-lg font-bold text-on-surface">
          <span className="material-symbols-outlined">account_tree</span> 留言樹狀結構
        </h3>
        <p className="text-secondary text-label-md">點擊節點可跳至對應留言。</p>
        <CommentTreeSvg nodes={tree} rootLabel={post.title} />
      </div>

      {/* Answers Section */}
      <div className="flex flex-col gap-md">
        <h3 className="flex items-center gap-xs text-headline-md font-bold text-primary">
          <span className="material-symbols-outlined">forum</span> 解答與回覆 ({total})
        </h3>

        <div className="flex flex-col gap-sm">
          <CommentThread
            nodes={tree}
            postId={post.id}
            postAuthorId={post.authorId}
            currentUserId={session?.user?.id ?? null}
            currentUserRole={session?.user?.role ?? null}
            postSolved={post.solved}
          />
        </div>
      </div>

      {/* Write Answer Card */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container">
        <h3 className="mb-md flex items-center gap-xs text-body-lg font-bold text-on-surface">
          <span className="material-symbols-outlined">edit_square</span> 撰寫您的解答 / 回覆
        </h3>

        {session?.user ? (
          <form action={addComment} className="flex flex-col gap-md">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="parentId" value="" />
            <div className="flex flex-col gap-xs">
              <label htmlFor="reply-content" className="text-on-surface text-label-md">
                您的解答描述
              </label>
              <textarea
                id="reply-content"
                name="content"
                required
                rows={5}
                placeholder="請詳細列出您的公式推導、參考資料或邏輯解釋…（支援 $LaTeX$ 數學式）"
                className="w-full rounded-lg border border-outline-variant bg-surface px-sm py-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary text-body-md"
              />
            </div>
            <div className="mt-sm flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-xs rounded-lg bg-primary px-lg py-sm text-on-primary shadow-sm transition-colors hover:bg-surface-tint text-label-md"
              >
                <span className="material-symbols-outlined text-[18px]">send</span> 發表解答
              </button>
            </div>
          </form>
        ) : (
          <p className="text-secondary text-body-md">
            <Link href="/login" className="text-primary hover:underline">
              登入
            </Link>{" "}
            後即可發表解答。
          </p>
        )}
      </div>
    </div>
  );
}
