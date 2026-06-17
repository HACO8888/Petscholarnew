import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, comments, boards } from "@/db/schema";
import AccessDenied from "@/components/AccessDenied";
import { formatDateTime } from "@/lib/format";

export default async function ProfessorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "professor" && session.user.role !== "admin") {
    return <AccessDenied need="課程教授或助教" />;
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.hidden, false));
  const [{ solved }] = await db
    .select({ solved: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.hidden, false), eq(posts.solved, true)));
  const [{ answers }] = await db
    .select({ answers: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.hidden, false));
  const unsolved = total - solved;
  const solvedRate = total > 0 ? Math.round((solved / total) * 100) : 0;

  const byBoard = await db
    .select({ name: boards.name, icon: boards.icon, c: sql<number>`count(${posts.id})::int` })
    .from(boards)
    .leftJoin(posts, and(eq(posts.boardId, boards.id), eq(posts.hidden, false)))
    .groupBy(boards.id, boards.name, boards.icon, boards.sortOrder)
    .orderBy(boards.sortOrder);

  const pending = await db
    .select({
      id: posts.id,
      title: posts.title,
      authorName: posts.authorName,
      boardName: boards.name,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(and(eq(posts.hidden, false), eq(posts.solved, false)))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  const stats = [
    { label: "總提問數", value: total },
    { label: "已解決", value: solved },
    { label: "待解答", value: unsolved },
    { label: "解決率", value: `${solvedRate}%` },
    { label: "總回覆數", value: answers },
  ];

  return (
    <section className="tab-section active" id="sect-professor">
      <div className="mb-lg rounded-lg border-b border-outline-variant/30 bg-gradient-to-r from-purple-500/10 to-transparent p-md pb-3">
        <h1 className="text-headline-lg font-semibold text-purple-700 dark:text-purple-400">🎓 課程教授管理主頁</h1>
        <p className="text-body-md text-secondary">追蹤學生在解題遇到的常見盲點與難度，掌握各學院提問與解決狀況。</p>
      </div>

      <div className="mb-lg grid grid-cols-2 gap-md sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm dark:bg-surface-container-high"
          >
            <p className="text-headline-md font-bold text-primary">{s.value}</p>
            <p className="text-label-md text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        {/* 各學院提問分佈 */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <h3 className="mb-2 flex items-center gap-1 text-body-lg font-bold text-purple-700 dark:text-purple-400">
            <span className="material-symbols-outlined">local_offer</span> 各學院提問分佈
          </h3>
          <p className="text-xs text-secondary">依討論版統計目前的提問數量，掌握各學院的發問熱度。</p>

          <div className="mt-lg space-y-sm">
            {byBoard.map((b) => (
              <div key={b.name}>
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1">
                    <span>{b.icon}</span>
                    <span>{b.name}</span>
                  </span>
                  <span className="font-bold text-primary">
                    {b.c} 篇 ({total > 0 ? Math.round((b.c / total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${total > 0 ? (b.c / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 待解答的提問 */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm dark:bg-surface-container-high">
          <h3 className="mb-md flex items-center gap-1 text-body-lg font-bold text-purple-700 dark:text-purple-400">
            <span className="material-symbols-outlined">lightbulb</span> 待解答的提問
          </h3>

          <div className="space-y-2 text-xs">
            {pending.length === 0 ? (
              <p className="text-body-md text-secondary">目前沒有待解答的提問 🎉</p>
            ) : (
              pending.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="group relative block rounded border border-outline-variant/20 bg-surface-container p-sm no-underline transition-colors hover:border-primary/40"
                >
                  <div className="mb-1 flex items-center gap-1 font-bold text-primary">
                    <span className="rounded bg-primary-container px-1.5 py-[1px] text-[10px] text-on-primary-container">
                      #{p.boardName}
                    </span>
                    {p.authorName ? (
                      <span className="text-[11px] font-normal text-secondary">{p.authorName}</span>
                    ) : null}
                  </div>
                  <p className="text-[13px] leading-relaxed text-on-surface">{p.title}</p>
                  <p className="mt-1 text-[11px] text-secondary">{formatDateTime(p.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
