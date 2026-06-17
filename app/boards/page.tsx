import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts } from "@/db/schema";

export default async function BoardsPage() {
  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);
  const countRows = await db
    .select({ boardId: posts.boardId, c: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.hidden, false))
    .groupBy(posts.boardId);
  const counts = new Map(countRows.map((r) => [r.boardId, r.c]));

  return (
    <section>
      <div className="mb-lg">
        <h1 className="text-headline-lg font-semibold text-on-background">看板</h1>
        <p className="mt-1 text-body-md text-secondary">探索各學院與科系的專業課業討論。</p>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {boardRows.map((b) => (
          <Link
            key={b.id}
            href={`/boards/${b.id}`}
            className="group rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-surface-container"
            style={b.color ? { borderTopColor: b.color, borderTopWidth: 3 } : undefined}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{b.icon}</span>
              <h2 className="text-headline-md font-semibold text-on-background group-hover:text-primary">
                {b.name}
              </h2>
            </div>
            <p className="mt-2 line-clamp-2 text-body-md text-secondary">{b.description}</p>
            <div className="mt-3 flex items-center gap-3 text-label-md text-secondary">
              <span>{b.departments.length} 科系</span>
              <span>·</span>
              <span>{counts.get(b.id) ?? 0} 篇提問</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
