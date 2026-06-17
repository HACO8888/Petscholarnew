import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export interface PostListData {
  id: string;
  title: string;
  authorName: string;
  department: string | null;
  tags: string[];
  bounty: number;
  solved: boolean;
  createdAt: Date;
  commentCount: number;
  boardName?: string;
}

export default function PostListItem({ post }: { post: PostListData }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="block rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 no-underline transition-all hover:border-primary/40 hover:shadow-sm dark:bg-surface-container"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-body-lg font-semibold text-on-background">{post.title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {post.solved ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-container px-2 py-0.5 text-label-md font-medium text-on-primary-container">
              <span className="material-symbols-outlined text-[14px] icon-fill">check_circle</span>
              已解決
            </span>
          ) : (
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-secondary">
              待解答
            </span>
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
        {post.boardName && <span>· {post.boardName}</span>}
        {post.department && <span>· {post.department}</span>}
        <span>· {formatDateTime(post.createdAt)}</span>
        <span>· 💬 {post.commentCount}</span>
      </div>
      {post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
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
    </Link>
  );
}
