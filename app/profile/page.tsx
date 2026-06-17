import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, posts, comments } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { formatDateTime } from "@/lib/format";
import { updateProfile } from "./actions";

const GENDER_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "undisclosed", label: "不透露" },
];

const PET_STYLE_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "classic", label: "經典北科科" },
  { value: "cat", label: "貓咪" },
  { value: "dog", label: "狗狗" },
  { value: "rabbit", label: "兔子" },
  { value: "dragon", label: "小龍" },
];

const ROLE_LABEL: Record<string, string> = {
  student: "一般學生",
  ta: "課程助教",
  professor: "課程教授",
  admin: "系統管理員",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!me) {
    redirect("/login");
  }

  // 寵物數值（等級 / 金幣）——真實資料
  const pet = await getOrCreatePet(userId);

  // 解答數量＝該使用者未隱藏的留言數（真實資料）
  const [{ answerCount }] = await db
    .select({ answerCount: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.authorId, userId), eq(comments.hidden, false)));

  // 成就判定所需的計數（與 leaderboard 一致）
  const [{ pc }] = await db
    .select({ pc: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.hidden, false)));
  const [{ adopted }] = await db
    .select({ adopted: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.authorId, userId), eq(comments.isAdopted, true)));

  const achievements = [
    {
      name: "好學新手",
      icon: "school",
      desc: "發佈第一篇提問或回覆",
      earned: pc > 0 || answerCount > 0,
    },
    { name: "解題達人", icon: "local_fire_department", desc: "有解答被採納", earned: adopted > 0 },
    { name: "等級達人", icon: "emoji_events", desc: "寵物達到 5 級", earned: pet.level >= 5 },
    { name: "金幣富翁", icon: "handshake", desc: "累積 200 金幣", earned: pet.coins >= 200 },
  ];

  // 提問紀錄＝該使用者未隱藏的貼文（真實資料）
  const questionRows = await db
    .select({ id: posts.id, title: posts.title, createdAt: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.hidden, false)))
    .orderBy(desc(posts.createdAt));

  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-12">
      {/* Profile Header (Bento Style) */}
      <section className="grid grid-cols-1 gap-md md:grid-cols-3 lg:col-span-12">
        {/* User Info Card */}
        <div className="relative flex flex-col items-center gap-lg overflow-hidden rounded-xl bg-surface-container-low p-lg shadow-sm md:col-span-2 md:flex-row md:items-start">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-primary-container opacity-20 blur-3xl"></div>
          <div className="relative">
            {me.image ? (
              <img
                alt={me.name ?? "Profile Picture"}
                className="h-32 w-32 rounded-full border-4 border-surface object-cover shadow-sm"
                src={me.image}
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-surface bg-primary-container shadow-sm">
                <span className="material-symbols-outlined text-5xl text-on-primary-container">
                  person
                </span>
              </div>
            )}
          </div>
          <div className="z-10 flex-1 text-center md:text-left">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">
              {me.name ?? "未命名"}
            </h1>
            <p className="mb-md font-body-lg text-body-lg text-secondary">{me.email}</p>
            <span className="inline-block rounded-full bg-primary-container px-3 py-0.5 font-label-md text-label-md font-medium text-on-primary-container">
              {ROLE_LABEL[me.role] ?? me.role}
            </span>
          </div>
        </div>
        {/* Stats Mini Bento */}
        <div className="grid grid-cols-2 gap-sm rounded-xl bg-surface-container-low p-md shadow-sm">
          <div className="flex flex-col items-center justify-center rounded-lg border border-surface-container bg-surface p-md text-center shadow-sm">
            <span
              className="material-symbols-outlined mb-xs text-tertiary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">
              Lv. {pet.level}
            </span>
            <span className="font-label-md text-label-md text-secondary">目前等級</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border border-surface-container bg-surface p-md text-center shadow-sm">
            <span
              className="material-symbols-outlined mb-xs text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monetization_on
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">
              {pet.coins.toLocaleString()}
            </span>
            <span className="font-label-md text-label-md text-secondary">總金幣</span>
          </div>
          <div className="col-span-2 flex flex-col items-center justify-center rounded-lg border border-surface-container bg-surface p-md text-center shadow-sm">
            <span
              className="material-symbols-outlined mb-xs text-secondary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              question_answer
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">
              {answerCount.toLocaleString()}
            </span>
            <span className="font-label-md text-label-md text-secondary">解答數量</span>
          </div>
        </div>
      </section>

      {/* Edit Profile */}
      <section className="flex flex-col gap-md lg:col-span-4">
        <h2 className="mb-xs font-headline-md text-headline-md text-on-surface">編輯個人資料</h2>
        <form
          action={updateProfile}
          className="flex flex-1 flex-col gap-lg rounded-xl bg-surface-container-low p-lg shadow-sm"
        >
          <label className="block">
            <span className="mb-1 block font-label-md text-label-md font-medium text-on-surface-variant">
              顯示名稱
            </span>
            <input
              type="text"
              name="displayName"
              defaultValue={me.name ?? ""}
              maxLength={100}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-label-md text-label-md font-medium text-on-surface-variant">
              性別
            </span>
            <select
              name="gender"
              defaultValue={me.gender ?? ""}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block font-label-md text-label-md font-medium text-on-surface-variant">
              電子雞造型
            </span>
            <select
              name="petStyle"
              defaultValue={me.petStyle ?? ""}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
            >
              {PET_STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="mt-auto flex items-center justify-center gap-1 self-start rounded-full bg-primary px-5 py-2 font-label-md text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            儲存
          </button>
        </form>
      </section>

      {/* Achievements */}
      <section className="flex flex-col gap-md lg:col-span-8">
        <h2 className="mb-xs font-headline-md text-headline-md text-on-surface">成就徽章</h2>
        <div className="flex-1 rounded-xl bg-surface-container-low p-lg shadow-sm">
          <div className="grid grid-cols-3 gap-md">
            {achievements.map((a) =>
              a.earned ? (
                <div key={a.name} className="group flex cursor-default flex-col items-center">
                  <div className="mb-sm flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-container shadow-sm transition-transform group-hover:scale-110">
                    <span
                      className="material-symbols-outlined text-3xl text-on-tertiary-container"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {a.icon}
                    </span>
                  </div>
                  <span className="text-center font-label-md text-label-md text-on-surface">
                    {a.name}
                  </span>
                </div>
              ) : (
                <div
                  key={a.name}
                  className="group flex cursor-default flex-col items-center opacity-50 grayscale"
                >
                  <div className="mb-sm flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-variant shadow-inner">
                    <span className="material-symbols-outlined text-3xl text-secondary">
                      {a.icon}
                    </span>
                  </div>
                  <span className="text-center font-label-md text-label-md text-secondary">
                    {a.name}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Question History */}
      <section className="flex flex-col gap-md lg:col-span-12">
        <div className="mb-xs flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">提問紀錄</h2>
          <span className="rounded-full bg-primary-container px-md py-xs font-label-md text-label-md text-primary">
            {questionRows.length} 筆
          </span>
        </div>
        <div className="rounded-xl bg-surface-container-low p-lg shadow-sm">
          <div className="mb-sm flex items-center justify-between font-label-md text-label-md text-secondary">
            <span>超過 3 筆時可在下方區塊上下捲動查看全部。</span>
            <span>
              {questionRows.length > 3
                ? `可捲動查看 ${questionRows.length} 筆`
                : `共 ${questionRows.length} 筆`}
            </span>
          </div>
          <div className="flex max-h-[430px] flex-col gap-sm overflow-y-auto pr-sm scroll-smooth">
            {questionRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant py-lg text-center font-body-md text-body-md text-secondary">
                目前還沒有提問紀錄。發佈問題後會顯示在這裡。
              </div>
            ) : (
              questionRows.map((q) => (
                <Link
                  key={q.id}
                  href={`/posts/${q.id}`}
                  className="block rounded-lg border border-outline-variant bg-surface p-md transition-all hover:shadow-sm"
                >
                  <h3 className="mb-xs line-clamp-1 font-body-md text-body-md font-bold text-primary">
                    {q.title}
                  </h3>
                  <span className="font-label-md text-label-md text-secondary">
                    {formatDateTime(q.createdAt)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
