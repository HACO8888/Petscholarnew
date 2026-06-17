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
    <section>
      <h1 className="mb-lg text-headline-lg font-semibold text-on-background">系統管理後台</h1>

      {/* 封鎖帳號及問題：待處理檢舉。駁回/封鎖後即從此清單移除 */}
      <h2 className="mb-3 text-body-lg font-semibold text-on-background">
        封鎖帳號及問題（待處理 {pendingReports.length}）
      </h2>
      <div className="mb-8 space-y-2">
        {pendingReports.length === 0 ? (
          <p className="text-body-md text-secondary">目前沒有待處理的檢舉案件。</p>
        ) : (
          pendingReports.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 dark:bg-surface-container"
            >
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant">
                {r.targetType === "post" ? "提問" : "留言"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md text-on-background">{r.targetText}</p>
                <p className="text-label-md text-secondary">
                  原因：{r.reason}．檢舉人：{r.reporter}．{formatDateTime(r.createdAt)}
                </p>
              </div>
              <form action={blockReport}>
                <input type="hidden" name="reportId" value={r.id} />
                <button
                  type="submit"
                  className="rounded-full bg-error px-4 py-1.5 text-label-md font-bold text-on-error transition-all hover:opacity-90"
                >
                  封鎖內容
                </button>
              </form>
              <form action={rejectReport}>
                <input type="hidden" name="reportId" value={r.id} />
                <button
                  type="submit"
                  className="rounded-full border border-outline-variant px-4 py-1.5 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  駁回案件
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      {/* 檢舉案件與處理日誌 */}
      <h2 className="mb-3 text-body-lg font-semibold text-on-background">檢舉案件與處理日誌</h2>
      <div className="mb-8 overflow-hidden rounded-xl border border-outline-variant/30">
        {allReports.map((r) => {
          const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-b border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 last:border-0 dark:bg-surface-container"
            >
              <span className={`rounded-full px-2 py-0.5 text-label-md font-medium ${badge.cls}`}>
                {badge.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-md text-on-background">{r.targetText}</span>
              <span className="text-label-md text-secondary">
                {r.resolvedAt ? `處理於 ${formatDateTime(r.resolvedAt)}` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* 全站提問紀錄 + 分類篩選 */}
      <h2 className="mb-3 text-body-lg font-semibold text-on-background">全站提問紀錄</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <Link
          href="/admin"
          className={`rounded-full px-3 py-1 text-label-md font-medium no-underline ${
            !boardFilter ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          全部
        </Link>
        {boardRows.map((b) => (
          <Link
            key={b.id}
            href={`/admin?board=${b.id}`}
            className={`rounded-full px-3 py-1 text-label-md font-medium no-underline ${
              boardFilter === b.id ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {b.icon} {b.name}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant/30">
        {postRows.length === 0 ? (
          <p className="bg-surface-container-lowest p-4 text-body-md text-secondary dark:bg-surface-container">
            此分類沒有提問。
          </p>
        ) : (
          postRows.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 border-b border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 last:border-0 dark:bg-surface-container"
            >
              <Link href={`/posts/${p.id}`} className="min-w-0 flex-1 truncate text-body-md text-on-background no-underline hover:text-primary hover:underline">
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
    </section>
  );
}
