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
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">學院看板</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">探索各學院的專業知識、討論與學習資源。</p>
      </div>

      {/* 熱門標籤 */}
      {topTags.length > 0 && (
        <div className="mb-xl">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-md">熱門標籤</h2>
          <div className="flex flex-wrap gap-sm">
            {topTags.map((t, i) => (
              <span
                key={t}
                className={`font-label-md text-label-md px-4 py-2 rounded-full shadow-sm ${
                  i === 0
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : "bg-surface-container-high text-on-surface border border-outline-variant"
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
        <p className="font-body-md text-body-md text-on-surface-variant">目前還沒有任何看板。</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {boardRows.map((b) => {
            const count = postCount.get(b.id) ?? 0;
            return (
              <Link
                key={b.id}
                href={`/boards/${b.id}`}
                className="flex flex-col bg-surface rounded-xl shadow-sm border border-surface-container-highest overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group relative no-underline dark:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <div className="h-32 relative" style={{ backgroundColor: b.color ?? "#4b6172" }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {COVER[b.id] && (
                     
                    <img
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover mix-blend-overlay opacity-60"
                      src={COVER[b.id]}
                    />
                  )}
                  <h3 className="absolute bottom-md left-md right-md flex items-center gap-2 font-headline-md text-headline-md text-white font-bold drop-shadow-sm">
                    {b.icon && <span aria-hidden="true">{b.icon}</span>}
                    <span className="min-w-0 truncate">{b.name}</span>
                  </h3>
                </div>
                <div className="flex flex-1 flex-col p-md">
                  {b.description && (
                    <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-md">
                      {b.description}
                    </p>
                  )}
                  {b.departments.length > 0 && (
                    <div className="flex flex-wrap gap-xs mb-md">
                      {b.departments.map((d) => (
                        <span
                          key={d}
                          className="bg-surface-container text-on-surface-variant font-label-md px-2 py-1 rounded-md text-[11px] border border-outline-variant"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-1 font-label-md text-label-md text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">forum</span>
                    {count} 則提問
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
