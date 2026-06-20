import Link from "next/link";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, boards, comments, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { toPlainPreview } from "@/lib/rich-content";
import UserAvatarLink from "@/components/UserAvatarLink";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "unsolved", label: "未解答" },
  { key: "solved", label: "已解決" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "latest", label: "最新發布" },
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
    activeSort === "comments"
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
      authorId: posts.authorId,
      authorName: posts.authorName,
      authorImage: users.image,
      department: posts.department,
      tags: posts.tags,
      solved: posts.solved,
      createdAt: posts.createdAt,
      boardName: boards.name,
      commentCount,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <>
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-xl gap-md">
        <div>
          <h1 className="text-headline-lg font-semibold text-on-surface mb-xs">學術討論版</h1>
          <p className="text-body-lg text-on-surface-variant">尋找解答，分享知識，賺取金幣。</p>
        </div>
        <Link
          href="/posts/new"
          className="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-full bg-primary px-5 py-2.5 font-bold text-on-primary no-underline shadow-sm transition-all hover:bg-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>edit_square</span>
          <span className="text-label-md">發問</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-sm mb-lg">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={buildQuery({ status: f.key, sort: activeSort, board: activeBoard })}
            aria-current={active === f.key ? "page" : undefined}
            className={
              (active === f.key
                ? "bg-primary-container text-on-primary-container border-transparent font-bold shadow-sm"
                : "bg-surface-container-lowest text-secondary border-outline-variant/60 hover:bg-surface-container hover:text-on-surface dark:bg-surface-container") +
              " rounded-full border px-md py-xs text-label-md no-underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            }
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
            <span className="text-secondary text-label-md">學院:</span>
            <select
              name="board"
              defaultValue={activeBoard}
              className="cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest py-xs pl-sm pr-lg text-body-md text-on-surface transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-surface-container"
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
            <span className="text-secondary text-label-md">排序:</span>
            <select
              name="sort"
              defaultValue={activeSort}
              className="cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest py-xs pl-sm pr-lg text-body-md text-on-surface transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-surface-container"
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
            className="rounded-full border border-outline-variant bg-surface-container-lowest px-md py-xs text-label-md text-secondary transition-colors hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:bg-surface-container"
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
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-sm dark:bg-surface-container"
          >
            <span className="material-symbols-outlined mb-md text-[64px] text-outline" aria-hidden>
              forum
            </span>
            <h3 className="mb-sm text-headline-md font-semibold text-on-surface">
              {activeBoard !== "all" || active !== "all"
                ? "找不到符合條件的提問"
                : "目前還沒有任何使用者發問"}
            </h3>
            <p className="mb-md max-w-md text-body-md text-secondary">
              {activeBoard !== "all" || active !== "all"
                ? "試試調整上方的學院或狀態篩選，或直接發表一篇新的提問。"
                : "這裡將會顯示大家討論的內容。點擊「發表第一篇發問」按鈕，即可開始發布您的第一篇學業交流問題！"}
            </p>
            <Link
              href="/posts/new"
              className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-lg py-md text-label-md font-bold text-on-primary no-underline shadow-sm transition-all hover:bg-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>edit_square</span>
              <span>發表第一篇發問</span>
            </Link>
          </div>
        ) : (
          rows.map((post) => (
            <article
              key={post.id}
              className="group relative rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:border-primary/50 dark:bg-surface-container"
            >
              {/* 整卡可點：覆蓋連結讓內部頭像連結仍可獨立點擊 */}
              <Link
                href={`/posts/${post.id}`}
                className="absolute inset-0 z-0 rounded-xl no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                aria-label={post.title}
              />
              <div className="pointer-events-none relative z-10 flex flex-col gap-md sm:flex-row">
                <div className="order-2 mt-md flex shrink-0 items-stretch justify-start gap-sm border-t border-outline-variant/30 pt-md text-secondary sm:order-1 sm:mt-0 sm:w-20 sm:flex-col sm:items-stretch sm:gap-xs sm:border-t-0 sm:pt-0">
                  <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-surface-container-high px-2 py-1.5 dark:bg-surface-variant">
                    <span className="text-body-md font-bold text-on-surface">{post.commentCount}</span>
                    <span className="text-label-md">回覆</span>
                  </div>
                </div>
                <div className="order-1 min-w-0 flex-1 sm:order-2">
                  <div className="mb-sm flex flex-wrap items-center gap-x-sm gap-y-xs text-label-md text-secondary">
                    <span className="pointer-events-auto inline-flex">
                      <UserAvatarLink
                        userId={post.authorId}
                        name={post.authorName}
                        image={post.authorImage}
                        showName
                        nameClassName="text-label-md font-semibold text-on-surface-variant"
                      />
                    </span>
                    {post.department && <span>（{post.department}）</span>}
                    <span aria-hidden="true">•</span>
                    <span>{formatDateTime(post.createdAt)}</span>
                    {post.solved && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-container px-2 py-0.5 text-label-md font-medium text-on-primary-container">
                        <span className="material-symbols-outlined text-[14px] icon-fill" aria-hidden>check_circle</span>
                        已解決
                      </span>
                    )}
                  </div>
                  <h2 className="mb-xs break-words text-[20px] text-headline-md font-semibold text-on-surface transition-colors group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mb-md line-clamp-2 break-words text-body-md text-on-surface-variant">
                    {toPlainPreview(post.content)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-md text-on-secondary-container">
                      #{post.boardName}
                    </span>
                    {post.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary-container px-2 py-0.5 text-label-md text-on-secondary-container"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
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
