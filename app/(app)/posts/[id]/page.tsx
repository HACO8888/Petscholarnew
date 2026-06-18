import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, boards, comments } from "@/db/schema";
import { RichContent, renderContentHtml } from "@/lib/rich-content";
import { buildCommentTree } from "@/lib/comment-tree";
import { formatDateTime } from "@/lib/format";
import CommentThread from "@/components/CommentThread";
import CommentTreeSvg from "@/components/CommentTreeSvg";
import { addComment, reportPost } from "@/app/(app)/posts/actions";

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

  return (
    <section className="min-w-0">
      {/* Top bar: back button + bounty pill */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-md">
        <Link
          href={board ? `/boards/${board.id}` : "/boards"}
          className="text-secondary hover:text-primary font-bold text-body-md flex items-center gap-1 py-1.5 px-3 rounded-lg bg-surface-container-low border border-outline-variant/30 transition-all no-underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> 返回看板列表
        </Link>

        <div className="bg-tertiary-container text-on-tertiary-container px-4 py-1.5 rounded-full font-bold text-body-md flex items-center gap-1 shadow-sm">
          <span className="material-symbols-outlined text-[18px] text-on-tertiary-container icon-fill">monetization_on</span>
          <span>懸賞金幣:</span>
          <strong>{post.bounty}</strong>
        </div>
      </div>

      {/* Main post card */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm mb-lg min-w-0">
        <div className="flex flex-wrap gap-2 items-center mb-sm">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-primary-container text-on-primary-container">
            {post.department || "未分系"}
          </span>
          {post.solved ? (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container">
              已解決
            </span>
          ) : (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-secondary-container text-on-secondary-container">
              未解決
            </span>
          )}
          <span className="text-secondary text-xs ml-auto">{formatDateTime(post.createdAt)}</span>
        </div>
        <h2 className="font-bold text-headline-lg text-on-surface mb-md">{post.title}</h2>

        {/* Metadata author */}
        <div className="flex flex-wrap items-center gap-x-sm gap-y-2 mb-lg text-secondary text-xs pb-3 border-b border-outline-variant/20">
          <span className="material-symbols-outlined text-[16px]">person</span>
          <span>
            提問學生: <strong className="text-on-surface">{post.authorName}</strong>
          </span>

          {session?.user && (
            <div className="ml-auto flex items-center gap-3">
              <details className="text-error font-medium">
                <summary className="hover:underline flex items-center gap-0.5 cursor-pointer list-none">
                  <span className="material-symbols-outlined text-xs">flag</span> 檢舉此文
                </summary>
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
            </div>
          )}
        </div>

        <div className="overflow-x-auto mb-lg">
          <RichContent
            html={renderContentHtml(post.content)}
            className="text-on-surface-variant text-body-lg leading-relaxed"
          />
        </div>

        {/* Tags list */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-sm mt-md">
            {post.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] rounded"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Comment tree visualizer */}
      <div className="mb-lg">
        <h3 className="font-bold text-body-md text-on-surface flex items-center gap-1 mb-sm">
          <span className="material-symbols-outlined">account_tree</span> 留言樹狀結構
        </h3>
        <p className="text-secondary text-xs mb-sm">點擊節點可跳至對應留言。</p>
        <CommentTreeSvg nodes={tree} rootLabel={post.title} />
      </div>

      {/* Answers tree header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-md border-b border-outline-variant/30 pb-2">
        <h3 className="font-bold text-headline-md text-on-surface flex items-center gap-1 min-w-0">
          <span className="material-symbols-outlined text-primary">forum</span> 學霸解答與留言回覆
        </h3>
        {!post.solved && session?.user && (
          <a
            href="#reply-content"
            className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-4 py-2 rounded-lg flex items-center gap-1 transition-all shadow-sm no-underline"
          >
            <span className="material-symbols-outlined text-[18px]">rate_review</span> 我來解答
          </a>
        )}
      </div>

      {/* Comment list (rendered as Tree recursively) */}
      <div className="space-y-md">
        <CommentThread
          nodes={tree}
          postId={post.id}
          postAuthorId={post.authorId}
          currentUserId={session?.user?.id ?? null}
          currentUserRole={session?.user?.role ?? null}
          postSolved={post.solved}
        />
      </div>

      {/* Write Answer Card */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm mt-lg">
        <h3 className="font-bold text-body-md text-on-surface flex items-center gap-1 mb-md">
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
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary shadow-sm transition-all hover:bg-surface-tint text-body-md"
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
    </section>
  );
}
