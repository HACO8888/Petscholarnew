import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, posts } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { updateProfile } from "./actions";

const GENDER_OPTIONS = [
  { value: "female", label: "🙋‍♀️ 女生" },
  { value: "male", label: "🙋‍♂️ 男生" },
];

const PET_STYLE_OPTIONS = [
  { value: "classic", emoji: "🤖", label: "經典北科科" },
  { value: "dog", emoji: "🐶", label: "狗狗" },
  { value: "cat", emoji: "🐱", label: "貓咪" },
  { value: "rabbit", emoji: "🐰", label: "兔子" },
  { value: "dragon", emoji: "🐲", label: "小龍" },
];

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

  // 提問紀錄＝該使用者未隱藏的貼文（真實資料）
  const questionRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      bounty: posts.bounty,
      solved: posts.solved,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.hidden, false)))
    .orderBy(desc(posts.createdAt));

  const questionCount = questionRows.length;

  return (
    <section id="sect-profile">
      <div className="mb-lg border-b border-outline-variant/30 pb-3">
        <h1 className="font-semibold text-headline-lg text-on-background">個人檔案與電子雞設定</h1>
        <p className="text-secondary text-body-md">管理您的校園學術身份，並變更電子雞外觀造型。</p>
      </div>

      <form
        action={updateProfile}
        className="max-w-xl bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm mx-auto"
      >
        <div className="space-y-md">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-1">我的暱稱</label>
            <input
              name="displayName"
              defaultValue={me.name ?? ""}
              maxLength={100}
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="請輸入姓名..."
              type="text"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-on-surface mb-1">性別</label>
            <select
              name="gender"
              defaultValue={me.gender ?? "female"}
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 outline-none"
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">變更寵物電子雞角色</label>
            <select
              name="petStyle"
              defaultValue={me.petStyle ?? "classic"}
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 outline-none"
            >
              {PET_STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.emoji} {o.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold py-2.5 rounded-lg mt-md shadow-sm transition-all"
          >
            儲存個人檔案修改
          </button>
        </div>
      </form>

      <div className="max-w-3xl bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm mx-auto mt-lg">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-3">
          <div>
            <h2 className="font-bold text-headline-md text-on-surface flex items-center gap-1">
              <span className="material-symbols-outlined">history_edu</span> 提問紀錄
            </h2>
            <p className="text-xs text-secondary">這裡會顯示你在看板與討論版發佈過的問題。</p>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
            {questionCount} 筆
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-secondary mb-2">
          <span>超過 3 筆時可在下方區塊上下捲動查看全部。</span>
          <span>{questionCount > 3 ? `可捲動查看 ${questionCount} 筆` : `共 ${questionCount} 筆`}</span>
        </div>
        <div className="space-y-sm text-sm max-h-[430px] overflow-y-auto pr-2 scroll-smooth">
          {questionCount === 0 ? (
            <div className="text-xs text-secondary text-center py-6 border border-dashed border-outline-variant/40 rounded-xl">
              目前還沒有提問紀錄。發佈第一個問題後，這裡會自動出現紀錄。
            </div>
          ) : (
            questionRows.map((q) => (
              <a
                key={q.id}
                href={`/posts/${q.id}`}
                className="block p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low dark:bg-surface cursor-pointer hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-bold text-primary text-sm line-clamp-1">{q.title}</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      q.solved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {q.solved ? "已解決" : "未解決"}
                  </span>
                </div>
                <p className="text-xs text-secondary line-clamp-2 mb-2">{q.content}</p>
                <div className="flex flex-wrap gap-1 text-[10px] text-secondary">
                  <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary-container">
                    🪙 {q.bounty} 金幣
                  </span>
                  <span>{formatDateTime(q.createdAt)}</span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
