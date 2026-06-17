import Link from "next/link";
import { and, desc, eq, gt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, boards, comments } from "@/db/schema";
import PostListItem, { type PostListData } from "@/components/PostListItem";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "unsolved", label: "待解答" },
  { key: "solved", label: "已解決" },
  { key: "bounty", label: "懸賞中" },
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
  else if (active === "bounty") conds.push(gt(posts.bounty, 0));

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
    <>
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-xl gap-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">
            學術討論版
          </h1>
          <p className="text-secondary font-body-lg text-body-lg">
            尋找解答，分享知識，賺取懸賞金幣。
          </p>
        </div>
        <Link
          href="/posts/new"
          className="bg-primary text-on-primary px-lg py-md rounded-lg flex items-center justify-center gap-sm hover:bg-surface-tint shadow-sm transition-all focus:ring-2 focus:ring-primary-container focus:outline-none no-underline"
          style={{ textDecoration: "none" }}
        >
          <span className="material-symbols-outlined">edit_square</span>
          <span className="font-label-md text-label-md text-[14px]">發問</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-sm mb-lg">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={buildQuery({ status: f.key, sort: activeSort })}
            className={
              active === f.key
                ? "px-md py-xs rounded-full bg-primary-container text-on-primary-container border border-transparent font-label-md text-label-md transition-colors no-underline"
                : "px-md py-xs rounded-full bg-surface text-secondary border border-outline-variant hover:bg-surface-container font-label-md text-label-md transition-colors no-underline"
            }
          >
            {f.label}
          </Link>
        ))}
        <form method="get" action="/discussion" className="ml-auto flex items-center gap-xs">
          {/* 保留目前的狀態篩選，避免切換排序時清掉 status */}
          {active !== "all" && (
            <input type="hidden" name="status" value={active} />
          )}
          <label
            htmlFor="discussion-sort"
            className="text-secondary text-label-md font-label-md mr-xs"
          >
            排序:
          </label>
          <select
            id="discussion-sort"
            name="sort"
            defaultValue={activeSort}
            className="bg-surface border border-outline-variant text-on-surface text-body-md rounded-lg py-xs pl-sm pr-lg focus:ring-primary focus:border-primary cursor-pointer transition-colors"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-md py-xs rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md hover:bg-surface-container transition-colors"
          >
            套用
          </button>
        </form>
      </div>

      {/* Question List */}
      <div id="discussion-questions-list" className="flex flex-col gap-md">
        {rows.length === 0 ? (
          /* Empty State Placeholder */
          <div
            id="empty-state-placeholder"
            className="flex flex-col items-center justify-center py-xl px-md bg-surface-container-lowest border border-dashed border-outline-variant/60 rounded-xl text-center p-8 shadow-sm"
          >
            <span
              className="material-symbols-outlined text-[64px] text-outline mb-md"
              style={{ fontSize: "64px", color: "#73777c" }}
            >
              forum
            </span>
            <h3 className="font-headline-md text-headline-md text-primary mb-sm">
              目前還沒有任何使用者發問
            </h3>
            <p className="font-body-md text-body-md text-secondary max-w-md mb-md">
              這裡將會顯示大家討論的內容。目前還沒有使用者輸入問題，點擊右上方「發表發問」按鈕，即可開始發布您的第一篇學業交流問題！
            </p>
            <Link
              href="/posts/new"
              className="bg-primary hover:bg-surface-tint text-on-primary px-lg py-md rounded-lg font-label-md text-label-md flex items-center justify-center gap-xs shadow-sm transition-all focus:ring-2 focus:ring-primary-container focus:outline-none no-underline"
              style={{ textDecoration: "none" }}
            >
              <span className="material-symbols-outlined text-[18px]">
                edit_square
              </span>
              <span>發表第一篇發問</span>
            </Link>
          </div>
        ) : (
          rows.map((p) => <PostListItem key={p.id} post={p as PostListData} />)
        )}
      </div>
    </>
  );
}
