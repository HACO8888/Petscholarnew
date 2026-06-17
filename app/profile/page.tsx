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
    <section className="max-w-2xl">
      <div className="mb-lg">
        <h1 className="text-headline-lg font-semibold text-on-background">個人檔案</h1>
        <p className="mt-1 text-body-md text-secondary">設定顯示名稱、性別與電子雞造型。</p>
      </div>

      <div className="mb-lg flex items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 dark:bg-surface-container">
        <img
          src={me.image ?? ""}
          alt={me.name ?? "使用者"}
          className="h-16 w-16 rounded-full bg-surface-variant object-cover"
        />
        <div>
          <p className="text-body-lg font-semibold text-on-background">{me.name ?? "未命名"}</p>
          <p className="text-body-md text-secondary">{me.email}</p>
          <span className="mt-1 inline-block rounded-full bg-primary-container px-3 py-0.5 text-label-md font-medium text-on-primary-container">
            {ROLE_LABEL[me.role] ?? me.role}
          </span>
        </div>
      </div>

      <form
        action={updateProfile}
        className="space-y-lg rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 dark:bg-surface-container"
      >
        <label className="block">
          <span className="mb-1 block text-label-md font-medium text-on-surface-variant">顯示名稱</span>
          <input
            type="text"
            name="displayName"
            defaultValue={me.name ?? ""}
            maxLength={100}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-label-md font-medium text-on-surface-variant">性別</span>
          <select
            name="gender"
            defaultValue={me.gender ?? ""}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-label-md font-medium text-on-surface-variant">電子雞造型</span>
          <select
            name="petStyle"
            defaultValue={me.petStyle ?? ""}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
          >
            {PET_STYLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-full bg-primary px-5 py-2 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint"
        >
          儲存
        </button>
      </form>
    </section>
  );
}
