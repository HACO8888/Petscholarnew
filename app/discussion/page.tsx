import Link from "next/link";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, boards, comments } from "@/db/schema";
import { formatDateTime } from "@/lib/format";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "unsolved", label: "未解答" },
  { key: "solved", label: "已解決" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "latest", label: "最新發布" },
  { key: "bounty", label: "最高懸賞" },
  { key: "comments", label: "最多回覆" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

// 依目前的 status / sort 拼出查詢字串，讓兩個篩選可同時生效、互不覆蓋。
function buildQuery(params: { status?: FilterKey; sort?: SortKey }): string {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.sort && params.sort !== "latest") sp.set("sort", params.sort);
  const qs = sp.toString();
  return qs ? `/discussion?${qs}` : "/discussion";
}

export default async function DiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const { status, sort } = await searchParams;
  const active: FilterKey = (FILTERS.some((f) => f.key === status)
    ? status
    : "all") as FilterKey;
  const activeSort: SortKey = (SORTS.some((s) => s.key === sort)
    ? sort
    : "latest") as SortKey;

  const conds: SQL[] = [eq(posts.hidden, false)];
  if (active === "solved") conds.push(eq(posts.solved, true));
  else if (active === "unsolved") conds.push(eq(posts.solved, false));

  // 共用的留言數子查詢：同時用於顯示與排序，確保排序依據與畫面數字一致。
  const commentCount = sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hidden} = false)`;

  const orderBy =
    activeSort === "bounty"
      ? [desc(posts.bounty), desc(posts.createdAt)]
      : activeSort === "comments"
        ? [desc(commentCount), desc(posts.createdAt)]
        : [desc(posts.createdAt)];

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      authorName: posts.authorName,
      department: posts.department,
      tags: posts.tags,
      bounty: posts.bounty,
      solved: posts.solved,
      createdAt: posts.createdAt,
      boardName: boards.name,
      commentCount,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(and(...conds))
    .orderBy(...orderBy);

  return (
    <section className="tab-section" id="sect-discussion">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-lg gap-md border-b border-outline-variant/30 pb-3">
        <div>
          <h1 className="font-semibold text-headline-lg text-on-background">學術討論區</h1>
          <p className="text-secondary text-body-md">發表一般學科提問，自由分享與賺取金幣。</p>
        </div>
        <Link
          href="/posts/new"
          className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-5 py-2.5 rounded-lg flex items-center gap-1 shadow-sm transition-all no-underline"
          style={{ textDecoration: "none" }}
        >
          <span className="material-symbols-outlined">edit_note</span> 發問與發帖
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-sm mb-md">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={buildQuery({ status: f.key, sort: activeSort })}
            className={
              active === f.key
                ? "px-3.5 py-1.5 rounded-full bg-primary text-on-primary shadow-sm font-semibold text-xs transition-all no-underline"
                : "px-3.5 py-1.5 rounded-full bg-surface-container-low text-secondary border border-outline-variant/30 font-semibold text-xs hover:bg-surface-container transition-all no-underline"
            }
          >
            {f.label}
          </Link>
        ))}

        <form method="get" action="/discussion" className="ml-auto flex items-center gap-1 text-xs">
          {/* 保留目前的狀態篩選，避免切換排序時清掉 status */}
          {active !== "all" && (
            <input type="hidden" name="status" value={active} />
          )}
          <span className="text-secondary">排序:</span>
          <select
            name="sort"
            defaultValue={activeSort}
            className="bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs rounded-lg py-1 px-2.5 cursor-pointer outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-full bg-surface-container-low text-secondary border border-outline-variant/30 font-semibold text-xs hover:bg-surface-container transition-all"
          >
            套用
          </button>
        </form>
      </div>

      {/* Question List (Tailwind styled mockup threads) */}
      <div className="space-y-md" id="discussion-posts-list">
        {rows.length === 0 ? (
          <div
            id="discussion-empty-placeholder"
            className="flex flex-col items-center justify-center py-xl px-md bg-surface-container-lowest dark:bg-surface-container-high border border-dashed border-outline-variant/60 rounded-xl text-center p-8 shadow-sm"
          >
            <span
              className="material-symbols-outlined text-[64px] text-outline mb-md"
              style={{ fontSize: "64px", color: "#73777c" }}
            >
              forum
            </span>
            <h3 className="font-headline-md text-headline-md text-primary mb-sm">
              目前還沒有任何使用者輸入
            </h3>
            <p className="font-body-md text-body-md text-secondary max-w-md">
              【學術討論區】目前還沒有使用者輸入問題，點擊右上方「發問與發帖」按鈕，即可開始發布您的第一篇學業交流問題！
            </p>
          </div>
        ) : (
          rows.map((post) => {
            const bountyText = post.solved ? "已結算" : `${post.bounty} 金幣`;
            return (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-xl p-md shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4 no-underline"
                style={{ textDecoration: "none" }}
              >
                <div className="flex flex-col items-center justify-center w-14 bg-surface-container-low rounded-lg p-2 text-center text-secondary">
                  <span className="text-sm font-bold text-primary dark:text-primary-fixed-dim">
                    {post.commentCount}
                  </span>
                  <span className="text-[9px]">回覆</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-xs text-secondary mb-1">
                    <span className="font-bold text-on-surface-variant">{post.authorName}</span>
                    <span>•</span>
                    <span>{formatDateTime(post.createdAt)}</span>
                    {post.solved && (
                      <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded text-[9px] font-bold">
                        已解決
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-body-lg text-primary dark:text-primary-fixed-dim group-hover:text-surface-tint mb-1">
                    {post.title}
                  </h3>
                  <p className="text-on-surface-variant text-xs line-clamp-2 mb-2">
                    {post.content}
                  </p>
                  <div className="flex gap-1.5">
                    <span className="px-2 py-0.5 bg-primary/5 text-primary border border-primary/10 text-[10px] rounded font-bold">
                      {post.boardName}
                    </span>
                    {post.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] rounded"
                      >
                        #{t}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 bg-tertiary-container text-on-tertiary-container text-[10px] font-bold rounded">
                      🪙 {bountyText}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
