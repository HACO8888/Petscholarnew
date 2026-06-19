import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, posts } from "@/db/schema";

const GEARS =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAd5EQYMNeZhaeVPJBxDQRENq3HoMhiGPAfsDK1FjPl8lmvz4h2kzohex1bMVVYD_-lIn7xyrE_ACr29q9FiE57rgJG2KB-pk_9Qv2F4VuWJbqRfoBZSspxb5BNwCIMCgwLkcWzH7argqHsW530KdTSCSjLjdUcNuqyThc0bHauVZItmgNAt3bnRiGnMk4G1g2yVUZ3uxWafxLTZbP6LBJHostz-0I_sUOoe-ATVg_DwPvnvUonX-VOVf8PhAq3sPJwucSVwN3mvipV";
const CIRCUIT =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA2xqI8COSSzq2VlLyD6InkqVnERKhWWXJMPk4CkjiFruy9ydcXorm0aKHtDsYxGA_njl7a34cJ4Ffnz5neHyUHB47q6BPIp9S7nmc9HWLZy6zHNujZ8qh3ztVk7KK-22xZsaFV2bzryFo14J3qaOB99i5sz4mPVbI8LskdMwNzDI9c9hjA5PajjMSydIVtWO3zbHdCi5LnQMjpu-Xh5aHAmwrowojKGXljrowTXAWrxan4K6LjFdVNFl-eWsxBeLmNbNR6Jezl422E";
const DASHBOARD =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBF2_fBGZkpqP7400anD8oHxUPzxgjQVulIrhUj2pfvsKoWhTODBpkjJoaWpxubucjC_WK4R0eYbKggEMhYKsXzzpSO_iwXlxB6_c2EvoJ4l2kAV_ATHe4Jie_ErREcvkUMUot4jQnfhCKQ9Hn5FHsDtfIbHi7le-UEah1wDVB5kXDa7FZEypDVDNE-OW2Xcktf2TBWk0GE5sF6MzNnVYlCoVR_eEpEchimE3FOpng9J-YjNueIXFY1UN2SRg0z-KRFAYuvs-_sIgpJ";
const COVER: Record<string, string> = {
  cmee: GEARS,
  coe: GEARS,
  ceecs: CIRCUIT,
  cod: CIRCUIT,
  com: DASHBOARD,
  chss: DASHBOARD,
};

export default async function BoardsPage() {
  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);

  // 各看板的公開提問數（真實統計）
  const countRows = await db
    .select({ boardId: posts.boardId, count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.hidden, false))
    .groupBy(posts.boardId);
  const postCount = new Map<string, number>(countRows.map((r) => [r.boardId, r.count]));

  // 熱門標籤（真實聚合）
  const tagRows = await db.select({ tags: posts.tags }).from(posts).where(eq(posts.hidden, false));
  const tagCount = new Map<string, number>();
  for (const r of tagRows) for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  return (
    <section>
      <div className="mb-xl">
        <h1 className="text-headline-lg font-semibold text-on-surface mb-xs">學院看板</h1>
        <p className="text-body-lg text-on-surface-variant">探索各學院的專業知識、討論與學習資源。</p>
      </div>

      {/* 熱門標籤 */}
      {topTags.length > 0 && (
        <div className="mb-xl rounded-xl border border-outline-variant/20 bg-surface-container-low p-md dark:bg-surface-container">
          <h2 className="mb-sm flex items-center gap-1 text-label-md font-bold text-secondary">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>trending_up</span>
            熱門標籤
          </h2>
          <div className="flex flex-wrap gap-sm">
            {topTags.map((t, i) => (
              <span
                key={t}
                className={`rounded-full px-3.5 py-1.5 text-label-md font-semibold shadow-sm ${
                  i === 0
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : "bg-surface-container-high text-on-surface-variant border border-outline-variant/40"
                }`}
              >
                # {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 學院 Bento 卡（封面圖） */}
      {boardRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest px-4 py-12 text-center dark:bg-surface-container">
          <span className="material-symbols-outlined text-[48px] text-outline" aria-hidden>dashboard</span>
          <p className="text-body-md text-secondary">目前還沒有任何看板。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {boardRows.map((b) => {
            const count = postCount.get(b.id) ?? 0;
            const accent = b.color ?? "#4b6172";
            return (
              <Link
                key={b.id}
                href={`/boards/${b.id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition-all hover:-translate-y-1 hover:shadow-md no-underline dark:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <div className="relative h-32" style={{ backgroundColor: accent }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/5" />
                  {COVER[b.id] && (
                    <img
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover opacity-60 mix-blend-overlay transition-transform duration-500 group-hover:scale-105"
                      src={COVER[b.id]}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute left-md top-md flex h-10 w-10 items-center justify-center rounded-xl bg-white/85 text-xl shadow-sm backdrop-blur-sm dark:bg-black/35"
                  >
                    {b.icon ?? "📚"}
                  </span>
                  <span className="absolute right-md top-md inline-flex items-center gap-0.5 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    <span className="material-symbols-outlined text-[14px]" aria-hidden>forum</span>
                    {count}
                  </span>
                  <h3 className="absolute inset-x-md bottom-md min-w-0 truncate text-headline-md font-bold text-white drop-shadow-sm">
                    {b.name}
                  </h3>
                </div>
                <div className="flex flex-1 flex-col p-md">
                  {b.description && (
                    <p className="mb-md line-clamp-2 text-body-md text-on-surface-variant">
                      {b.description}
                    </p>
                  )}
                  {b.departments.length > 0 && (
                    <div className="mb-md flex flex-wrap gap-xs">
                      {b.departments.map((d) => (
                        <span
                          key={d}
                          className="rounded-md border border-outline-variant/40 bg-surface-container px-2 py-1 text-[11px] text-on-surface-variant dark:bg-surface-variant"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between text-label-md text-on-surface-variant">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]" aria-hidden>forum</span>
                      {count} 則提問
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      前往
                      <span className="material-symbols-outlined text-[16px]" aria-hidden>arrow_forward</span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
