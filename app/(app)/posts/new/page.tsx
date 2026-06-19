import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { boards, departments } from "@/db/schema";
import { auth } from "@/auth";
import { createPost } from "@/app/(app)/posts/actions";
import PostImageField from "@/components/PostImageField";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { board: preselect } = await searchParams;
  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);
  const departmentRows = await db
    .select({ name: departments.name })
    .from(departments)
    .orderBy(departments.sortOrder, departments.name);

  const fieldClass =
    "w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <section className="mx-auto min-w-0 max-w-2xl">
      <Link
        href="/boards"
        className="mb-md inline-flex items-center gap-1 rounded-full px-2 py-1 text-body-md font-medium text-secondary no-underline transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_back</span> 返回看板列表
      </Link>

      {/* 標題區 */}
      <div className="mb-lg">
        <h1 className="flex items-center gap-2 text-headline-lg font-semibold text-on-background">
          <span className="material-symbols-outlined text-primary" aria-hidden>edit_square</span>
          發佈新提問
        </h1>
        <p className="mt-xs text-body-md text-on-surface-variant">
          清楚描述你的問題、附上相關資料，設置懸賞金幣能吸引更多學霸來解答。
        </p>
      </div>

      {boardRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-sm dark:bg-surface-container">
          <span className="material-symbols-outlined mb-md text-[56px] text-outline" aria-hidden>forum</span>
          <p className="text-body-md text-on-surface-variant">
            目前尚無可發佈的看板，請稍後再試或聯絡管理員。
          </p>
        </div>
      ) : (
      <form
        action={createPost}
        className="space-y-lg rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm dark:bg-surface-container"
      >
        {/* 區段一：題目 */}
        <div className="space-y-md">
          <h2 className="flex items-center gap-1.5 border-b border-outline-variant/30 pb-sm text-body-md font-bold text-on-surface">
            <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden>quiz</span>
            提問內容
          </h2>

          <label className="block">
            <span className="mb-1 block text-label-md font-medium text-on-surface-variant">看板</span>
            <select
              name="boardId"
              required
              defaultValue={preselect ?? ""}
              className={fieldClass}
            >
              <option value="" disabled>請選擇看板</option>
              {boardRows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.icon ? `${b.icon} ${b.name}` : b.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-label-md text-secondary">選擇最相關的學院看板，方便對的人看到你的問題。</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-label-md font-medium text-on-surface-variant">標題</span>
            <input
              type="text"
              name="title"
              required
              maxLength={200}
              placeholder="用一句話說明你的問題"
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-label-md font-medium text-on-surface-variant">
              內容
            </span>
            <textarea
              name="content"
              required
              rows={8}
              placeholder="詳細描述問題、你已嘗試過的方法，以及卡住的地方。"
              className={`${fieldClass} resize-y leading-relaxed`}
            />
            <span className="mt-1 block text-label-md text-secondary">
              支援 Markdown 與 <code className="rounded bg-surface-container-high px-1 py-0.5">$LaTeX$</code> 數學式，例如 <code className="rounded bg-surface-container-high px-1 py-0.5">$x^2 + y^2$</code>。
            </span>
          </label>

          <PostImageField />
        </div>

        {/* 區段二：分類與懸賞 */}
        <div className="space-y-md">
          <h2 className="flex items-center gap-1.5 border-b border-outline-variant/30 pb-sm text-body-md font-bold text-on-surface">
            <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden>sell</span>
            分類與懸賞
          </h2>

          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-label-md font-medium text-on-surface-variant">科系（選填）</span>
              <select name="department" defaultValue="" className={fieldClass}>
                <option value="">不指定科系</option>
                {departmentRows.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-label-md font-medium text-on-surface-variant">標籤（選填）</span>
              <input
                type="text"
                name="tags"
                placeholder="微積分, 大一必修"
                className={fieldClass}
              />
              <span className="mt-1 block text-label-md text-secondary">以逗號分隔多個標籤。</span>
            </label>
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-label-md font-medium text-on-surface-variant">懸賞金幣（選填）</span>
              <input
                type="number"
                name="bounty"
                min={0}
                max={9999}
                defaultValue={0}
                className={fieldClass}
              />
              <span className="mt-1 block text-label-md text-secondary">解答被採納時支付。</span>
            </label>
          </div>
        </div>

        {/* 送出 */}
        <div className="flex flex-col-reverse items-stretch gap-sm border-t border-outline-variant/30 pt-lg sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/boards"
            className="inline-flex items-center justify-center rounded-full border border-outline-variant px-6 py-2.5 text-label-md font-medium text-on-surface-variant no-underline transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            取消
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-6 py-2.5 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>send</span>
            發佈提問
          </button>
        </div>
      </form>
      )}
    </section>
  );
}
