import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, boards, reports } from "@/db/schema";
import AccessDenied from "@/components/AccessDenied";
import { formatDateTime } from "@/lib/format";
import { blockReport, rejectReport } from "./actions";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "待處理", cls: "bg-tertiary-container text-on-tertiary-container" },
  blocked: { label: "已封鎖", cls: "bg-error-container text-on-error-container" },
  rejected: { label: "已駁回", cls: "bg-surface-container-high text-on-surface-variant" },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") {
    return <AccessDenied need="系統管理員" />;
  }

  const { board: boardFilter } = await searchParams;

  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);

  // 全站提問紀錄（含被封鎖者；分類篩選真的會過濾）
  const postRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      authorName: posts.authorName,
      boardId: posts.boardId,
      boardName: boards.name,
      solved: posts.solved,
      hidden: posts.hidden,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(boardFilter ? eq(posts.boardId, boardFilter) : undefined)
    .orderBy(desc(posts.createdAt));

  // 檢舉案件
  const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
  const pendingReports = allReports.filter((r) => r.status === "pending");

  return (
    <section className="tab-section active">
      {/* 頁面標題（仿 legacy <main> 區塊抬頭，帶下分隔線） */}
      <div className="mb-lg border-b border-outline-variant/30 pb-3">
        <h1 className="mb-xs font-semibold text-headline-lg text-on-surface">系統管理後台</h1>
        <p className="text-body-md text-secondary">
          審核待處理檢舉、追蹤處理日誌，並檢視全站提問紀錄與分類分布。
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-12">
        {/* 封鎖帳號及問題：待處理檢舉。駁回/封鎖後即從此清單移除 */}
        <div className="flex min-h-[440px] flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high lg:col-span-7">
          <h3 className="mb-2 flex items-center gap-1 text-body-lg font-bold text-on-surface">
            <span className="material-symbols-outlined text-error">gpp_bad</span> 封鎖帳號及問題（待處理 {pendingReports.length}）
          </h3>
          <p className="mb-md text-xs text-secondary">
            檢視待處理的檢舉案件，可選擇封鎖內容或駁回案件；處理後該筆即從此清單移除。
          </p>

          <div className="flex flex-grow flex-col gap-sm">
            {pendingReports.length === 0 ? (
              <p className="text-body-md text-secondary">目前沒有待處理的檢舉案件。</p>
            ) : (
              pendingReports.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 dark:bg-surface-container"
                >
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant">
                    {r.targetType === "post" ? "提問" : "留言"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md text-on-surface">{r.targetText}</p>
                    <p className="text-label-md text-secondary">
                      原因：{r.reason}．檢舉人：{r.reporter}．{formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <form action={blockReport}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1 rounded-full bg-error px-4 py-1.5 text-label-md font-bold text-on-error transition-all hover:opacity-90"
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      封鎖內容
                    </button>
                  </form>
                  <form action={rejectReport}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1 rounded-full border border-outline-variant px-4 py-1.5 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      駁回案件
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 檢舉案件與處理日誌 */}
        <div className="flex min-h-[440px] flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high lg:col-span-5">
          <h3 className="mb-2 flex items-center gap-1 text-body-lg font-bold text-on-surface">
            <span className="material-symbols-outlined text-primary">history</span> 檢舉案件與處理日誌
          </h3>
          <p className="mb-md text-xs text-secondary">
            完整檢舉紀錄與狀態徽章，包含已封鎖、已駁回與處理時間。
          </p>

          <div className="flex flex-grow flex-col gap-sm overflow-auto">
            {allReports.length === 0 ? (
              <p className="text-body-md text-secondary">尚無任何檢舉紀錄。</p>
            ) : (
              allReports.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 dark:bg-surface-container"
                  >
                    <span className={`rounded-full px-2 py-0.5 text-label-md font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body-md text-on-surface">{r.targetText}</span>
                    <span className="text-label-md text-secondary">
                      {r.resolvedAt ? `處理於 ${formatDateTime(r.resolvedAt)}` : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* 狀態圖例（仿 legacy 圖例列） */}
          <div className="mt-md grid grid-cols-3 gap-sm border-t border-outline-variant/30 pt-md text-[10px] text-secondary">
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-tertiary-container" />
              <span>待處理</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-error" />
              <span>已封鎖</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-outline-variant" />
              <span>已駁回</span>
            </div>
          </div>
        </div>
      </div>

      {/* 全站提問紀錄 + 分類篩選 */}
      <div className="mt-lg rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
        <h3 className="mb-2 flex items-center gap-1 text-body-lg font-bold text-on-surface">
          <span className="material-symbols-outlined text-primary">dashboard</span> 全站提問紀錄
        </h3>
        <p className="mb-md text-xs text-secondary">
          依學院分類篩選並檢視所有提問（含已封鎖內容）。
        </p>

        {/* 分類篩選分頁列（仿 legacy tab pills） */}
        <div className="mb-md flex flex-wrap gap-2 border-b border-outline-variant/30 pb-3">
          <Link
            href="/admin"
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
              href={`/admin?board=${b.id}`}
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

        <div className="overflow-hidden rounded-lg border border-outline-variant/30">
          {postRows.length === 0 ? (
            <p className="bg-surface-container-low p-4 text-body-md text-secondary dark:bg-surface-container">
              此分類沒有提問。
            </p>
          ) : (
            postRows.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low px-4 py-2.5 last:border-0 dark:bg-surface-container"
              >
                <Link
                  href={`/posts/${p.id}`}
                  className="min-w-0 flex-1 truncate text-body-md text-on-surface no-underline hover:text-primary hover:underline"
                >
                  {p.title}
                </Link>
                <span className="text-label-md text-secondary">{p.boardName}</span>
                <span className="text-label-md text-secondary">{p.authorName}</span>
                {p.hidden ? (
                  <span className="rounded-full bg-error-container px-2 py-0.5 text-label-md text-on-error-container">已封鎖</span>
                ) : p.solved ? (
                  <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-md text-on-primary-container">已解決</span>
                ) : (
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-secondary">待解答</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
