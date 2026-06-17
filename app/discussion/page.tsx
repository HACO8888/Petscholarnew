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

export default async function DiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active: FilterKey = (FILTERS.some((f) => f.key === status)
    ? status
    : "all") as FilterKey;

  const conds: SQL[] = [eq(posts.hidden, false)];
  if (active === "solved") conds.push(eq(posts.solved, true));
  else if (active === "unsolved") conds.push(eq(posts.solved, false));
  else if (active === "bounty") conds.push(gt(posts.bounty, 0));

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
      commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id} and ${comments.hidden} = false)`,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(and(...conds))
    .orderBy(desc(posts.createdAt));

  return (
    <section>
      <div className="mb-lg">
        <h1 className="text-headline-lg font-semibold text-on-background">討論版</h1>
        <p className="mt-1 text-body-md text-secondary">集中顯示全站提問與解答。</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/discussion" : `/discussion?status=${f.key}`}
            className={`rounded-full px-4 py-1.5 text-label-md font-medium no-underline transition-colors ${
              active === f.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-body-md text-secondary">沒有符合條件的提問。</p>
        ) : (
          rows.map((p) => <PostListItem key={p.id} post={p as PostListData} />)
        )}
      </div>
    </section>
  );
}
