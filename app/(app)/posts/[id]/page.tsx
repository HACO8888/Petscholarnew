import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, boards, comments } from "@/db/schema";
import { RichContent, renderContentHtml } from "@/lib/rich-content";
import { buildCommentTree, pruneHidden } from "@/lib/comment-tree";
import { formatDateTime } from "@/lib/format";
import CommentThread from "@/components/CommentThread";
import CommentTreeSvg from "@/components/CommentTreeSvg";
import UserAvatarLink from "@/components/UserAvatarLink";
import { reportPost } from "@/app/(app)/posts/actions";

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

  // 取全部留言（含被隱藏者）建樹後再剪除被隱藏子樹，避免被隱藏父留言的回覆被升級為頂層。
  const commentRows = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, id));

  const tree = pruneHidden(
    buildCommentTree(commentRows, renderContentHtml, formatDateTime),
  );

  return (
    <section className="mx-auto min-w-0 max-w-4xl">
      {/* 返回列 */}
      <div className="mb-md">
        <Link
          href={board ? `/boards/${board.id}` : "/boards"}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-body-md font-medium text-secondary no-underline transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_back</span>
          {board ? `返回${board.name}` : "返回看板列表"}
        </Link>
      </div>

      {/* 題目卡 */}
      <article className="mb-lg min-w-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm dark:bg-surface-container-high">
        <div className="p-lg">
          {/* 狀態 + 懸賞徽章列 */}
          <div className="mb-md flex flex-wrap items-center gap-sm">
            {post.solved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-3 py-1 text-label-md font-bold text-on-tertiary-container">
                <span className="material-symbols-outlined text-[16px] icon-fill" aria-hidden>check_circle</span>
                已解決
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-label-md font-bold text-on-secondary-container">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>schedule</span>
                待解答
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 text-label-md font-bold text-on-primary-container">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>school</span>
              {post.department || "未分系"}
            </span>
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-tertiary-container px-3 py-1 text-label-md font-bold text-on-tertiary-container shadow-sm"
              title={post.solved ? "本提問已結算懸賞" : "解答被採納可獲得懸賞金幣"}
            >
              <span className="material-symbols-outlined text-[16px] icon-fill" aria-hidden>monetization_on</span>
              懸賞 {post.bounty}
            </span>
          </div>

          {/* 標題 */}
          <h1 className="mb-md break-words text-headline-lg font-semibold text-on-surface">{post.title}</h1>

          {/* 作者資訊列 */}
          <div className="flex flex-wrap items-center gap-x-sm gap-y-2 border-b border-outline-variant/30 pb-md text-label-md text-secondary">
            <span>提問學生</span>
            <UserAvatarLink
              userId={post.authorId}
              name={post.authorName}
              image={null}
              showName
              nameClassName="font-bold text-on-surface"
            />
            <span aria-hidden="true" className="text-outline-variant">•</span>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" aria-hidden>schedule</span>
              {formatDateTime(post.createdAt)}
            </span>

            {session?.user && (
              <details className="ml-auto text-error">
                <summary className="flex cursor-pointer list-none items-center gap-0.5 rounded-full px-2 py-0.5 font-medium hover:bg-error-container/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden>flag</span> 檢舉此文
                </summary>
                <form action={reportPost} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="檢舉原因"
                    maxLength={100}
                    className="flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-label-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-outline-variant px-3 py-1 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    送出檢舉
                  </button>
                </form>
              </details>
            )}
          </div>

          {/* 內文（KaTeX） */}
          <div className="mt-lg overflow-x-auto">
            <RichContent
              html={renderContentHtml(post.content)}
              className="text-body-lg leading-relaxed text-on-surface-variant"
            />
          </div>

          {/* 附圖 */}
          {post.image && (
            <a
              href={post.image}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-lg block w-fit overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:bg-surface-container"
            >
              <img
                src={post.image}
                alt="提問附圖"
                className="max-h-96 max-w-full object-contain"
              />
            </a>
          )}

          {/* 標籤 */}
          {post.tags.length > 0 && (
            <div className="mt-lg flex flex-wrap gap-sm border-t border-outline-variant/30 pt-md">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary-container px-2.5 py-0.5 text-label-md text-on-secondary-container"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* 留言樹狀結構視覺化 */}
      <div className="mb-lg rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container">
        <h2 className="mb-xs flex items-center gap-1 text-body-md font-bold text-on-surface">
          <span className="material-symbols-outlined text-primary" aria-hidden>account_tree</span> 留言樹狀結構
        </h2>
        <p className="mb-md text-label-md text-secondary">頂端為本提問，往下為各層回覆。點擊（或聚焦後按 Enter）任一節點即可跳至對應留言。</p>
        <CommentTreeSvg nodes={tree} rootLabel={post.title} />
      </div>

      {/* 解答與留言標頭 */}
      <div className="mb-md flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant/30 pb-sm">
        <h2 className="flex min-w-0 items-center gap-1.5 text-headline-md font-semibold text-on-surface">
          <span className="material-symbols-outlined text-primary" aria-hidden>forum</span> 學霸解答與留言回覆
        </h2>
        {!post.solved && session?.user && (
          <a
            href="#reply-content"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-label-md font-bold text-on-primary no-underline shadow-sm transition-all hover:bg-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>rate_review</span> 我來解答
          </a>
        )}
      </div>

      {/* 留言列表（樹狀遞迴渲染）+ 即時留言輸入（含頂層輸入框） */}
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
    </section>
  );
}
