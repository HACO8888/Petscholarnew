import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { boards, departments } from "@/db/schema";
import { auth } from "@/auth";
import { createPost } from "@/app/(app)/posts/actions";

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

  return (
    <section className="max-w-2xl min-w-0">
      <Link
        href="/boards"
        className="mb-md inline-flex items-center gap-1 text-body-md font-medium text-secondary no-underline transition-colors hover:text-primary"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> 返回看板列表
      </Link>
      <h1 className="mb-lg text-headline-lg font-semibold text-on-background">發佈新提問</h1>

      {boardRows.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-body-md text-on-surface-variant dark:bg-surface-container">
          目前尚無可發佈的看板，請稍後再試或聯絡管理員。
        </div>
      ) : (
      <form
        action={createPost}
        className="space-y-lg rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 dark:bg-surface-container"
      >
        <label className="block">
          <span className="mb-1 block text-label-md font-medium text-on-surface-variant">看板</span>
          <select
            name="boardId"
            required
            defaultValue={preselect ?? ""}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>請選擇看板</option>
            {boardRows.map((b) => (
              <option key={b.id} value={b.id}>
                {b.icon ? `${b.icon} ${b.name}` : b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-label-md font-medium text-on-surface-variant">標題</span>
          <input
            type="text"
            name="title"
            required
            maxLength={200}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-label-md font-medium text-on-surface-variant">
            內容（支援 $LaTeX$ 數學式）
          </span>
          <textarea
            name="content"
            required
            rows={8}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-label-md font-medium text-on-surface-variant">科系（選填）</span>
            <select
              name="department"
              defaultValue=""
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">不指定科系</option>
              {departmentRows.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-label-md font-medium text-on-surface-variant">標籤（逗號分隔）</span>
            <input
              type="text"
              name="tags"
              placeholder="微積分, 大一必修"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-label-md font-medium text-on-surface-variant">懸賞金幣（選填）</span>
            <input
              type="number"
              name="bounty"
              min={0}
              max={9999}
              defaultValue={0}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-primary px-6 py-2.5 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:w-auto"
        >
          發佈提問
        </button>
      </form>
      )}
    </section>
  );
}
