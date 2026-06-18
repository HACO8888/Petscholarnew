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

const PAGE_SIZE = 10;

type QueryState = {
  status?: FilterKey;
  sort?: SortKey;
  board?: string;
  page?: number;
};

// 依目前的 status / sort / board / page 拼出查詢字串，
// 讓多個篩選可同時生效、互不覆蓋。
function buildQuery(params: QueryState): string {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.sort && params.sort !== "latest") sp.set("sort", params.sort);
  if (params.board && params.board !== "all") sp.set("board", params.board);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/discussion?${qs}` : "/discussion";
}

export default async function DiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    board?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;

  const active: FilterKey = (FILTERS.some((f) => f.key === sp.status)
    ? sp.status
    : "all") as FilterKey;
  const activeSort: SortKey = (SORTS.some((s) => s.key === sp.sort)
    ? sp.sort
    : "latest") as SortKey;

  // 學院清單來自真實的 boards 資料表（每個看板代表一個學院）。
  const boardRows = await db
    .select({ id: boards.id, name: boards.name })
    .from(boards)
    .orderBy(boards.sortOrder);

  const activeBoard: string =
    sp.board && boardRows.some((b) => b.id === sp.board) ? sp.board : "all";

  const conds: SQL[] = [eq(posts.hidden, false)];
  if (active === "solved") conds.push(eq(posts.solved, true));
  else if (active === "unsolved") conds.push(eq(posts.solved, false));
  if (activeBoard !== "all") conds.push(eq(posts.boardId, activeBoard));

  const whereClause = and(...conds);

  // 共用的留言數子查詢：同時用於顯示與排序，確保排序依據與畫面數字一致。
  const commentCount = sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hidden} = false)`;

  const orderBy =
    activeSort === "bounty"
      ? [desc(posts.bounty), desc(posts.createdAt)]
      : activeSort === "comments"
        ? [desc(commentCount), desc(posts.createdAt)]
        : [desc(posts.createdAt)];

  // 先取總數以計算分頁，再依目前頁碼取對應區段。
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(posts)
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt(sp.page ?? "1", 10);
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;

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
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <>
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-xl gap-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">學術討論版</h1>
          <p className="text-secondary font-body-lg text-body-lg">尋找解答，分享知識，賺取懸賞金幣。</p>
        </div>
        <Link
          href="/posts/new"
          className="bg-primary text-on-primary px-lg py-md rounded-lg flex items-center justify-center gap-sm hover:bg-surface-tint shadow-sm transition-all focus:ring-2 focus:ring-primary-container focus:outline-none"
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
            href={buildQuery({ status: f.key, sort: activeSort, board: activeBoard })}
            className={
              active === f.key
                ? "px-md py-xs rounded-full bg-primary-container text-on-primary-container border border-transparent font-label-md text-label-md transition-colors"
                : "px-md py-xs rounded-full bg-surface text-secondary border border-outline-variant hover:bg-surface-container font-label-md text-label-md transition-colors"
            }
            style={{ textDecoration: "none" }}
          >
            {f.label}
          </Link>
        ))}

        {/* 排序 + 學院篩選表單：用 GET 送出，保留其他已選條件。 */}
        <form
          method="get"
          action="/discussion"
          className="ml-auto flex flex-wrap items-center gap-xs"
        >
          {/* 保留目前的狀態篩選，避免切換排序/學院時清掉 status */}
          {active !== "all" && (
            <input type="hidden" name="status" value={active} />
          )}
          <label className="flex items-center gap-xs">
            <span className="text-secondary text-label-md font-label-md">學院:</span>
            <select
              name="board"
              defaultValue={activeBoard}
              className="bg-surface border border-outline-variant text-on-surface text-body-md rounded-lg py-xs pl-sm pr-lg focus:ring-primary focus:border-primary cursor-pointer transition-colors"
            >
              <option value="all">全部學院</option>
              {boardRows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-xs">
            <span className="text-secondary text-label-md font-label-md">排序:</span>
            <select
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
          </label>
          <button
            type="submit"
            className="px-md py-xs rounded-full bg-surface text-secondary border border-outline-variant hover:bg-surface-container font-label-md text-label-md transition-colors"
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
            <span className="material-symbols-outlined text-[64px] text-outline mb-md">
              forum
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">
              {activeBoard !== "all" || active !== "all"
                ? "找不到符合條件的提問"
                : "目前還沒有任何使用者發問"}
            </h3>
            <p className="font-body-md text-body-md text-secondary max-w-md mb-md">
              {activeBoard !== "all" || active !== "all"
                ? "試試調整上方的學院或狀態篩選，或直接發表一篇新的提問。"
                : "這裡將會顯示大家討論的內容。點擊「發表第一篇發問」按鈕，即可開始發布您的第一篇學業交流問題！"}
            </p>
            <Link
              href="/posts/new"
              className="bg-primary hover:bg-surface-tint text-on-primary px-lg py-md rounded-lg font-label-md text-label-md flex items-center justify-center gap-xs shadow-sm transition-all focus:ring-2 focus:ring-primary-container focus:outline-none"
              style={{ textDecoration: "none" }}
            >
              <span className="material-symbols-outlined text-[18px]">edit_square</span>
              <span>發表第一篇發問</span>
            </Link>
          </div>
        ) : (
          rows.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.id}`}
              className="bg-surface-container-lowest border border-surface-variant rounded-lg p-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group block"
              style={{ textDecoration: "none" }}
            >
              <div className="flex flex-col sm:flex-row gap-md">
                <div className="flex sm:flex-col items-center sm:items-end justify-start sm:w-24 gap-sm sm:gap-xs text-secondary shrink-0 order-2 sm:order-1 mt-md sm:mt-0 pt-md sm:pt-0 border-t sm:border-t-0 border-surface-variant">
                  <div className="flex items-center gap-xs">
                    <span className="font-body-md text-body-md">{post.commentCount}</span>
                    <span className="text-label-md font-label-md">回覆</span>
                  </div>
                  <div className="flex items-center gap-xs bg-tertiary-container text-on-tertiary-container px-sm py-[2px] rounded-sm mt-xs">
                    <span className="material-symbols-outlined text-[14px]">generating_tokens</span>
                    <span className="font-label-md text-label-md">
                      {post.solved ? "已結算" : post.bounty}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 order-1 sm:order-2">
                  <div className="flex flex-wrap items-center gap-x-sm gap-y-xs mb-sm text-secondary font-label-md text-label-md">
                    <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-secondary-container text-[14px]">person</span>
                    </div>
                    <span className="text-on-surface-variant">
                      {post.authorName}
                      {post.department ? `（${post.department}）` : ""}
                    </span>
                    <span aria-hidden="true">•</span>
                    <span>{formatDateTime(post.createdAt)}</span>
                    {post.solved && (
                      <span className="px-sm py-[2px] bg-primary-container text-on-primary-container rounded-sm font-label-md text-label-md text-[11px]">
                        已解決
                      </span>
                    )}
                  </div>
                  <h2 className="font-headline-md text-headline-md text-primary mb-xs group-hover:text-surface-tint transition-colors text-[20px] break-words">
                    {post.title}
                  </h2>
                  <p className="text-on-surface-variant font-body-md text-body-md line-clamp-2 mb-md break-words">
                    {post.content}
                  </p>
                  <div className="flex flex-wrap gap-xs">
                    <span className="px-sm py-[2px] bg-secondary-container text-on-secondary-container rounded-sm font-label-md text-label-md text-[11px]">
                      #{post.boardName}
                    </span>
                    {post.tags.map((t) => (
                      <span
                        key={t}
                        className="px-sm py-[2px] bg-secondary-container text-on-secondary-container rounded-sm font-label-md text-label-md text-[11px]"
                      >
                        #{t}
                      </span>
                    ))}
                    {post.bounty > 0 && (
                      <span className="px-sm py-[2px] bg-secondary-container text-on-secondary-container rounded-sm font-label-md text-label-md text-[11px]">
                        #懸賞{post.bounty}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="分頁"
          className="flex justify-center items-center gap-sm mt-xl pb-xl"
        >
          {page > 1 ? (
            <Link
              href={buildQuery({
                status: active,
                sort: activeSort,
                board: activeBoard,
                page: page - 1,
              })}
              aria-label="上一頁"
              className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:bg-surface-container transition-colors"
              style={{ textDecoration: "none" }}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="w-8 h-8 flex items-center justify-center rounded-full text-secondary opacity-40 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </span>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
            p === page ? (
              <span
                key={p}
                aria-current="page"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm"
              >
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={buildQuery({
                  status: active,
                  sort: activeSort,
                  board: activeBoard,
                  page: p,
                })}
                className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:bg-surface-container font-label-md text-label-md transition-colors"
                style={{ textDecoration: "none" }}
              >
                {p}
              </Link>
            ),
          )}

          {page < totalPages ? (
            <Link
              href={buildQuery({
                status: active,
                sort: activeSort,
                board: activeBoard,
                page: page + 1,
              })}
              aria-label="下一頁"
              className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:bg-surface-container transition-colors"
              style={{ textDecoration: "none" }}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="w-8 h-8 flex items-center justify-center rounded-full text-secondary opacity-40 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </span>
          )}
        </nav>
      )}
    </>
  );
}
