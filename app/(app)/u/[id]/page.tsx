import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, pets, posts, comments } from "@/db/schema";
import { formatDateTime } from "@/lib/format";

function initial(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

/**
 * 公開的使用者檔案頁（/u/{id}）：唯讀。
 * 自習室成員頭像連到此頁；點自己會導向可編輯的 /profile。
 * 只顯示公開資訊（姓名/頭像/系所/簡介/寵物等級/解答與提問數），不含金幣餘額等私密資料。
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  if (!viewerId) redirect("/login");
  // 看自己 → 導向可編輯的個人檔案
  if (viewerId === id) redirect("/profile");

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      department: users.department,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!user) notFound();

  const [pet] = await db
    .select({ level: pets.level, name: pets.name })
    .from(pets)
    .where(eq(pets.userId, id))
    .limit(1);

  // 解答數＝未隱藏留言；採納數＝其中被採納者
  const userComments = await db
    .select({ id: comments.id, isAdopted: comments.isAdopted })
    .from(comments)
    .where(and(eq(comments.authorId, id), eq(comments.hidden, false)));
  const answerCount = userComments.length;
  const adoptedCount = userComments.filter((c) => c.isAdopted).length;

  // 最近提問（未隱藏）
  const recentPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      solved: posts.solved,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.authorId, id), eq(posts.hidden, false)))
    .orderBy(desc(posts.createdAt))
    .limit(5);

  const stats = [
    { label: "等級", value: pet?.level ?? 1, icon: "stars" },
    { label: "解答數", value: answerCount, icon: "forum" },
    { label: "被採納", value: adoptedCount, icon: "verified" },
  ];

  return (
    <div className="space-y-xl max-w-3xl">
      <div>
        <Link
          href="/study-rooms"
          className="inline-flex items-center gap-1 text-secondary hover:text-primary text-label-md no-underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          返回
        </Link>
      </div>

      {/* 名片 */}
      <section className="bg-surface-container-low rounded-xl p-lg border border-outline-variant/50 flex flex-col sm:flex-row items-center sm:items-start gap-lg">
        <div className="w-24 h-24 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-outline-variant/40">
          {user.image ? (
            <img
              alt={user.name ?? "使用者"}
              src={user.image}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary-container text-on-secondary-container font-bold text-headline-md">
              {initial(user.name)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {user.name ?? "匿名同學"}
          </h1>
          {user.department && (
            <p className="text-secondary text-body-md mt-1 flex items-center justify-center sm:justify-start gap-1">
              <span className="material-symbols-outlined text-[18px]">school</span>
              {user.department}
            </p>
          )}
          {pet?.name && (
            <p className="text-secondary text-body-md mt-1 flex items-center justify-center sm:justify-start gap-1">
              <span className="material-symbols-outlined text-[18px]">pets</span>
              夥伴：{pet.name}
            </p>
          )}
          {user.bio && (
            <p className="text-on-surface-variant text-body-md mt-2 break-words">
              {user.bio}
            </p>
          )}
          <p className="text-secondary text-label-md mt-2">
            加入於 {formatDateTime(user.createdAt)}
          </p>
        </div>
      </section>

      {/* 統計 */}
      <section className="grid grid-cols-3 gap-md">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-surface-container-low rounded-xl p-md border border-outline-variant/50 flex flex-col items-center gap-1"
          >
            <span className="material-symbols-outlined text-primary">{s.icon}</span>
            <span className="font-headline-md text-headline-md text-on-surface tabular-nums">
              {s.value}
            </span>
            <span className="text-secondary text-label-md">{s.label}</span>
          </div>
        ))}
      </section>

      {/* 最近提問 */}
      <section>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">help</span>
          最近提問
        </h2>
        {recentPosts.length === 0 ? (
          <p className="text-secondary text-body-md">尚無公開提問。</p>
        ) : (
          <ul className="space-y-sm">
            {recentPosts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/posts/${p.id}`}
                  className="block bg-surface-container-low rounded-lg p-md border border-outline-variant/50 hover:border-primary/40 transition-colors no-underline group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-body-lg text-body-lg text-on-surface group-hover:text-primary transition-colors truncate">
                      {p.title}
                    </span>
                    {p.solved && (
                      <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0">
                        已解決
                      </span>
                    )}
                  </div>
                  <span className="text-secondary text-label-md">
                    {formatDateTime(p.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
