import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import UserAvatarLink from "@/components/UserAvatarLink";

export interface PostListData {
  id: string;
  title: string;
  authorId?: string | null;
  authorName: string;
  authorImage?: string | null;
  department: string | null;
  tags: string[];
  solved: boolean;
  createdAt: Date;
  commentCount: number;
  boardName?: string;
}

/**
 * 統一的提問卡：被看板內頁、看板儀表板、全站提問列表共用。
 * 結構固定為「狀態徽章 → 標題 → 作者（可點頭像）/分系/時間/回覆數 → 標籤」，
 * 以確保跨頁掃讀體驗一致。
 */
export default function PostListItem({ post }: { post: PostListData }) {
  return (
    <article className="group relative rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:border-primary/50 dark:bg-surface-container">
      {/* 整卡可點：覆蓋連結讓內部 UserAvatarLink 仍可獨立點擊 */}
      <Link
        href={`/posts/${post.id}`}
        className="absolute inset-0 z-0 rounded-xl no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-label={post.title}
      />
      <div className="pointer-events-none relative z-10 flex flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-body-lg font-semibold text-on-surface transition-colors group-hover:text-primary">
            {post.title}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {post.solved ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-container px-2 py-0.5 text-label-md font-medium text-on-primary-container">
                <span className="material-symbols-outlined text-[14px] icon-fill" aria-hidden>check_circle</span>
                已解決
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-container-high px-2 py-0.5 text-label-md font-medium text-secondary dark:bg-surface-variant">
                <span className="material-symbols-outlined text-[14px]" aria-hidden>schedule</span>
                待解答
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-md text-secondary">
          <span className="pointer-events-auto inline-flex">
            <UserAvatarLink
              userId={post.authorId ?? null}
              name={post.authorName}
              image={post.authorImage ?? null}
              showName
              nameClassName="text-label-md font-semibold text-on-surface-variant"
            />
          </span>
          {post.department && (
            <>
              <span aria-hidden>·</span>
              <span>{post.department}</span>
            </>
          )}
          {post.boardName && (
            <>
              <span aria-hidden>·</span>
              <span>{post.boardName}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{formatDateTime(post.createdAt)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[14px]" aria-hidden>chat_bubble</span>
            {post.commentCount}
          </span>
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary-container px-2 py-0.5 text-label-md text-on-secondary-container"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
