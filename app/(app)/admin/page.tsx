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
  { id: "overview", label: "總覽與上線" },
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

  // ---- 全站統計（真實值，單一查詢一次聚合，避免多次掃描與數字不一致） ----
  const [statsRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      solved: sql<number>`count(*) filter (where ${posts.solved})::int`,
      blocked: sql<number>`count(*) filter (where ${posts.hidden})::int`,
    })
    .from(posts);
  const totalPosts = statsRow?.total ?? 0;
  const solvedPosts = statsRow?.solved ?? 0;
  const blockedPosts = statsRow?.blocked ?? 0;

  // ---- 檢舉案件 ----
  const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
  const pendingReports = allReports.filter((r) => r.status === "pending");
  const resolvedReports = allReports.filter((r) => r.status !== "pending");

  // ---- 分析資料（由真實 posts 聚合，反映提問方向；含隱藏內容） ----
  const allPostsForAnalytics = await db
    .select({ boardName: boards.name, tags: posts.tags, solved: posts.solved })
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
  const topTag = topTags[0]?.[0] ?? "尚無明顯主題";
  const topBoard = topBoards[0]?.[0] ?? "尚無集中學院";

  const tabBase = { board: boardFilter, q: questionFilter };

  return (
    <section className="tab-section active" id="sect-admin">
      <div className="mb-lg border-b border-outline-variant/30 pb-3 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-transparent p-md rounded-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-md">
          <div>
            <h1 className="font-semibold text-headline-lg text-red-600 dark:text-red-400">🛡️ 系統管理員後台</h1>
            <p className="text-secondary text-body-md">
              只有切換為「系統管理員」身分時才會顯示。可查看全站提問紀錄、上線狀態、刪除不恰當問題、封鎖帳號並分析近期提問方向。
            </p>
          </div>
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-3 py-1 rounded-full text-xs font-bold w-fit">
            <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            Admin Only
          </span>
        </div>
      </div>

      <div id="admin-dashboard-content" className="space-y-lg">
        <div className="bg-surface-container-lowest dark:bg-surface-container-high rounded-xl border border-outline-variant/30 shadow-sm p-sm overflow-x-auto">
          <div className="flex gap-sm min-w-max">
            {PANELS.map((p) => (
              <Link
                key={p.id}
                href={buildHref(tabBase, { panel: p.id })}
                className={`admin-panel-tab px-md py-sm rounded-lg border text-xs font-bold transition-all no-underline ${
                  panel === p.id
                    ? "bg-red-600 text-white border-red-600 shadow"
                    : "bg-surface text-secondary border-outline-variant"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ====================== 總覽與上線 ====================== */}
        {panel === "overview" && (
          <div className="admin-subpanel space-y-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-md" id="admin-stats-grid">
              <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm">
                <p className="text-xs text-secondary mb-1">已解決問題</p>
                <h3 className="font-bold text-3xl text-green-600 dark:text-green-400">{solvedPosts}</h3>
                <p className="text-[10px] text-secondary mt-1">已被標記為已解決</p>
              </div>
              <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm">
                <p className="text-xs text-secondary mb-1">全站問題總數</p>
                <h3 className="font-bold text-3xl text-primary">{totalPosts}</h3>
                <p className="text-[10px] text-secondary mt-1">跨所有學院看板</p>
              </div>
              <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm">
                <p className="text-xs text-secondary mb-1">待處理檢舉</p>
                <h3 className="font-bold text-3xl text-red-600 dark:text-red-400">{pendingReports.length}</h3>
                <p className="text-[10px] text-secondary mt-1">可直接屏蔽或駁回</p>
              </div>
              <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm">
                <p className="text-xs text-secondary mb-1">已封鎖問題</p>
                <h3 className="font-bold text-3xl text-orange-600 dark:text-orange-400">{blockedPosts}</h3>
                <p className="text-[10px] text-secondary mt-1">已被隱藏、不對外顯示</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
              <div className="flex items-center justify-between mb-md border-b border-outline-variant/20 pb-2">
                <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-[20px]">groups</span> 上線人數與帳號狀態
                </h3>
              </div>
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 hide-scrollbar" id="admin-online-users-list">
                <p className="text-body-md text-secondary">
                  本系統採資料庫 session，目前未提供「即時上線人數」與「帳號封鎖名單」資料來源（schema 無對應欄位），
                  故此處不顯示估計數字以避免誤導。提問與檢舉之管理請使用上方各子面板。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ====================== 全站提問紀錄 ====================== */}
        {panel === "questions" && (
          <div className="admin-subpanel">
            <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-sm mb-md border-b border-outline-variant/20 pb-2">
                <div>
                  <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1">
                    <span className="material-symbols-outlined text-[20px]">history</span> 全站提問紀錄
                  </h3>
                  <p className="text-xs text-secondary">
                    可直接刪除問題，或刪除後封鎖提問帳號；封鎖與屏蔽結果會與檢舉案件即時同步。
                  </p>
                </div>
                <div className="flex items-center gap-sm shrink-0">
                  <form method="get" className="flex items-center gap-sm w-full">
                    {boardFilter && <input type="hidden" name="board" value={boardFilter} />}
                    <input type="hidden" name="panel" value="questions" />
                    <select
                      id="admin-question-filter"
                      name="q"
                      defaultValue={questionFilter}
                      className="min-w-0 flex-1 bg-surface border border-outline-variant text-on-surface rounded-lg text-xs py-1.5 px-2 focus:ring-primary focus:border-primary"
                    >
                      {QUESTION_FILTERS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="shrink-0 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-bold py-1.5 px-3 rounded-lg border border-outline-variant/30"
                    >
                      篩選
                    </button>
                  </form>
                </div>
              </div>

              {/* 學院（board）篩選 pills */}
              <div className="flex flex-wrap gap-2 mb-md border-b border-outline-variant/30 pb-3">
                <Link
                  href={buildHref(tabBase, { panel: "questions", board: undefined })}
                  className={`text-label-md font-medium px-3 py-1 rounded-full no-underline ${
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
                    className={`text-label-md font-medium px-3 py-1 rounded-full no-underline ${
                      boardFilter === b.id
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {b.icon} {b.name}
                  </Link>
                ))}
              </div>

              <div className="space-y-md max-h-[620px] overflow-y-auto pr-1 hide-scrollbar" id="admin-question-records-list">
                {postRows.length === 0 ? (
                  <div className="text-center text-secondary text-xs py-10 border border-dashed border-outline-variant/40 rounded-xl">
                    目前沒有符合條件的問題紀錄。
                  </div>
                ) : (
                  postRows.map((p) => (
                    <div
                      key={p.id}
                      className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface space-y-2"
                      id={`admin-question-${p.id}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                              {p.boardName}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${
                                p.solved
                                  ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300"
                              }`}
                            >
                              {p.solved ? "已解決" : "未解決"}
                            </span>
                            {p.hidden && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                                問題已刪除
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-on-surface line-clamp-1">{p.title}</h4>
                          <p className="text-xs text-secondary line-clamp-2 mt-1">{p.content}</p>
                        </div>
                        <div className="flex md:flex-col gap-1.5 shrink-0">
                          <Link
                            href={`/posts/${p.id}`}
                            className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[10px] px-3 py-1.5 rounded-lg border border-outline-variant/30 no-underline"
                          >
                            查看
                          </Link>
                          {p.hidden ? (
                            <form action={restorePost}>
                              <input type="hidden" name="postId" value={p.id} />
                              <button
                                type="submit"
                                className="w-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[10px] px-3 py-1.5 rounded-lg border border-outline-variant/30"
                              >
                                還原問題
                              </button>
                            </form>
                          ) : (
                            <form action={deletePost}>
                              <input type="hidden" name="postId" value={p.id} />
                              <button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg"
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
                      <div className="flex flex-wrap gap-1">
                        {(p.tags ?? []).slice(0, 5).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====================== 檢舉案件與處理日誌 ====================== */}
        {panel === "reports" && (
          <div className="admin-subpanel">
            <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center gap-2 mb-md border-b border-outline-variant/20 pb-2">
                <h3 className="font-bold text-body-lg text-red-600 dark:text-red-400 flex items-center gap-1 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">report</span>
                  <span className="truncate">檢舉案件與處理日誌</span>
                </h3>
                <span className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 whitespace-nowrap">
                  {pendingReports.length} 案待理
                </span>
              </div>
              <div className="space-y-md max-h-[360px] overflow-y-auto pr-1 hide-scrollbar mb-md" id="admin-reports-list">
                {pendingReports.length === 0 ? (
                  <div className="bg-surface-container-low p-md rounded-xl text-center text-xs text-secondary py-8">
                    目前沒有待處理的檢舉案件。
                  </div>
                ) : (
                  pendingReports.map((r) => (
                    <div
                      key={r.id}
                      className="bg-surface-container-low dark:bg-surface p-md rounded-xl border border-outline-variant/30 space-y-sm"
                      id={`rep-card-${r.id}`}
                    >
                      <div className="flex items-center justify-between text-xs text-secondary">
                        <span className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold px-2 py-0.5 rounded">
                          {r.targetType === "post" ? "檢舉文章" : "檢舉回覆"}
                        </span>
                        <span>
                          {r.reporter ?? "匿名"} • {formatDateTime(r.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface font-bold">
                        理由：<span className="font-normal text-secondary">{r.reason ?? "未填寫"}</span>
                      </p>
                      <div className="bg-surface-container-high dark:bg-surface-container p-sm rounded text-xs text-secondary font-mono leading-normal border border-outline-variant/20 line-clamp-2 break-words">
                        {r.targetText ?? "（內容已不可用）"}
                      </div>
                      <div className="flex gap-sm justify-end">
                        <form action={blockReport}>
                          <input type="hidden" name="reportId" value={r.id} />
                          <button
                            type="submit"
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg"
                          >
                            屏蔽內容
                          </button>
                        </form>
                        <form action={rejectReport}>
                          <input type="hidden" name="reportId" value={r.id} />
                          <button
                            type="submit"
                            className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[10px] px-3 py-1.5 rounded-lg border border-outline-variant/30"
                          >
                            駁回案件
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <h4 className="font-bold text-xs text-on-surface mb-2 border-t border-outline-variant/20 pt-3">
                📋 操作歷史日誌
              </h4>
              <div className="flex-grow space-y-2 text-xs overflow-y-auto max-h-[360px] pr-1 hide-scrollbar" id="admin-logs-list">
                {resolvedReports.length === 0 ? (
                  <div className="text-center text-secondary py-8">無歷史操作日誌。</div>
                ) : (
                  resolvedReports.map((r) => {
                    const actionText = r.status === "blocked" ? "屏蔽隱藏" : "駁回免置";
                    return (
                      <div
                        key={r.id}
                        className="p-sm bg-surface-container-low dark:bg-surface rounded border border-outline-variant/10 leading-normal mb-1.5"
                      >
                        <span className="font-bold text-primary dark:text-primary-fixed-dim">[{actionText}]</span>{" "}
                        <span>
                          管理員審查了 {r.reporter ?? "匿名"} 的{r.targetType === "post" ? "文章" : "回覆"}
                          檢舉案，結果為 [{actionText}]。
                        </span>
                        <span className="block text-[9px] text-secondary text-right mt-1">
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
          <div className="admin-subpanel">
            <div className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm">
              <div className="flex justify-between items-center gap-2 mb-md border-b border-outline-variant/20 pb-2">
                <h3 className="font-bold text-body-lg text-purple-600 dark:text-purple-400 flex items-center gap-1 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">query_stats</span>
                  <span className="truncate">最近提問方向洞悉</span>
                </h3>
                <span className="bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 whitespace-nowrap">
                  {analyticsTotal} 筆資料
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div>
                  <h4 className="font-bold text-xs text-on-surface mb-2">熱門標籤</h4>
                  <div className="space-y-2" id="admin-tag-analysis">
                    <AdminBars items={topTags} total={analyticsTotal} accent="bg-purple-500" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-on-surface mb-2">學院分布</h4>
                  <div className="space-y-2" id="admin-board-analysis">
                    <AdminBars items={topBoards} total={analyticsTotal} accent="bg-primary" />
                  </div>
                </div>
              </div>
              <div className="mt-md bg-primary/5 border border-primary/10 rounded-xl p-md">
                <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">lightbulb</span> 系統洞悉
                </h4>
                <div className="space-y-1 text-xs text-secondary" id="admin-insights-list">
                  {analyticsTotal === 0 ? (
                    <p>目前尚無足夠的提問資料可供分析。</p>
                  ) : (
                    <>
                      <p>
                        • 近期最常被提問的方向是 <strong className="text-primary">{topTag}</strong>
                        ，可安排 TA 或教授補充教材。
                      </p>
                      <p>
                        • 問題主要集中在 <strong className="text-primary">{topBoard}</strong>
                        ，建議優先觀察該學院的期末學習壓力。
                      </p>
                      <p>
                        • 目前尚有 <strong className="text-primary">{unsolvedCount}</strong> 筆未解決問題，可推播給相關科系學霸或助教。
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
      <div className="text-xs text-secondary bg-surface-container-low p-3 rounded-lg text-center">
        目前沒有足夠資料。
      </div>
    );
  }
  return (
    <>
      {items.map(([label, count]) => {
        const pct = total ? Math.max(8, Math.round((count / total) * 100)) : 0;
        return (
          <div key={label} className="space-y-1">
            <div className="flex justify-between gap-2 text-xs font-semibold">
              <span className="truncate min-w-0">{label}</span>
              <span className="shrink-0 whitespace-nowrap">{count} 筆</span>
            </div>
            <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
              <div className={`${accent} h-full rounded-full`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </>
  );
}
