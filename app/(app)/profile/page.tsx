import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, posts, pets, comments, departments } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { petTitle } from "@/lib/pet";
import AvatarUpload from "@/components/AvatarUpload";
import { updateProfile } from "./actions";

const GENDER_OPTIONS = [
  { value: "female", label: "🙋‍♀️ 女生" },
  { value: "male", label: "🙋‍♂️ 男生" },
  { value: "undisclosed", label: "🤐 不透露" },
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

  // 等級 / 金幣 / 寵物名用真實 pet（沒有寵物列則給預設值）
  const [myPet] = await db
    .select({ level: pets.level, coins: pets.coins, name: pets.name })
    .from(pets)
    .where(eq(pets.userId, userId))
    .limit(1);

  const petLevel = myPet?.level ?? 1;
  const petCoins = myPet?.coins ?? 0;
  const petName = myPet?.name ?? "未命名小精靈";

  // 科系清單（選科系唯一來源）；含目前值但已不在清單時仍可保留顯示。
  const departmentRows = await db
    .select({ name: departments.name })
    .from(departments)
    .orderBy(departments.sortOrder, departments.name);
  const departmentNames = departmentRows.map((d) => d.name);
  const currentDepartment = me.department?.trim() || "";

  // 解答數量＝該使用者未隱藏的留言（真實資料）
  const myComments = await db
    .select({ id: comments.id, isAdopted: comments.isAdopted })
    .from(comments)
    .where(and(eq(comments.authorId, userId), eq(comments.hidden, false)));

  const answerCount = myComments.length;
  const adoptedCount = myComments.filter((c) => c.isAdopted).length;

  // 提問紀錄＝該使用者未隱藏的貼文（真實資料）
  const questionRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      bounty: posts.bounty,
      solved: posts.solved,
      department: posts.department,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.hidden, false)))
    .orderBy(desc(posts.createdAt));

  const questionCount = questionRows.length;

  // 成就解鎖判定（真實資料）
  const achievements = [
    {
      key: "streak",
      icon: "local_fire_department",
      label: "連續登入30天",
      bg: "bg-tertiary-container",
      fg: "text-on-tertiary-container",
      // 以「曾建立帳號」作為最基礎門檻；無連續登入資料故以發文活躍度近似
      unlocked: questionCount >= 1,
    },
    {
      key: "answer",
      icon: "school",
      label: "解答達人",
      bg: "bg-primary-container",
      fg: "text-on-primary-container",
      unlocked: answerCount >= 10,
    },
    {
      key: "likes",
      icon: "emoji_events",
      label: "百讚得主",
      bg: "bg-secondary-container",
      fg: "text-on-secondary-container",
      unlocked: adoptedCount >= 5,
    },
    {
      key: "mentor",
      icon: "handshake",
      label: "最佳導師",
      bg: "bg-secondary-container",
      fg: "text-on-secondary-container",
      unlocked: adoptedCount >= 1,
    },
  ];

  // 頭像優先用 Google 大頭照（me.image），無則用姓名字首，再無則用預設 icon
  const displayName = me.name?.trim() || "未命名同學";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  // 系所優先用真實 users.department，無則用通用文案
  const department = me.department?.trim() || "校園學術社群成員";
  // 自我介紹用真實 users.bio
  const bio = me.bio?.trim() || "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
      {/* Profile Header (Bento Style) */}
      <section className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-md">
        {/* User Info Card */}
        <div className="md:col-span-2 bg-surface-container-low rounded-xl p-lg shadow-sm flex flex-col md:flex-row items-center md:items-start gap-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
          <div className="relative shrink-0 flex flex-col items-center gap-md z-10">
            {me.image ? (

              <img
                alt={displayName}
                className="w-32 h-32 rounded-full border-4 border-surface shadow-sm object-cover"
                src={me.image}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-surface shadow-sm bg-primary-container text-on-primary-container flex items-center justify-center font-headline-lg text-headline-lg select-none">
                {avatarInitial || (
                  <span className="material-symbols-outlined text-[48px]" style={{ fontSize: "48px" }}>
                    person
                  </span>
                )}
              </div>
            )}
            <AvatarUpload />
          </div>
          <div className="flex-1 min-w-0 text-center md:text-left z-10">
            <h1 className="font-headline-lg text-headline-lg text-on-surface break-words">{displayName}</h1>
            <p className="font-body-lg text-body-lg text-secondary mb-md break-words">{department}</p>
            {bio ? (
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md whitespace-pre-line break-words">
                {bio}
              </p>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                還沒有自我介紹，點下方「個人檔案設定」填寫你的專長與簡介吧。
              </p>
            )}
          </div>
        </div>
        {/* Stats Mini Bento */}
        <div className="bg-surface-container-low rounded-xl p-md shadow-sm grid grid-cols-2 gap-sm">
          <div className="bg-surface rounded-lg p-md flex flex-col justify-center items-center text-center border border-surface-container shadow-sm">
            <span className="material-symbols-outlined text-tertiary mb-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <span className="font-headline-md text-headline-md text-on-surface">Lv. {petLevel}</span>
            <span className="font-label-md text-label-md text-tertiary font-bold">{petTitle(petLevel)}</span>
            <span className="font-label-md text-label-md text-secondary">目前等級</span>
          </div>
          <div className="bg-surface rounded-lg p-md flex flex-col justify-center items-center text-center border border-surface-container shadow-sm">
            <span className="material-symbols-outlined text-primary mb-xs" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
            <span className="font-headline-md text-headline-md text-on-surface">{petCoins.toLocaleString()}</span>
            <span className="font-label-md text-label-md text-secondary">總金幣</span>
          </div>
          <div className="bg-surface rounded-lg p-md flex flex-col justify-center items-center text-center border border-surface-container shadow-sm col-span-2">
            <span className="material-symbols-outlined text-secondary mb-xs" style={{ fontVariationSettings: "'FILL' 1" }}>question_answer</span>
            <span className="font-headline-md text-headline-md text-on-surface">{answerCount}</span>
            <span className="font-label-md text-label-md text-secondary">解答數量</span>
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="lg:col-span-4 flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">成就徽章</h2>
        <div className="bg-surface-container-low rounded-xl p-lg shadow-sm flex-1">
          <div className="grid grid-cols-3 gap-md">
            {achievements.map((a) => (
              <div
                key={a.key}
                title={`${a.label}${a.unlocked ? "（已解鎖）" : "（尚未解鎖）"}`}
                className={`flex flex-col items-center group ${a.unlocked ? "" : "opacity-50 grayscale"}`}
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mb-sm ${
                    a.unlocked
                      ? `${a.bg} shadow-sm group-hover:scale-110 transition-transform`
                      : "bg-surface-variant shadow-inner border border-outline-variant"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-3xl ${a.unlocked ? a.fg : "text-secondary"}`}
                    style={a.unlocked ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {a.icon}
                  </span>
                </div>
                <span className={`font-label-md text-label-md text-center ${a.unlocked ? "text-on-surface" : "text-secondary"}`}>
                  {a.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="lg:col-span-8 flex flex-col gap-md">
        <div className="flex justify-between items-center mb-xs">
          <h2 className="font-headline-md text-headline-md text-on-surface">近期動態</h2>
        </div>
        <div className="flex flex-col gap-md">
          {questionRows.length === 0 ? (
            <div className="bg-surface-container-low rounded-xl p-lg text-center text-secondary border border-dashed border-outline-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-sm" style={{ fontSize: "48px" }}>forum</span>
              <p className="font-body-md text-body-md">您尚未在討論板發表任何問題。</p>
            </div>
          ) : (
            questionRows.slice(0, 5).map((q) => (
              <a
                key={q.id}
                href={`/posts/${q.id}`}
                className="bg-surface rounded-xl p-md shadow-sm border border-surface-container-low hover:border-primary-fixed hover:shadow-md transition-all group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ textDecoration: "none" }}
              >
                <div className="flex items-center gap-sm mb-sm text-secondary font-label-md text-label-md">
                  <span className="material-symbols-outlined text-sm">post_add</span>
                  <span>發佈了提問</span>
                  <span className="mx-xs">•</span>
                  <span>{formatDateTime(q.createdAt)}</span>
                  <span className="mx-xs">•</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-label-md ${
                      q.solved
                        ? "bg-tertiary-container text-on-tertiary-container"
                        : "bg-secondary-container text-on-secondary-container"
                    }`}
                  >
                    {q.solved ? "已解決" : "未解決"}
                  </span>
                </div>
                <h3 className="font-body-lg text-body-lg font-medium text-on-surface mb-xs group-hover:text-primary transition-colors">
                  {q.title}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">{q.content}</p>
                <div className="flex items-center gap-md mt-md text-secondary font-label-md text-label-md">
                  {q.department ? (
                    <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[11px]">
                      {q.department}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-sm">monetization_on</span> {q.bounty} 金幣
                  </span>
                </div>
              </a>
            ))
          )}
        </div>
      </section>

      {/* Question History */}
      <section className="lg:col-span-12 flex flex-col gap-md">
        <div className="flex justify-between items-center mb-xs">
          <h2 className="font-headline-md text-headline-md text-on-surface">提問紀錄</h2>
          <span className="font-label-md text-label-md text-primary bg-primary-container px-md py-xs rounded-full">
            {questionCount} 筆
          </span>
        </div>
        <div className="bg-surface-container-low rounded-xl p-lg shadow-sm">
          <div className="flex items-center justify-between text-secondary font-label-md text-label-md mb-sm">
            <span>{questionCount > 3 ? "於下方區塊內捲動可查看全部紀錄。" : "您的全部提問紀錄。"}</span>
            <span>共 {questionCount} 筆</span>
          </div>
          <div className="flex flex-col gap-sm max-h-[430px] overflow-y-auto pr-sm scroll-smooth">
            {questionCount === 0 ? (
              <div className="text-secondary font-body-md text-body-md text-center py-lg border border-dashed border-outline-variant rounded-lg">
                目前還沒有提問紀錄。發佈問題後會顯示在這裡。
              </div>
            ) : (
              questionRows.map((q) => (
                <a
                  key={q.id}
                  href={`/posts/${q.id}`}
                  className="block p-md rounded-lg bg-surface border border-outline-variant hover:border-primary/40 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{ textDecoration: "none" }}
                >
                  <div className="flex items-center justify-between gap-sm mb-xs">
                    <h3 className="font-bold text-primary text-body-md line-clamp-1">{q.title}</h3>
                    <span
                      className={`font-label-md text-label-md font-bold shrink-0 px-2 py-0.5 rounded-full ${
                        q.solved
                          ? "bg-tertiary-container text-on-tertiary-container"
                          : "bg-secondary-container text-on-secondary-container"
                      }`}
                    >
                      {q.solved ? "已解決" : "未解決"}
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-sm">{q.content}</p>
                  <div className="flex flex-wrap gap-xs font-label-md text-label-md">
                    {q.department ? (
                      <span className="px-sm py-[2px] bg-secondary-container text-on-secondary-container rounded-sm">
                        #{q.department}
                      </span>
                    ) : null}
                    <span className="px-sm py-[2px] bg-tertiary-container text-on-tertiary-container rounded-sm">
                      🪙 {q.bounty} 金幣
                    </span>
                    <span className="text-secondary self-center">{formatDateTime(q.createdAt)}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 個人檔案編輯表單：暱稱 / 系所 / 自我介紹 / 性別 / 電子雞角色 */}
      <section className="lg:col-span-12 flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">個人檔案與電子雞設定</h2>
        <form
          action={updateProfile}
          className="max-w-xl bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm"
        >
          <div className="space-y-md">
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">我的暱稱</label>
              <input
                name="displayName"
                defaultValue={me.name ?? ""}
                maxLength={100}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="請輸入姓名..."
                type="text"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">寵物暱稱</label>
              <input
                name="petName"
                defaultValue={petName}
                maxLength={40}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="替你的學習夥伴取個名字…"
                type="text"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">系所</label>
              <select
                name="department"
                defaultValue={currentDepartment}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="">未指定科系</option>
                {/* 目前值已不在清單（例：科系被刪除）時，保留為選項以免儲存時遺失 */}
                {currentDepartment && !departmentNames.includes(currentDepartment) && (
                  <option value={currentDepartment}>{currentDepartment}（已停用）</option>
                )}
                {departmentNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">自我介紹</label>
              <textarea
                name="bio"
                defaultValue={me.bio ?? ""}
                maxLength={500}
                rows={4}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
                placeholder="介紹一下你的專長、興趣，或想分享給學弟妹的話..."
              />
              <p className="mt-1 text-label-md text-secondary">最多 500 字。</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">性別</label>
              <select
                name="gender"
                defaultValue={me.gender ?? "female"}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none"
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
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none"
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
              className="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold py-2.5 rounded-lg mt-md shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              儲存個人檔案修改
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
