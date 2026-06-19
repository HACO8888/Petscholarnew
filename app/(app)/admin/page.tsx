import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  posts,
  boards,
  comments,
  reports,
  studyRooms,
  studyRoomMembers,
  shopItems,
  users,
  chatMessages,
  voiceRecordings,
  departments,
} from "@/db/schema";
import AccessDenied from "@/components/AccessDenied";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { formatDateTime } from "@/lib/format";
import { presignedGetUrl } from "@/lib/s3";
import { ROLE_OPTIONS, type Role } from "@/components/nav-config";
import {
  blockReport,
  rejectReport,
  deletePost,
  restorePost,
  purgePost,
  hideComment,
  restoreComment,
  purgeComment,
  updateBoard,
  deleteBoard,
  dissolveRoom,
  updateShopItem,
  toggleShopItem,
  deleteShopItem,
  updateUser,
  bootstrapAdmin,
  hideChatMessage,
  unhideChatMessage,
  hideRecording,
  unhideRecording,
  deleteRecording,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "./actions";

/** 後台子面板：涵蓋所有可管理實體。 */
const PANELS = [
  { id: "overview", label: "總覽", icon: "dashboard" },
  { id: "boards", label: "看板", icon: "dashboard_customize" },
  { id: "departments", label: "科系", icon: "school" },
  { id: "posts", label: "貼文", icon: "forum" },
  { id: "comments", label: "留言", icon: "chat" },
  { id: "rooms", label: "自習室", icon: "meeting_room" },
  { id: "chat", label: "聊天訊息", icon: "chat_bubble" },
  { id: "recordings", label: "語音錄音", icon: "graphic_eq" },
  { id: "shop", label: "商城商品", icon: "storefront" },
  { id: "users", label: "使用者", icon: "group" },
  { id: "reports", label: "檢舉案件", icon: "report" },
] as const;
type PanelId = (typeof PANELS)[number]["id"];

/** 貼文狀態篩選。 */
const POST_FILTERS = [
  { id: "all", label: "全部" },
  { id: "unsolved", label: "未解決" },
  { id: "solved", label: "已解決" },
  { id: "hidden", label: "已隱藏" },
] as const;
type PostFilter = (typeof POST_FILTERS)[number]["id"];

const CARD = "bg-surface-container-lowest dark:bg-surface-container-high rounded-xl border border-outline-variant/30 shadow-sm";
const FIELD = "bg-surface border border-outline-variant text-on-surface rounded-lg text-xs py-1.5 px-2 focus:ring-primary focus:border-primary";
const BTN_PRIMARY = "bg-primary hover:bg-surface-tint text-on-primary font-bold text-[11px] px-3 py-1.5 rounded-lg";
const BTN_NEUTRAL = "bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[11px] px-3 py-1.5 rounded-lg border border-outline-variant/30";
const BTN_DANGER = "bg-error hover:opacity-90 text-on-error font-bold text-[11px] px-3 py-1.5 rounded-lg";

/** 使用者編輯：性別／電子雞造型選項（值與 profile/actions.ts 白名單一致）。 */
const GENDER_OPTIONS = [
  { value: "female", label: "🙋‍♀️ 女生" },
  { value: "male", label: "🙋‍♂️ 男生" },
  { value: "undisclosed", label: "🤐 未指定" },
] as const;
const PET_STYLE_OPTIONS = [
  { value: "classic", label: "🤖 經典北科科" },
  { value: "dog", label: "🐶 狗狗" },
  { value: "cat", label: "🐱 貓咪" },
  { value: "rabbit", label: "🐰 兔子" },
  { value: "dragon", label: "🐲 小龍" },
] as const;

/** 保留目前 searchParams、覆寫部分鍵的小工具。 */
function buildHref(
  base: Record<string, string | undefined>,
  override: Record<string, string | undefined>,
) {
  const merged = { ...base, ...override };
  const qs = Object.entries(merged)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  return qs ? `/admin?${qs}` : "/admin";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string; board?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;

  // 非 admin：若符合 bootstrap 條件，顯示「成為管理員」的安全入口；否則拒絕存取。
  if (session.user.role !== "admin") {
    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const canBootstrap =
      !!bootstrapEmail && session.user.email?.toLowerCase() === bootstrapEmail;
    if (!canBootstrap) return <AccessDenied need="系統管理員" />;
    return <BootstrapPrompt email={session.user.email ?? ""} />;
  }

  const panel: PanelId = (PANELS.some((p) => p.id === sp.panel)
    ? sp.panel
    : "overview") as PanelId;
  const boardFilter = sp.board;
  const postFilter: PostFilter = (POST_FILTERS.some((f) => f.id === sp.q)
    ? sp.q
    : "all") as PostFilter;

  const tabBase = { board: boardFilter, q: postFilter };

  return (
    <section className="tab-section active" id="sect-admin">
      <div className="mb-lg border-b border-outline-variant/30 pb-3 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-transparent p-md rounded-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-md">
          <div>
            <h1 className="font-semibold text-headline-lg text-red-600 dark:text-red-400">
              🛡️ 系統管理員主控台
            </h1>
            <p className="text-secondary text-body-md">
              管理全站所有可管理資料：看板、貼文、留言、自習室、商城商品、使用者角色與檢舉案件。所有操作皆在 server 端嚴格驗權。
            </p>
          </div>
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-3 py-1 rounded-full text-xs font-bold w-fit">
            <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            Admin Only
          </span>
        </div>
      </div>

      {/* ====== 子面板分頁 ====== */}
      <div className={`${CARD} p-sm overflow-x-auto mb-lg`}>
        <div className="flex gap-sm min-w-max">
          {PANELS.map((p) => (
            <Link
              key={p.id}
              href={buildHref({}, { panel: p.id })}
              className={`flex items-center gap-1 px-md py-sm rounded-lg border text-xs font-bold transition-all no-underline ${
                panel === p.id
                  ? "bg-red-600 text-white border-red-600 shadow"
                  : "bg-surface text-secondary border-outline-variant hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{p.icon}</span>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-lg">
        {panel === "overview" && <OverviewPanel />}
        {panel === "boards" && <BoardsPanel />}
        {panel === "departments" && <DepartmentsPanel />}
        {panel === "posts" && (
          <PostsPanel
            boardFilter={boardFilter}
            postFilter={postFilter}
            tabBase={tabBase}
          />
        )}
        {panel === "comments" && <CommentsPanel />}
        {panel === "rooms" && <RoomsPanel />}
        {panel === "chat" && <ChatPanel />}
        {panel === "recordings" && <RecordingsPanel />}
        {panel === "shop" && <ShopPanel />}
        {panel === "users" && <UsersPanel currentUserId={session.user.id} />}
        {panel === "reports" && <ReportsPanel />}
      </div>
    </section>
  );
}

// ============================================================
// Bootstrap：非 admin 但符合 ADMIN_BOOTSTRAP_EMAIL 時的入口
// ============================================================

function BootstrapPrompt({ email }: { email: string }) {
  return (
    <section className="flex flex-col items-center justify-center py-24 text-center">
      <span className="material-symbols-outlined text-[48px] text-primary">
        verified_user
      </span>
      <h1 className="mt-2 text-headline-md font-semibold text-on-background">
        初始化系統管理員
      </h1>
      <p className="mt-2 max-w-md text-body-md text-secondary">
        系統偵測到你的帳號（<strong className="text-on-surface">{email}</strong>）符合伺服器設定的
        <code className="mx-1 rounded bg-surface-container px-1">ADMIN_BOOTSTRAP_EMAIL</code>
        ，可在此把自己升級為第一位系統管理員。升級後建議移除該環境變數。
      </p>
      <form action={bootstrapAdmin} className="mt-lg">
        <button
          type="submit"
          className="rounded-full bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary no-underline transition-all hover:bg-surface-tint"
        >
          成為系統管理員
        </button>
      </form>
      <p className="mt-md text-xs text-secondary">
        升級後可能需重新整理或重新登入才會套用新角色。
      </p>
    </section>
  );
}

// ============================================================
// 總覽
// ============================================================

async function OverviewPanel() {
  const [[postStats], [commentStats], [roomCount], [userCount], [itemCount], [boardCount], [pendingReports]] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          solved: sql<number>`count(*) filter (where ${posts.solved})::int`,
          hidden: sql<number>`count(*) filter (where ${posts.hidden})::int`,
        })
        .from(posts),
      db
        .select({
          total: sql<number>`count(*)::int`,
          hidden: sql<number>`count(*) filter (where ${comments.hidden})::int`,
        })
        .from(comments),
      db.select({ c: sql<number>`count(*)::int` }).from(studyRooms),
      db.select({ c: sql<number>`count(*)::int` }).from(users),
      db.select({ c: sql<number>`count(*)::int` }).from(shopItems),
      db.select({ c: sql<number>`count(*)::int` }).from(boards),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(reports)
        .where(eq(reports.status, "pending")),
    ]);

  const stats: { label: string; value: number; hint: string; accent: string }[] = [
    { label: "看板", value: boardCount?.c ?? 0, hint: "學院/主題分類", accent: "text-primary" },
    { label: "貼文總數", value: postStats?.total ?? 0, hint: `${postStats?.hidden ?? 0} 篇已隱藏`, accent: "text-primary" },
    { label: "已解決貼文", value: postStats?.solved ?? 0, hint: "已標記解答", accent: "text-green-600 dark:text-green-400" },
    { label: "留言總數", value: commentStats?.total ?? 0, hint: `${commentStats?.hidden ?? 0} 則已隱藏`, accent: "text-primary" },
    { label: "自習室", value: roomCount?.c ?? 0, hint: "進行中房間", accent: "text-primary" },
    { label: "商城商品", value: itemCount?.c ?? 0, hint: "可購買項目", accent: "text-primary" },
    { label: "使用者", value: userCount?.c ?? 0, hint: "已註冊帳號", accent: "text-primary" },
    { label: "待處理檢舉", value: pendingReports?.c ?? 0, hint: "需審查", accent: "text-red-600 dark:text-red-400" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-md">
      {stats.map((s) => (
        <div key={s.label} className={`${CARD} p-md`}>
          <p className="text-xs text-secondary mb-1">{s.label}</p>
          <h3 className={`font-bold text-3xl ${s.accent}`}>{s.value}</h3>
          <p className="text-[10px] text-secondary mt-1">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 看板
// ============================================================

async function BoardsPanel() {
  // 每個看板的貼文數，提供刪除前的影響評估。
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      icon: boards.icon,
      description: boards.description,
      sortOrder: boards.sortOrder,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(boards)
    .leftJoin(posts, eq(posts.boardId, boards.id))
    .groupBy(boards.id)
    .orderBy(boards.sortOrder);

  return (
    <PanelShell title="看板管理" icon="dashboard_customize" count={`${rows.length} 個看板`}>
      {rows.length === 0 ? (
        <EmptyState text="尚無看板。" />
      ) : (
        <div className="space-y-md">
          {rows.map((b) => (
            <div key={b.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{b.icon}</span>
                <span className="font-bold text-sm text-on-surface">{b.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  {b.postCount} 篇貼文
                </span>
                <code className="text-[10px] text-secondary">{b.id}</code>
              </div>
              <form action={updateBoard} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end">
                <input type="hidden" name="boardId" value={b.id} />
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-[10px] text-secondary">
                    名稱
                    <input name="name" defaultValue={b.name} className={`${FIELD} w-full mt-0.5`} required />
                  </label>
                  <label className="text-[10px] text-secondary">
                    描述
                    <input name="description" defaultValue={b.description ?? ""} className={`${FIELD} w-full mt-0.5`} />
                  </label>
                </div>
                <label className="text-[10px] text-secondary">
                  排序
                  <input type="number" name="sortOrder" defaultValue={b.sortOrder} className={`${FIELD} w-24 mt-0.5`} />
                </label>
                <button type="submit" className={BTN_PRIMARY}>儲存</button>
              </form>
              <div className="flex justify-end mt-2">
                <form action={deleteBoard}>
                  <input type="hidden" name="boardId" value={b.id} />
                  <ConfirmSubmit
                    message={`確定刪除看板「${b.name}」？其下 ${b.postCount} 篇貼文與所有留言將一併永久刪除，無法復原。`}
                    className={BTN_DANGER}
                  >
                    刪除看板
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ============================================================
// 科系
// ============================================================

async function DepartmentsPanel() {
  // 學院選項取自看板清單（board.id 即學院代碼），讓科系可掛在既有學院下。
  const collegeRows = await db
    .select({ id: boards.id, name: boards.name, icon: boards.icon })
    .from(boards)
    .orderBy(boards.sortOrder);

  const rows = await db
    .select()
    .from(departments)
    .orderBy(departments.sortOrder, departments.name);

  const collegeName = (id: string | null) =>
    collegeRows.find((c) => c.id === id)?.name ?? null;

  const nextOrder =
    rows.reduce((max, d) => Math.max(max, d.sortOrder), -1) + 1;

  const collegeOptions = (
    <>
      <option value="">（不指定學院）</option>
      {collegeRows.map((c) => (
        <option key={c.id} value={c.id}>
          {c.icon ? `${c.icon} ${c.name}` : c.name}（{c.id}）
        </option>
      ))}
    </>
  );

  return (
    <PanelShell title="科系管理" icon="school" count={`${rows.length} 個科系`}>
      <p className="text-xs text-secondary mb-md">
        此清單為「選科系」唯一來源：個人檔案、發問頁等所有選科系處只能從這裡選。代碼（id）作為主鍵不可事後變更，新增時留空會由系名自動產生英數 slug。
      </p>

      {/* 新增科系 */}
      <form
        action={createDepartment}
        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-end p-md rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low dark:bg-surface mb-lg"
      >
        <label className="text-[10px] text-secondary">
          系名
          <input name="name" className={`${FIELD} w-full mt-0.5`} placeholder="例：資訊工程系" required />
        </label>
        <label className="text-[10px] text-secondary">
          代碼（選填）
          <input name="id" className={`${FIELD} w-full mt-0.5`} placeholder="留空自動產生" />
        </label>
        <label className="text-[10px] text-secondary">
          所屬學院
          <select name="college" className={`${FIELD} w-full mt-0.5`} defaultValue="">
            {collegeOptions}
          </select>
        </label>
        <label className="text-[10px] text-secondary">
          排序
          <input type="number" name="sortOrder" defaultValue={nextOrder} className={`${FIELD} w-20 mt-0.5`} />
        </label>
        <button type="submit" className={BTN_PRIMARY}>新增科系</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState text="尚無科系。請先新增，或執行 npm run seed 灌入北科大科系。" />
      ) : (
        <div className="space-y-md">
          {rows.map((d) => (
            <div key={d.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-bold text-sm text-on-surface">{d.name}</span>
                {collegeName(d.college) && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {collegeName(d.college)}
                  </span>
                )}
                <code className="text-[10px] text-secondary">{d.id}</code>
              </div>
              <form action={updateDepartment} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                <input type="hidden" name="departmentId" value={d.id} />
                <label className="text-[10px] text-secondary">
                  系名
                  <input name="name" defaultValue={d.name} className={`${FIELD} w-full mt-0.5`} required />
                </label>
                <label className="text-[10px] text-secondary">
                  所屬學院
                  <select key={d.college ?? "none"} name="college" defaultValue={d.college ?? ""} className={`${FIELD} w-full mt-0.5`}>
                    {collegeOptions}
                  </select>
                </label>
                <label className="text-[10px] text-secondary">
                  排序
                  <input type="number" name="sortOrder" defaultValue={d.sortOrder} className={`${FIELD} w-20 mt-0.5`} />
                </label>
                <button type="submit" className={BTN_PRIMARY}>儲存</button>
              </form>
              <div className="flex justify-end mt-2">
                <form action={deleteDepartment}>
                  <input type="hidden" name="departmentId" value={d.id} />
                  <ConfirmSubmit
                    message={`確定刪除科系「${d.name}」？此後選單將不再提供此項；既有使用者/貼文已填寫的科系文字不受影響。`}
                    className={BTN_DANGER}
                  >
                    刪除
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ============================================================
// 貼文
// ============================================================

async function PostsPanel({
  boardFilter,
  postFilter,
  tabBase,
}: {
  boardFilter?: string;
  postFilter: PostFilter;
  tabBase: Record<string, string | undefined>;
}) {
  const boardRows = await db.select().from(boards).orderBy(boards.sortOrder);

  const whereClauses = [
    boardFilter ? eq(posts.boardId, boardFilter) : undefined,
    postFilter === "solved" ? eq(posts.solved, true) : undefined,
    postFilter === "unsolved" ? eq(posts.solved, false) : undefined,
    postFilter === "hidden" ? eq(posts.hidden, true) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      authorName: posts.authorName,
      department: posts.department,
      boardName: boards.name,
      bounty: posts.bounty,
      solved: posts.solved,
      hidden: posts.hidden,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(whereClauses.length ? and(...whereClauses) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(200);

  return (
    <PanelShell title="貼文管理" icon="forum" count={`${rows.length} 筆`}>
      {/* 狀態篩選 */}
      <div className="flex flex-wrap gap-2 mb-md">
        {POST_FILTERS.map((f) => (
          <Link
            key={f.id}
            href={buildHref({ ...tabBase, panel: "posts" }, { q: f.id })}
            className={`text-label-md font-medium px-3 py-1 rounded-full no-underline ${
              postFilter === f.id
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {/* 看板篩選 */}
      <div className="flex flex-wrap gap-2 mb-md border-b border-outline-variant/30 pb-3">
        <Link
          href={buildHref({ ...tabBase, panel: "posts" }, { board: undefined })}
          className={`text-label-md font-medium px-3 py-1 rounded-full no-underline ${
            !boardFilter
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          全部看板
        </Link>
        {boardRows.map((b) => (
          <Link
            key={b.id}
            href={buildHref({ ...tabBase, panel: "posts" }, { board: b.id })}
            className={`text-label-md font-medium px-3 py-1 rounded-full no-underline ${
              boardFilter === b.id
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {b.icon} {b.name}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState text="沒有符合條件的貼文。" />
      ) : (
        <div className="space-y-md max-h-[640px] overflow-y-auto pr-1 hide-scrollbar">
          {rows.map((p) => (
            <div key={p.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface space-y-2">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">{p.boardName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      p.solved
                        ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300"
                    }`}>
                      {p.solved ? "已解決" : "未解決"}
                    </span>
                    {p.hidden && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                        已隱藏
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-on-surface line-clamp-1">{p.title}</h4>
                  <p className="text-xs text-secondary line-clamp-2 mt-1">{p.content}</p>
                </div>
                <div className="flex md:flex-col gap-1.5 shrink-0">
                  <Link href={`/posts/${p.id}`} className={`${BTN_NEUTRAL} no-underline text-center`}>查看</Link>
                  {p.hidden ? (
                    <form action={restorePost}>
                      <input type="hidden" name="postId" value={p.id} />
                      <button type="submit" className={`${BTN_NEUTRAL} w-full`}>取消隱藏</button>
                    </form>
                  ) : (
                    <form action={deletePost}>
                      <input type="hidden" name="postId" value={p.id} />
                      <button type="submit" className={`${BTN_NEUTRAL} w-full`}>隱藏</button>
                    </form>
                  )}
                  <form action={purgePost}>
                    <input type="hidden" name="postId" value={p.id} />
                    <ConfirmSubmit
                      message={`永久刪除貼文「${p.title}」及其所有留言？此操作無法復原。`}
                      className={`${BTN_DANGER} w-full`}
                    >
                      永久刪除
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] text-secondary">
                <span>作者：<strong>{p.authorName}</strong></span>
                <span>•</span>
                <span>{p.department ?? "未指定科系"}</span>
                <span>•</span>
                <span>🪙 {p.bounty} 金幣</span>
                <span>•</span>
                <span>{formatDateTime(p.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ============================================================
// 留言
// ============================================================

async function CommentsPanel() {
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      authorName: comments.authorName,
      isAdopted: comments.isAdopted,
      hidden: comments.hidden,
      createdAt: comments.createdAt,
      postId: comments.postId,
      postTitle: posts.title,
    })
    .from(comments)
    .leftJoin(posts, eq(comments.postId, posts.id))
    .orderBy(desc(comments.createdAt))
    .limit(200);

  return (
    <PanelShell title="留言管理" icon="chat" count={`${rows.length} 筆（最近 200）`}>
      {rows.length === 0 ? (
        <EmptyState text="尚無留言。" />
      ) : (
        <div className="space-y-md max-h-[640px] overflow-y-auto pr-1 hide-scrollbar">
          {rows.map((c) => (
            <div key={c.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface space-y-2">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {c.isAdopted && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 font-bold">
                        已採納
                      </span>
                    )}
                    {c.hidden && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                        已隱藏
                      </span>
                    )}
                    <span className="text-[10px] text-secondary">
                      於 <strong className="text-on-surface">{c.postTitle ?? "（貼文已刪除）"}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-on-surface line-clamp-3 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
                <div className="flex md:flex-col gap-1.5 shrink-0">
                  {c.postId && (
                    <Link href={`/posts/${c.postId}`} className={`${BTN_NEUTRAL} no-underline text-center`}>查看</Link>
                  )}
                  {c.hidden ? (
                    <form action={restoreComment}>
                      <input type="hidden" name="commentId" value={c.id} />
                      <button type="submit" className={`${BTN_NEUTRAL} w-full`}>取消隱藏</button>
                    </form>
                  ) : (
                    <form action={hideComment}>
                      <input type="hidden" name="commentId" value={c.id} />
                      <button type="submit" className={`${BTN_NEUTRAL} w-full`}>隱藏</button>
                    </form>
                  )}
                  <form action={purgeComment}>
                    <input type="hidden" name="commentId" value={c.id} />
                    <ConfirmSubmit
                      message="永久刪除此留言及其所有子留言？此操作無法復原。"
                      className={`${BTN_DANGER} w-full`}
                    >
                      永久刪除
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] text-secondary">
                <span>作者：<strong>{c.authorName}</strong></span>
                <span>•</span>
                <span>{formatDateTime(c.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ============================================================
// 自習室
// ============================================================

async function RoomsPanel() {
  const rows = await db
    .select({
      id: studyRooms.id,
      name: studyRooms.name,
      subject: studyRooms.subject,
      description: studyRooms.description,
      capacity: studyRooms.capacity,
      createdBy: studyRooms.createdBy,
      creatorName: users.name,
      memberCount: sql<number>`count(${studyRoomMembers.userId})::int`,
    })
    .from(studyRooms)
    .leftJoin(studyRoomMembers, eq(studyRoomMembers.roomId, studyRooms.id))
    .leftJoin(users, eq(users.id, studyRooms.createdBy))
    .groupBy(studyRooms.id, users.name)
    .orderBy(studyRooms.sortOrder);

  return (
    <PanelShell title="自習室管理" icon="meeting_room" count={`${rows.length} 間`}>
      {rows.length === 0 ? (
        <EmptyState text="尚無自習室。" />
      ) : (
        <div className="space-y-md">
          {rows.map((r) => (
            <div key={r.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-on-surface">{r.name}</span>
                    {r.subject && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">{r.subject}</span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold">
                      {r.memberCount}/{r.capacity} 人
                    </span>
                  </div>
                  {r.description && <p className="text-xs text-secondary line-clamp-2">{r.description}</p>}
                  <p className="text-[10px] text-secondary mt-1">
                    建立者：<strong>{r.creatorName ?? (r.createdBy ? "（已離開帳號）" : "系統預設")}</strong>
                  </p>
                </div>
                <div className="shrink-0">
                  <form action={dissolveRoom}>
                    <input type="hidden" name="roomId" value={r.id} />
                    <ConfirmSubmit
                      message={`確定解散自習室「${r.name}」？所有 ${r.memberCount} 名成員將被移除，無法復原。`}
                      className={BTN_DANGER}
                    >
                      解散
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ============================================================
// 商城商品
// ============================================================

async function ChatPanel() {
  const rows = await db
    .select({
      id: chatMessages.id,
      content: chatMessages.content,
      authorName: chatMessages.authorName,
      hidden: chatMessages.hidden,
      createdAt: chatMessages.createdAt,
      roomId: chatMessages.roomId,
      roomName: studyRooms.name,
    })
    .from(chatMessages)
    .leftJoin(studyRooms, eq(chatMessages.roomId, studyRooms.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(200);

  return (
    <PanelShell title="自習室聊天訊息" icon="chat_bubble" count={`${rows.length} 則（最近 200）`}>
      {rows.length === 0 ? (
        <EmptyState text="目前沒有任何聊天訊息。" />
      ) : (
        <div className="space-y-md max-h-[640px] overflow-y-auto pr-1 hide-scrollbar">
          {rows.map((m) => (
            <div key={m.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface space-y-2">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {m.hidden && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                        已隱藏
                      </span>
                    )}
                    <span className="text-[10px] text-secondary">
                      <strong className="text-on-surface">{m.authorName}</strong> 於{" "}
                      <strong className="text-on-surface">{m.roomName ?? "（自習室已刪除）"}</strong>
                    </span>
                    <span className="text-[10px] text-secondary">{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="text-xs text-on-surface line-clamp-3 whitespace-pre-wrap break-words">{m.content}</p>
                </div>
                <div className="flex md:flex-col gap-1.5 shrink-0">
                  {m.roomId && (
                    <Link href={`/study-rooms/${m.roomId}`} className={`${BTN_NEUTRAL} no-underline text-center`}>
                      前往
                    </Link>
                  )}
                  {m.hidden ? (
                    <form action={unhideChatMessage}>
                      <input type="hidden" name="messageId" value={m.id} />
                      <button type="submit" className={`${BTN_NEUTRAL} w-full`}>取消隱藏</button>
                    </form>
                  ) : (
                    <form action={hideChatMessage}>
                      <input type="hidden" name="messageId" value={m.id} />
                      <button type="submit" className={`${BTN_NEUTRAL} w-full`}>隱藏</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

async function RecordingsPanel() {
  const rows = await db
    .select({
      id: voiceRecordings.id,
      authorName: voiceRecordings.authorName,
      objectKey: voiceRecordings.objectKey,
      durationMs: voiceRecordings.durationMs,
      sizeBytes: voiceRecordings.sizeBytes,
      hidden: voiceRecordings.hidden,
      createdAt: voiceRecordings.createdAt,
      roomId: voiceRecordings.roomId,
      roomName: studyRooms.name,
    })
    .from(voiceRecordings)
    .leftJoin(studyRooms, eq(voiceRecordings.roomId, studyRooms.id))
    .orderBy(desc(voiceRecordings.createdAt))
    .limit(100);

  // 每段錄音產生短效簽名播放 URL（簽名為本地運算，不發網路請求）
  const withUrls = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      url: await presignedGetUrl(r.objectKey).catch(() => null),
    })),
  );

  return (
    <PanelShell title="語音通話錄音" icon="graphic_eq" count={`${withUrls.length} 段（最近 100）`}>
      {withUrls.length === 0 ? (
        <EmptyState text="目前沒有任何語音錄音。" />
      ) : (
        <div className="space-y-md max-h-[640px] overflow-y-auto pr-1 hide-scrollbar">
          {withUrls.map((r) => (
            <div key={r.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {r.hidden && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                    已隱藏
                  </span>
                )}
                <span className="text-[10px] text-secondary">
                  <strong className="text-on-surface">{r.authorName}</strong> 於{" "}
                  <strong className="text-on-surface">{r.roomName ?? "（自習室已刪除）"}</strong>
                </span>
                <span className="text-[10px] text-secondary">{formatDateTime(r.createdAt)}</span>
                {r.durationMs ? (
                  <span className="text-[10px] text-secondary">{Math.round(r.durationMs / 1000)} 秒</span>
                ) : null}
                {r.sizeBytes ? (
                  <span className="text-[10px] text-secondary">{(r.sizeBytes / 1024).toFixed(0)} KB</span>
                ) : null}
              </div>
              {r.url ? (
                <audio controls preload="none" src={r.url} className="w-full h-9" />
              ) : (
                <p className="text-[10px] text-error">無法產生播放連結（請檢查 S3 設定）</p>
              )}
              <div className="flex gap-1.5">
                {r.roomId && (
                  <Link href={`/study-rooms/${r.roomId}`} className={`${BTN_NEUTRAL} no-underline text-center`}>
                    前往
                  </Link>
                )}
                {r.hidden ? (
                  <form action={unhideRecording}>
                    <input type="hidden" name="recordingId" value={r.id} />
                    <button type="submit" className={BTN_NEUTRAL}>取消隱藏</button>
                  </form>
                ) : (
                  <form action={hideRecording}>
                    <input type="hidden" name="recordingId" value={r.id} />
                    <button type="submit" className={BTN_NEUTRAL}>隱藏</button>
                  </form>
                )}
                <form action={deleteRecording}>
                  <input type="hidden" name="recordingId" value={r.id} />
                  <ConfirmSubmit
                    message="永久刪除此錄音（含 MinIO 檔案）？此操作無法復原。"
                    className={BTN_DANGER}
                  >
                    永久刪除
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

async function ShopPanel() {
  const rows = await db.select().from(shopItems).orderBy(shopItems.sortOrder);

  return (
    <PanelShell title="商城商品管理" icon="storefront" count={`${rows.length} 項`}>
      <p className="text-xs text-secondary mb-md">
        上下架以 sortOrder 正負表示（schema 無上架旗標欄位）：負值＝已下架，會排在最後。
      </p>
      {rows.length === 0 ? (
        <EmptyState text="尚無商品。" />
      ) : (
        <div className="space-y-md">
          {rows.map((it) => {
            const offShelf = it.sortOrder < 0;
            return (
              <div key={it.id} className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{it.icon}</span>
                  <span className="font-bold text-sm text-on-surface">{it.name}</span>
                  {it.grade && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold">{it.grade}</span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">{it.type}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    offShelf
                      ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  }`}>
                    {offShelf ? "已下架" : "上架中"}
                  </span>
                  <code className="text-[10px] text-secondary">{it.id}</code>
                </div>
                <form action={updateShopItem} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                  <input type="hidden" name="itemId" value={it.id} />
                  <label className="text-[10px] text-secondary col-span-2 md:col-span-2">
                    名稱
                    <input name="name" defaultValue={it.name} className={`${FIELD} w-full mt-0.5`} required />
                  </label>
                  <label className="text-[10px] text-secondary">
                    價格
                    <input type="number" name="price" defaultValue={it.price} className={`${FIELD} w-full mt-0.5`} />
                  </label>
                  <label className="text-[10px] text-secondary">
                    回復HP
                    <input type="number" name="hpRestore" defaultValue={it.hpRestore} className={`${FIELD} w-full mt-0.5`} />
                  </label>
                  <label className="text-[10px] text-secondary">
                    經驗
                    <input type="number" name="expGain" defaultValue={it.expGain} className={`${FIELD} w-full mt-0.5`} />
                  </label>
                  <label className="text-[10px] text-secondary">
                    排序
                    <input type="number" name="sortOrder" defaultValue={it.sortOrder} className={`${FIELD} w-full mt-0.5`} />
                  </label>
                  <label className="text-[10px] text-secondary col-span-2 md:col-span-5">
                    描述
                    <input name="description" defaultValue={it.description ?? ""} className={`${FIELD} w-full mt-0.5`} />
                  </label>
                  <button type="submit" className={`${BTN_PRIMARY} h-fit`}>儲存</button>
                </form>
                <div className="flex justify-end gap-1.5 mt-2">
                  <form action={toggleShopItem}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <button type="submit" className={BTN_NEUTRAL}>
                      {offShelf ? "上架" : "下架"}
                    </button>
                  </form>
                  <form action={deleteShopItem}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <ConfirmSubmit
                      message={`確定刪除商品「${it.name}」？所有玩家的此商品庫存將一併移除，無法復原。`}
                      className={BTN_DANGER}
                    >
                      刪除
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

// ============================================================
// 使用者
// ============================================================

async function UsersPanel({ currentUserId }: { currentUserId?: string }) {
  const [rows, departmentRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
        gender: users.gender,
        petStyle: users.petStyle,
        department: users.department,
        bio: users.bio,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(300),
    db
      .select({ name: departments.name })
      .from(departments)
      .orderBy(departments.sortOrder, departments.name),
  ]);

  const departmentNames = departmentRows.map((d) => d.name);

  return (
    <PanelShell title="使用者管理" icon="group" count={`${rows.length} 位`}>
      <p className="text-xs text-secondary mb-md">
        展開每位使用者可編輯其全部可改資訊（暱稱、系所、角色、性別、自我介紹、電子雞造型）。電子郵件為 Google 綁定，唯讀不可改。防呆：不可把自己降為非管理員。
      </p>
      {rows.length === 0 ? (
        <EmptyState text="尚無使用者。" />
      ) : (
        <div className="space-y-md max-h-[680px] overflow-y-auto pr-1 hide-scrollbar">
          {rows.map((u) => {
            const isSelf = u.id === currentUserId;
            const deptInList =
              !u.department || departmentNames.includes(u.department);
            return (
              <details key={u.id} className="group p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface">
                <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="size-10 rounded-full bg-surface-container shrink-0 overflow-hidden flex items-center justify-center text-secondary">
                      {u.image ? (
                        <img src={u.image} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">person</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface truncate">{u.name ?? "（未命名）"}</span>
                        {isSelf && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">你</span>
                        )}
                        <RoleBadge role={u.role as Role} />
                      </div>
                      <p className="text-[10px] text-secondary truncate">{u.email ?? "（無 email）"}</p>
                      <p className="text-[10px] text-secondary truncate">
                        {u.department ?? "未指定科系"} • 註冊於 {formatDateTime(u.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-secondary group-open:text-primary">
                    <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-180">expand_more</span>
                    <span className="group-open:hidden">編輯</span>
                    <span className="hidden group-open:inline">收合</span>
                  </span>
                </summary>

                <form
                  action={updateUser}
                  className="mt-md pt-md border-t border-outline-variant/20 grid grid-cols-1 md:grid-cols-2 gap-3"
                >
                  <input type="hidden" name="userId" value={u.id} />

                  <label className="text-[10px] text-secondary">
                    暱稱（留空維持原暱稱）
                    <input
                      name="name"
                      defaultValue={u.name ?? ""}
                      maxLength={100}
                      className={`${FIELD} w-full mt-0.5`}
                      placeholder="（未命名）"
                    />
                  </label>

                  <label className="text-[10px] text-secondary">
                    電子郵件（Google 綁定，唯讀）
                    <input
                      value={u.email ?? "（無 email）"}
                      readOnly
                      disabled
                      className={`${FIELD} w-full mt-0.5 opacity-60 cursor-not-allowed`}
                    />
                  </label>

                  <label className="text-[10px] text-secondary">
                    系所
                    <select
                      key={u.department ?? "none"}
                      name="department"
                      defaultValue={u.department ?? ""}
                      className={`${FIELD} w-full mt-0.5`}
                    >
                      <option value="">未指定科系</option>
                      {/* 目前值已不在清單（例：科系被刪除）時，保留為選項以免儲存時遺失 */}
                      {u.department && !deptInList && (
                        <option value={u.department}>{u.department}（已停用）</option>
                      )}
                      {departmentNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[10px] text-secondary">
                    角色
                    <select
                      key={`role-${u.role}`}
                      name="role"
                      defaultValue={u.role}
                      disabled={isSelf}
                      className={`${FIELD} w-full mt-0.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={isSelf ? "不可變更自己的角色" : undefined}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[10px] text-secondary">
                    性別
                    <select
                      key={`gender-${u.gender ?? "none"}`}
                      name="gender"
                      defaultValue={u.gender ?? "undisclosed"}
                      className={`${FIELD} w-full mt-0.5`}
                    >
                      {GENDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[10px] text-secondary">
                    電子雞造型
                    <select
                      key={`pet-${u.petStyle ?? "none"}`}
                      name="petStyle"
                      defaultValue={u.petStyle ?? "classic"}
                      className={`${FIELD} w-full mt-0.5`}
                    >
                      {PET_STYLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[10px] text-secondary md:col-span-2">
                    自我介紹
                    <textarea
                      name="bio"
                      defaultValue={u.bio ?? ""}
                      maxLength={500}
                      rows={3}
                      className={`${FIELD} w-full mt-0.5 resize-y`}
                      placeholder="這位使用者的自我介紹..."
                    />
                  </label>

                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" className={BTN_PRIMARY}>儲存變更</button>
                  </div>
                </form>
              </details>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, { label: string; cls: string }> = {
    student: { label: "學生", cls: "bg-surface-container text-on-surface-variant" },
    ta: { label: "助教", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
    professor: { label: "教授", cls: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
    admin: { label: "管理員", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  };
  const m = map[role] ?? map.student;
  return <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${m.cls}`}>{m.label}</span>;
}

// ============================================================
// 檢舉案件
// ============================================================

async function ReportsPanel() {
  const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
  const pendingReports = allReports.filter((r) => r.status === "pending");
  const resolvedReports = allReports.filter((r) => r.status !== "pending");

  return (
    <PanelShell title="檢舉案件與處理日誌" icon="report" count={`${pendingReports.length} 案待理`} accent="red">
      <div className="space-y-md max-h-[420px] overflow-y-auto pr-1 hide-scrollbar mb-md">
        {pendingReports.length === 0 ? (
          <EmptyState text="目前沒有待處理的檢舉案件。" />
        ) : (
          pendingReports.map((r) => (
            <div key={r.id} className="bg-surface-container-low dark:bg-surface p-md rounded-xl border border-outline-variant/30 space-y-sm">
              <div className="flex items-center justify-between text-xs text-secondary">
                <span className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold px-2 py-0.5 rounded">
                  {r.targetType === "post" ? "檢舉文章" : "檢舉回覆"}
                </span>
                <span>{r.reporter ?? "匿名"} • {formatDateTime(r.createdAt)}</span>
              </div>
              <p className="text-xs text-on-surface font-bold">
                理由：<span className="font-normal text-secondary">{r.reason ?? "未填寫"}</span>
              </p>
              <div className="bg-surface-container-high dark:bg-surface-container p-sm rounded text-xs text-secondary font-mono leading-normal border border-outline-variant/20 line-clamp-2 break-words">
                {r.targetText ?? "（內容已不可用）"}
              </div>
              <div className="flex gap-sm justify-end">
                <form action={blockReport}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <button type="submit" className={BTN_DANGER}>屏蔽內容</button>
                </form>
                <form action={rejectReport}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <button type="submit" className={BTN_NEUTRAL}>駁回案件</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
      <h4 className="font-bold text-xs text-on-surface mb-2 border-t border-outline-variant/20 pt-3">
        📋 操作歷史日誌
      </h4>
      <div className="space-y-2 text-xs overflow-y-auto max-h-[360px] pr-1 hide-scrollbar">
        {resolvedReports.length === 0 ? (
          <div className="text-center text-secondary py-8">無歷史操作日誌。</div>
        ) : (
          resolvedReports.map((r) => {
            const actionText = r.status === "blocked" ? "屏蔽隱藏" : "駁回免置";
            return (
              <div key={r.id} className="p-sm bg-surface-container-low dark:bg-surface rounded border border-outline-variant/10 leading-normal mb-1.5">
                <span className="font-bold text-primary dark:text-primary-fixed-dim">[{actionText}]</span>{" "}
                <span>
                  管理員審查了 {r.reporter ?? "匿名"} 的{r.targetType === "post" ? "文章" : "回覆"}
                  檢舉案，結果為 [{actionText}]。
                </span>
                <span className="block text-[9px] text-secondary text-right mt-1">
                  {r.resolvedAt ? formatDateTime(r.resolvedAt) : "—"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </PanelShell>
  );
}

// ============================================================
// 共用版面元件
// ============================================================

function PanelShell({
  title,
  icon,
  count,
  accent = "default",
  children,
}: {
  title: string;
  icon: string;
  count?: string;
  accent?: "default" | "red";
  children: React.ReactNode;
}) {
  const titleCls =
    accent === "red" ? "text-red-600 dark:text-red-400" : "text-on-surface";
  const countCls =
    accent === "red"
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : "bg-primary/10 text-primary";
  return (
    <div className={`${CARD} p-lg`}>
      <div className="flex items-center justify-between gap-2 mb-md border-b border-outline-variant/20 pb-2">
        <h3 className={`font-bold text-body-lg flex items-center gap-1 min-w-0 ${titleCls}`}>
          <span className="material-symbols-outlined text-[20px] shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </h3>
        {count && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 whitespace-nowrap ${countCls}`}>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-secondary text-xs py-10 border border-dashed border-outline-variant/40 rounded-xl">
      {text}
    </div>
  );
}
