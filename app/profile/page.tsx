import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
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

  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!me) {
    redirect("/login");
  }

  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-12">
      {/* Profile Header (Bento Style) */}
      <section className="grid grid-cols-1 gap-md md:grid-cols-3 lg:col-span-12">
        {/* User Info Card */}
        <div className="relative flex flex-col items-center gap-lg overflow-hidden rounded-xl bg-surface-container-low p-lg shadow-sm md:col-span-2 md:flex-row md:items-start">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-primary-container opacity-20 blur-3xl"></div>
          <div className="relative">
            <img
              alt={me.name ?? "Profile Picture"}
              className="h-32 w-32 rounded-full border-4 border-surface object-cover shadow-sm"
              src={me.image ?? ""}
            />
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
            <span className="font-headline-md text-headline-md text-on-surface">Lv. 15</span>
            <span className="font-label-md text-label-md text-secondary">目前等級</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border border-surface-container bg-surface p-md text-center shadow-sm">
            <span
              className="material-symbols-outlined mb-xs text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monetization_on
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">8,420</span>
            <span className="font-label-md text-label-md text-secondary">總金幣</span>
          </div>
          <div className="col-span-2 flex flex-col items-center justify-center rounded-lg border border-surface-container bg-surface p-md text-center shadow-sm">
            <span
              className="material-symbols-outlined mb-xs text-secondary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              question_answer
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">0</span>
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
            <div className="group flex cursor-pointer flex-col items-center">
              <div className="mb-sm flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-container shadow-sm transition-transform group-hover:scale-110">
                <span
                  className="material-symbols-outlined text-3xl text-on-tertiary-container"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  local_fire_department
                </span>
              </div>
              <span className="text-center font-label-md text-label-md text-on-surface">
                連續登入30天
              </span>
            </div>
            <div className="group flex cursor-pointer flex-col items-center">
              <div className="mb-sm flex h-16 w-16 items-center justify-center rounded-full bg-primary-container shadow-sm transition-transform group-hover:scale-110">
                <span
                  className="material-symbols-outlined text-3xl text-on-primary-container"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  school
                </span>
              </div>
              <span className="text-center font-label-md text-label-md text-on-surface">解答達人</span>
            </div>
            <div className="group flex cursor-pointer flex-col items-center opacity-50 grayscale">
              <div className="mb-sm flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-variant shadow-inner">
                <span className="material-symbols-outlined text-3xl text-secondary">emoji_events</span>
              </div>
              <span className="text-center font-label-md text-label-md text-secondary">百讚得主</span>
            </div>
            <div className="group flex cursor-pointer flex-col items-center opacity-50 grayscale">
              <div className="mb-sm flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-variant shadow-inner">
                <span className="material-symbols-outlined text-3xl text-secondary">handshake</span>
              </div>
              <span className="text-center font-label-md text-label-md text-secondary">最佳導師</span>
            </div>
          </div>
        </div>
      </section>

      {/* Question History */}
      <section className="flex flex-col gap-md lg:col-span-12">
        <div className="mb-xs flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">提問紀錄</h2>
          <span className="rounded-full bg-primary-container px-md py-xs font-label-md text-label-md text-primary">
            0 筆
          </span>
        </div>
        <div className="rounded-xl bg-surface-container-low p-lg shadow-sm">
          <div className="mb-sm flex items-center justify-between font-label-md text-label-md text-secondary">
            <span>超過 3 筆時可在下方區塊上下捲動查看全部。</span>
            <span>顯示全部</span>
          </div>
          <div className="flex max-h-[430px] flex-col gap-sm overflow-y-auto pr-sm scroll-smooth">
            <div className="py-lg text-center font-body-md text-body-md text-secondary">
              目前還沒有提問紀錄。發佈問題後會顯示在這裡。
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
