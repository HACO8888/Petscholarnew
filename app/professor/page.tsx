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
    <section>
      <h1 className="mb-lg text-headline-lg font-semibold text-on-background">課程管理</h1>

      <div className="grid grid-cols-2 gap-md sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 dark:bg-surface-container">
            <p className="text-headline-md font-bold text-primary">{s.value}</p>
            <p className="text-label-md text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-body-lg font-semibold text-on-background">各學院提問數</h2>
      <div className="space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 dark:bg-surface-container">
        {byBoard.map((b) => (
          <div key={b.name} className="flex items-center gap-2">
            <span>{b.icon}</span>
            <span className="w-40 text-body-md text-on-background">{b.name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full bg-primary"
                style={{ width: `${total > 0 ? (b.c / total) * 100 : 0}%` }}
              />
            </div>
            <span className="w-10 text-right text-label-md text-secondary">{b.c}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-body-lg font-semibold text-on-background">待解答的提問</h2>
      <div className="space-y-2">
        {pending.length === 0 ? (
          <p className="text-body-md text-secondary">目前沒有待解答的提問 🎉</p>
        ) : (
          pending.map((p) => (
            <Link
              key={p.id}
              href={`/posts/${p.id}`}
              className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 no-underline transition-colors hover:border-primary/40 dark:bg-surface-container"
            >
              <span className="text-body-md text-on-background">{p.title}</span>
              <span className="text-label-md text-secondary">{p.boardName} · {formatDateTime(p.createdAt)}</span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
