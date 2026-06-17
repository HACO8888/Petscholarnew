import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, boards, reports } from "@/db/schema";
import AccessDenied from "@/components/AccessDenied";
import { formatDateTime } from "@/lib/format";
import { blockReport, rejectReport, deletePost, restorePost } from "./actions";

/** 後台子面板（對應 legacy 的 admin-panel-tab）。 */
const PANELS = [
  { id: "overview", label: "總覽與統計" },
  { id: "questions", label: "全站提問紀錄" },
  { id: "reports", label: "檢舉案件與日誌" },
  { id: "analytics", label: "提問方向洞悉" },
] as const;
type PanelId = (typeof PANELS)[number]["id"];

/** legacy 全站提問紀錄狀態篩選（select#admin-question-filter）。 */
const QUESTION_FILTERS = [
  { id: "all", label: "全部問題" },
  { id: "unsolved", label: "未解決" },
  { id: "solved", label: "已解決" },
  { id: "blocked", label: "封鎖帳號及問題" },
] as const;
type QuestionFilter = (typeof QUESTION_FILTERS)[number]["id"];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "待處理", cls: "bg-tertiary-container text-on-tertiary-container" },
  blocked: { label: "已封鎖", cls: "bg-error-container text-on-error-container" },
  rejected: { label: "已駁回", cls: "bg-surface-container-high text-on-surface-variant" },
};

/** 保留目前 searchParams、覆寫部分鍵的小工具，供子面板/篩選連結使用。 */
function buildHref(base: Record<string, string | undefined>, override: Record<string, string | undefined>) {
  const merged = { ...base, ...override };
  const qs = Object.entries(merged)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  return qs ? `/admin?${qs}` : "/admin";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; panel?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") {
    return <AccessDenied need="系統管理員" />;
  }

  const sp = await searchParams;
  const boardFilter = sp.board;
  const panel: PanelId = (PANELS.some((p) => p.id === sp.panel) ? sp.panel : "overview") as PanelId;
  const questionFilter: QuestionFilter = (QUESTION_FILTERS.some((f) => f.id === sp.q)
    ? sp.q
    : "all") as QuestionFilter;

  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);

  // ---- 全站提問紀錄（含被封鎖者；學院 + 狀態篩選真的會過濾） ----
  const whereClauses = [
    boardFilter ? eq(posts.boardId, boardFilter) : undefined,
    questionFilter === "solved" ? eq(posts.solved, true) : undefined,
    questionFilter === "unsolved" ? eq(posts.solved, false) : undefined,
    questionFilter === "blocked" ? eq(posts.hidden, true) : undefined,
  ].filter(Boolean);

  const postRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      authorName: posts.authorName,
      department: posts.department,
      boardId: posts.boardId,
      boardName: boards.name,
      tags: posts.tags,
      bounty: posts.bounty,
      solved: posts.solved,
      hidden: posts.hidden,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(whereClauses.length ? and(...whereClauses) : undefined)
    .orderBy(desc(posts.createdAt));

  // ---- 全站統計（真實值） ----
  const [totalPostsRow] = await db.select({ n: sql<number>`count(*)::int` }).from(posts);
  const [blockedPostsRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.hidden, true));
  const totalPosts = totalPostsRow?.n ?? 0;
  const blockedPosts = blockedPostsRow?.n ?? 0;

  // ---- 檢舉案件 ----
  const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
  const pendingReports = allReports.filter((r) => r.status === "pending");
  const resolvedReports = allReports.filter((r) => r.status !== "pending");

  // ---- 分析資料（由真實 posts 聚合，不含已隱藏內容才反映「對外可見」分布；此處用全部含隱藏以反映提問方向） ----
  const allPostsForAnalytics = await db
    .select({ boardId: posts.boardId, boardName: boards.name, tags: posts.tags, solved: posts.solved })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id));

  const tagCounts = new Map<string, number>();
  const boardCounts = new Map<string, number>();
  for (const p of allPostsForAnalytics) {
    boardCounts.set(p.boardName, (boardCounts.get(p.boardName) ?? 0) + 1);
    for (const t of p.tags ?? []) {
      if (!t) continue;
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topBoards = [...boardCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const analyticsTotal = allPostsForAnalytics.length;
  const unsolvedCount = allPostsForAnalytics.filter((p) => !p.solved).length;

  const tabBase = { board: boardFilter, q: questionFilter };

  return (
    <section className="tab-section active">
      {/* 頁面標題（仿 legacy admin 抬頭，帶警示底色與 Admin Only 標籤） */}
      <div className="mb-lg rounded-lg border-b border-outline-variant/30 bg-gradient-to-r from-error/10 via-tertiary/10 to-transparent p-md pb-3">
        <div className="flex flex-col gap-md lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mb-xs flex items-center gap-1 font-semibold text-headline-lg text-error">
              <span className="material-symbols-outlined">shield</span> 系統管理員後台
            </h1>
            <p className="text-body-md text-secondary">
              查看全站提問紀錄、審核待處理檢舉、追蹤處理日誌，並分析近期提問方向。
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-error-container px-3 py-1 text-xs font-bold text-on-error-container">
            <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            Admin Only
          </span>
        </div>
      </div>

      {/* 子面板分頁列（仿 legacy admin-panel-tab，以 searchParams.panel 切換） */}
      <div className="mb-lg overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-sm shadow-sm dark:bg-surface-container-high">
        <div className="flex min-w-max gap-sm">
          {PANELS.map((p) => (
            <Link
              key={p.id}
              href={buildHref(tabBase, { panel: p.id })}
              className={`rounded-lg border px-md py-sm text-xs font-bold no-underline transition-all ${
                panel === p.id
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/30 bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ====================== 總覽與統計 ====================== */}
      {panel === "overview" && (
        <div className="space-y-lg">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm dark:bg-surface-container-high">
              <p className="mb-1 text-xs text-secondary">全站問題總數</p>
              <h3 className="text-3xl font-bold text-primary">{totalPosts}</h3>
              <p className="mt-1 text-[10px] text-secondary">跨所有學院看板</p>
            </div>
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm dark:bg-surface-container-high">
              <p className="mb-1 text-xs text-secondary">待處理檢舉</p>
              <h3 className="text-3xl font-bold text-error">{pendingReports.length}</h3>
              <p className="mt-1 text-[10px] text-secondary">可直接封鎖或駁回</p>
            </div>
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm dark:bg-surface-container-high">
              <p className="mb-1 text-xs text-secondary">已封鎖問題</p>
              <h3 className="text-3xl font-bold text-tertiary">{blockedPosts}</h3>
              <p className="mt-1 text-[10px] text-secondary">已被隱藏、不對外顯示</p>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
            <h3 className="mb-md flex items-center gap-1 border-b border-outline-variant/20 pb-2 text-body-lg font-bold text-on-surface">
              <span className="material-symbols-outlined text-[20px]">groups</span> 帳號與上線狀態
            </h3>
            <p className="text-body-md text-secondary">
              本系統採資料庫 session，目前未提供「即時上線人數」與「帳號封鎖名單」資料來源（schema 無對應欄位），
              故此處不顯示估計數字以避免誤導。提問與檢舉之管理請使用上方各子面板。
            </p>
          </div>
        </div>
      )}

      {/* ====================== 全站提問紀錄 ====================== */}
      {panel === "questions" && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <div className="mb-md flex flex-col gap-sm border-b border-outline-variant/20 pb-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="flex items-center gap-1 text-body-lg font-bold text-on-surface">
                <span className="material-symbols-outlined text-[20px]">history</span> 全站提問紀錄
              </h3>
              <p className="text-xs text-secondary">
                依學院與狀態篩選，可直接刪除（隱藏）不恰當問題，刪除結果會與全站列表即時同步。
              </p>
            </div>
            {/* 狀態篩選（legacy select#admin-question-filter，以 searchParams.q 過濾） */}
            <div className="flex flex-wrap gap-2">
              {QUESTION_FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={buildHref(tabBase, { panel: "questions", q: f.id })}
                  className={`rounded-full px-3 py-1 text-label-md font-medium no-underline ${
                    questionFilter === f.id
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>

          {/* 學院（board）篩選 pills */}
          <div className="mb-md flex flex-wrap gap-2 border-b border-outline-variant/30 pb-3">
            <Link
              href={buildHref(tabBase, { panel: "questions", board: undefined })}
              className={`rounded-full px-3 py-1 text-label-md font-medium no-underline ${
                !boardFilter
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              全部
            </Link>
            {boardRows.map((b) => (
              <Link
                key={b.id}
                href={buildHref(tabBase, { panel: "questions", board: b.id })}
                className={`rounded-full px-3 py-1 text-label-md font-medium no-underline ${
                  boardFilter === b.id
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {b.icon} {b.name}
              </Link>
            ))}
          </div>

          <div className="space-y-md">
            {postRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/40 py-10 text-center text-xs text-secondary">
                目前沒有符合條件的問題紀錄。
              </div>
            ) : (
              postRows.map((p) => (
                <div
                  key={p.id}
                  className="space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-md dark:bg-surface-container"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {p.boardName}
                        </span>
                        {p.hidden ? (
                          <span className="rounded bg-error-container px-2 py-0.5 text-[10px] font-bold text-on-error-container">
                            問題已封鎖
                          </span>
                        ) : p.solved ? (
                          <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-primary-container">
                            已解決
                          </span>
                        ) : (
                          <span className="rounded bg-tertiary-container px-2 py-0.5 text-[10px] font-bold text-on-tertiary-container">
                            未解決
                          </span>
                        )}
                      </div>
                      <h4 className="line-clamp-1 text-sm font-bold text-on-surface">{p.title}</h4>
                      <p className="mt-1 line-clamp-2 text-xs text-secondary">{p.content}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5 md:flex-col">
                      <Link
                        href={`/posts/${p.id}`}
                        className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-[10px] font-bold text-on-surface-variant no-underline hover:bg-surface-container-high"
                      >
                        查看
                      </Link>
                      {p.hidden ? (
                        <form action={restorePost}>
                          <input type="hidden" name="postId" value={p.id} />
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-[10px] font-bold text-on-surface-variant hover:bg-surface-container-high"
                          >
                            還原問題
                          </button>
                        </form>
                      ) : (
                        <form action={deletePost}>
                          <input type="hidden" name="postId" value={p.id} />
                          <button
                            type="submit"
                            className="w-full rounded-lg bg-error px-3 py-1.5 text-[10px] font-bold text-on-error hover:opacity-90"
                          >
                            刪除問題
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[10px] text-secondary">
                    <span>
                      作者：<strong>{p.authorName}</strong>
                    </span>
                    <span>•</span>
                    <span>{p.department ?? "未指定科系"}</span>
                    <span>•</span>
                    <span>🪙 {p.bounty} 金幣</span>
                    <span>•</span>
                    <span>{formatDateTime(p.createdAt)}</span>
                  </div>
                  {(p.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.tags!.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-secondary-container px-2 py-0.5 text-[10px] text-on-secondary-container"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ====================== 檢舉案件與處理日誌 ====================== */}
      {panel === "reports" && (
        <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2">
          {/* 待處理檢舉：封鎖/駁回後即從此清單移除 */}
          <div className="flex min-h-[300px] flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
            <div className="mb-md flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <h3 className="flex items-center gap-1 text-body-lg font-bold text-error">
                <span className="material-symbols-outlined text-[20px]">report</span> 封鎖帳號及問題（待處理檢舉）
              </h3>
              <span className="rounded-full bg-error-container px-2 py-0.5 text-xs font-bold text-on-error-container">
                {pendingReports.length} 案待理
              </span>
            </div>
            <div className="flex flex-grow flex-col gap-sm">
              {pendingReports.length === 0 ? (
                <div className="rounded-xl bg-surface-container-low p-md py-8 text-center text-xs text-secondary dark:bg-surface-container">
                  目前沒有待處理的檢舉案件。
                </div>
              ) : (
                pendingReports.map((r) => (
                  <div
                    key={r.id}
                    className="space-y-sm rounded-xl border border-outline-variant/30 bg-surface-container-low p-md dark:bg-surface-container"
                  >
                    <div className="flex items-center justify-between text-xs text-secondary">
                      <span className="rounded bg-error-container px-2 py-0.5 font-bold text-on-error-container">
                        {r.targetType === "post" ? "檢舉文章" : "檢舉回覆"}
                      </span>
                      <span>
                        {r.reporter} • {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-on-surface">
                      理由：<span className="font-normal text-secondary">{r.reason}</span>
                    </p>
                    <div className="line-clamp-2 rounded border border-outline-variant/20 bg-surface-container-high p-sm font-mono text-xs leading-normal text-secondary dark:bg-surface-container">
                      {r.targetText}
                    </div>
                    <div className="flex justify-end gap-sm">
                      <form action={blockReport}>
                        <input type="hidden" name="reportId" value={r.id} />
                        <button
                          type="submit"
                          className="flex items-center gap-1 rounded-lg bg-error px-3 py-1.5 text-[10px] font-bold text-on-error hover:opacity-90"
                        >
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          屏蔽內容
                        </button>
                      </form>
                      <form action={rejectReport}>
                        <input type="hidden" name="reportId" value={r.id} />
                        <button
                          type="submit"
                          className="flex items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-[10px] font-bold text-on-surface-variant hover:bg-surface-container-high"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                          駁回案件
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 操作歷史日誌：由已處理案件（real reports）衍生為人類可讀條目 */}
          <div className="flex min-h-[300px] flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
            <h3 className="mb-md flex items-center gap-1 border-b border-outline-variant/20 pb-2 text-body-lg font-bold text-on-surface">
              <span className="material-symbols-outlined text-[20px]">history</span> 📋 操作歷史日誌
            </h3>
            <div className="flex-grow space-y-2 overflow-y-auto text-xs">
              {resolvedReports.length === 0 ? (
                <div className="py-8 text-center text-secondary">無歷史操作日誌。</div>
              ) : (
                resolvedReports.map((r) => {
                  const actionText = r.status === "blocked" ? "屏蔽隱藏" : "駁回免置";
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
                  return (
                    <div
                      key={r.id}
                      className="mb-1.5 rounded border border-outline-variant/10 bg-surface-container-low p-sm leading-normal dark:bg-surface-container"
                    >
                      <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                        [{actionText}]
                      </span>
                      <span className="text-on-surface">
                        管理員審查了 {r.reporter ?? "匿名"} 的{r.targetType === "post" ? "文章" : "回覆"}
                        檢舉案，結果為 [{actionText}]。
                      </span>
                      <span className="mt-1 block text-right text-[9px] text-secondary">
                        {r.resolvedAt ? formatDateTime(r.resolvedAt) : "—"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================== 提問方向洞悉 ====================== */}
      {panel === "analytics" && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <div className="mb-md flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h3 className="flex items-center gap-1 text-body-lg font-bold text-tertiary">
              <span className="material-symbols-outlined text-[20px]">query_stats</span> 最近提問方向洞悉
            </h3>
            <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-bold text-on-tertiary-container">
              {analyticsTotal} 筆資料
            </span>
          </div>

          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold text-on-surface">熱門標籤</h4>
              <AdminBars items={topTags} total={analyticsTotal} accent="bg-tertiary" />
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold text-on-surface">學院分布</h4>
              <AdminBars items={topBoards} total={analyticsTotal} accent="bg-primary" />
            </div>
          </div>

          <div className="mt-md rounded-xl border border-primary/10 bg-primary/5 p-md">
            <h4 className="mb-2 flex items-center gap-1 text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-[16px]">lightbulb</span> 系統洞悉
            </h4>
            <div className="space-y-1 text-xs text-secondary">
              {analyticsTotal === 0 ? (
                <p>目前尚無足夠的提問資料可供分析。</p>
              ) : (
                <>
                  <p>
                    • 近期最常被提問的方向是{" "}
                    <strong className="text-primary">{topTags[0]?.[0] ?? "尚無明顯主題"}</strong>
                    ，可安排 TA 或教授補充教材。
                  </p>
                  <p>
                    • 問題主要集中在{" "}
                    <strong className="text-primary">{topBoards[0]?.[0] ?? "尚無集中學院"}</strong>
                    ，建議優先觀察該學院的期末學習壓力。
                  </p>
                  <p>
                    • 目前尚有 <strong className="text-primary">{unsolvedCount}</strong>{" "}
                    筆未解決問題，可推播給相關科系學霸或助教。
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** legacy renderAdminBars 的 server component 版本。 */
function AdminBars({
  items,
  total,
  accent,
}: {
  items: [string, number][];
  total: number;
  accent: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-surface-container-low p-3 text-center text-xs text-secondary dark:bg-surface-container">
        目前沒有足夠資料。
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map(([label, count]) => {
        const pct = total ? Math.max(8, Math.round((count / total) * 100)) : 0;
        return (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span>{label}</span>
              <span>{count} 筆</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low dark:bg-surface-container">
              <div className={`h-full rounded-full ${accent}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
