"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  reports,
  posts,
  comments,
  boards,
  studyRooms,
  shopItems,
  users,
  chatMessages,
  voiceRecordings,
  departments,
} from "@/db/schema";
import type { Role } from "@/db/schema";
import { deleteObject } from "@/lib/s3";

/**
 * 嚴格的 server 端 admin 驗權：所有後台異動 action 都必須先呼叫。
 * 絕不信任前端傳來的角色／旗標；一律以資料庫 session 的 role 為準。
 */
async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") throw new Error("需要系統管理員權限");
  return session;
}

/** admin：隱藏一則自習室聊天訊息（hidden 後一般使用者不再看得到） */
export async function hideChatMessage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("messageId") ?? "");
  if (!id) throw new Error("缺少訊息");
  const updated = await db
    .update(chatMessages)
    .set({ hidden: true })
    .where(eq(chatMessages.id, id))
    .returning({ id: chatMessages.id });
  if (updated.length === 0) throw new Error("訊息不存在");
  revalidatePath("/admin");
}

/** admin：取消隱藏一則聊天訊息 */
export async function unhideChatMessage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("messageId") ?? "");
  if (!id) throw new Error("缺少訊息");
  const updated = await db
    .update(chatMessages)
    .set({ hidden: false })
    .where(eq(chatMessages.id, id))
    .returning({ id: chatMessages.id });
  if (updated.length === 0) throw new Error("訊息不存在");
  revalidatePath("/admin");
}

/** admin：隱藏一段語音錄音（hidden 後一般使用者不再看得到） */
export async function hideRecording(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("recordingId") ?? "");
  if (!id) throw new Error("缺少錄音");
  await db.update(voiceRecordings).set({ hidden: true }).where(eq(voiceRecordings.id, id));
  revalidatePath("/admin");
}

/** admin：取消隱藏一段語音錄音 */
export async function unhideRecording(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("recordingId") ?? "");
  if (!id) throw new Error("缺少錄音");
  await db.update(voiceRecordings).set({ hidden: false }).where(eq(voiceRecordings.id, id));
  revalidatePath("/admin");
}

/** admin：永久刪除一段語音錄音（同時刪除 MinIO 物件） */
export async function deleteRecording(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("recordingId") ?? "");
  if (!id) throw new Error("缺少錄音");
  const [row] = await db
    .delete(voiceRecordings)
    .where(eq(voiceRecordings.id, id))
    .returning({ objectKey: voiceRecordings.objectKey });
  if (row?.objectKey) {
    try {
      await deleteObject(row.objectKey);
    } catch {
      /* 物件刪除失敗不阻擋 DB 刪除；孤兒物件可日後清理 */
    }
  }
  revalidatePath("/admin");
}

const VALID_ROLES: Role[] = ["student", "ta", "professor", "admin"];

/** 重新驗證受某篇貼文影響的所有列表/詳情頁。 */
function revalidatePostSurfaces(postId: string, boardId?: string) {
  revalidatePath("/admin");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/discussion");
  revalidatePath("/boards");
  if (boardId) revalidatePath(`/boards/${boardId}`);
}

// ============================================================
// 檢舉案件（沿用原有模式）
// ============================================================

/** 封鎖：隱藏被檢舉內容，並把案件標記為已封鎖（移出待處理清單） */
export async function blockReport(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reportId") ?? "");
  if (!id) throw new Error("缺少案件");

  // 隱藏內容與標記案件在同一交易內完成，避免部分失敗造成「已隱藏但案件仍 pending」之類的不一致。
  const result = await db.transaction(async (tx) => {
    const [rep] = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    if (!rep) throw new Error("案件不存在");
    if (rep.status !== "pending") return null;

    let boardId: string | undefined;
    let postId: string | undefined;

    if (rep.targetType === "post") {
      const updated = await tx
        .update(posts)
        .set({ hidden: true })
        .where(eq(posts.id, rep.targetId))
        .returning({ boardId: posts.boardId });
      if (updated.length === 0) {
        throw new Error("被檢舉的提問已不存在，無法封鎖");
      }
      boardId = updated[0].boardId;
    } else {
      const updated = await tx
        .update(comments)
        .set({ hidden: true })
        .where(eq(comments.id, rep.targetId))
        .returning({ postId: comments.postId });
      if (updated.length === 0) {
        throw new Error("被檢舉的留言已不存在，無法封鎖");
      }
      postId = updated[0].postId;
    }

    // 同一目標的所有待處理檢舉一併標記為已封鎖，避免重複案件懸空在待處理清單。
    await tx
      .update(reports)
      .set({ status: "blocked", resolvedAt: new Date() })
      .where(
        and(
          eq(reports.targetType, rep.targetType),
          eq(reports.targetId, rep.targetId),
          eq(reports.status, "pending"),
        ),
      );

    return { targetType: rep.targetType, targetId: rep.targetId, boardId, postId };
  });

  if (!result) return; // 已被其他人處理
  if (result.targetType === "post") {
    revalidatePostSurfaces(result.targetId, result.boardId);
  } else if (result.postId) {
    revalidatePostSurfaces(result.postId);
  }
  revalidatePath("/admin");
}

/** 駁回：案件標記為已駁回（移出待處理清單），不影響內容 */
export async function rejectReport(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reportId") ?? "");
  if (!id) throw new Error("缺少案件");

  const [rep] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!rep) throw new Error("案件不存在");
  if (rep.status !== "pending") return;

  await db
    .update(reports)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(eq(reports.id, id));

  revalidatePath("/admin");
}

// ============================================================
// 貼文 post
// ============================================================

/**
 * 隱藏提問：以 hidden=true 達成「下架」效果（軟刪除，資料保留供稽核）。
 * 註：users schema 無封鎖欄位且禁止改 schema，故僅實作隱藏；封鎖帳號功能不提供。
 */
export async function deletePost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("postId") ?? "");
  if (!id) throw new Error("缺少提問");

  const updated = await db
    .update(posts)
    .set({ hidden: true })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, boardId: posts.boardId });
  if (updated.length === 0) throw new Error("提問不存在");

  revalidatePostSurfaces(id, updated[0].boardId);
}

/** 還原被隱藏的提問（誤刪復原），讓隱藏控制項雙向可用。 */
export async function restorePost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("postId") ?? "");
  if (!id) throw new Error("缺少提問");

  const updated = await db
    .update(posts)
    .set({ hidden: false })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, boardId: posts.boardId });
  if (updated.length === 0) throw new Error("提問不存在");

  revalidatePostSurfaces(id, updated[0].boardId);
}

/**
 * 永久刪除提問（硬刪除）：連同其留言（FK onDelete cascade）一併移除。
 * 與「隱藏」不同，無法復原，僅在確定無稽核需求時使用。
 */
export async function purgePost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("postId") ?? "");
  if (!id) throw new Error("缺少提問");

  const deleted = await db
    .delete(posts)
    .where(eq(posts.id, id))
    .returning({ boardId: posts.boardId });
  if (deleted.length === 0) throw new Error("提問不存在");

  revalidatePostSurfaces(id, deleted[0].boardId);
}

// ============================================================
// 留言 comment
// ============================================================

function revalidateCommentSurfaces(postId?: string) {
  revalidatePath("/admin");
  if (postId) revalidatePath(`/posts/${postId}`);
}

/** 隱藏留言（軟刪除）。 */
export async function hideComment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("commentId") ?? "");
  if (!id) throw new Error("缺少留言");

  const updated = await db
    .update(comments)
    .set({ hidden: true })
    .where(eq(comments.id, id))
    .returning({ postId: comments.postId });
  if (updated.length === 0) throw new Error("留言不存在");

  revalidateCommentSurfaces(updated[0].postId);
}

/** 取消隱藏留言。 */
export async function restoreComment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("commentId") ?? "");
  if (!id) throw new Error("缺少留言");

  const updated = await db
    .update(comments)
    .set({ hidden: false })
    .where(eq(comments.id, id))
    .returning({ postId: comments.postId });
  if (updated.length === 0) throw new Error("留言不存在");

  revalidateCommentSurfaces(updated[0].postId);
}

/** 永久刪除留言（硬刪除）：連同子留言（自我參照 FK cascade）一併移除。 */
export async function purgeComment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("commentId") ?? "");
  if (!id) throw new Error("缺少留言");

  const deleted = await db
    .delete(comments)
    .where(eq(comments.id, id))
    .returning({ postId: comments.postId });
  if (deleted.length === 0) throw new Error("留言不存在");

  revalidateCommentSurfaces(deleted[0].postId);
}

// ============================================================
// 看板 board
// ============================================================

/** 編輯看板名稱／描述／排序。 */
export async function updateBoard(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("boardId") ?? "");
  if (!id) throw new Error("缺少看板");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) throw new Error("看板名稱不可為空");
  const description =
    String(formData.get("description") ?? "").trim().slice(0, 300) || null;
  const sortOrderRaw = Number(formData.get("sortOrder"));
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;

  const updated = await db
    .update(boards)
    .set({ name, description, sortOrder })
    .where(eq(boards.id, id))
    .returning({ id: boards.id });
  if (updated.length === 0) throw new Error("看板不存在");

  revalidatePath("/admin");
  revalidatePath("/boards");
  revalidatePath(`/boards/${id}`);
}

/**
 * 刪除看板（謹慎）：其下所有提問與留言會因 FK cascade 一併移除。
 * 為避免誤刪整個學院的內容，前端以二次確認把關，server 端再次驗權。
 */
export async function deleteBoard(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("boardId") ?? "");
  if (!id) throw new Error("缺少看板");

  const deleted = await db
    .delete(boards)
    .where(eq(boards.id, id))
    .returning({ id: boards.id });
  if (deleted.length === 0) throw new Error("看板不存在");

  revalidatePath("/admin");
  revalidatePath("/boards");
}

// ============================================================
// 自習室 study_room
// ============================================================

/** 解散自習室（刪除）：成員以 FK cascade 一併移除。 */
export async function dissolveRoom(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("roomId") ?? "");
  if (!id) throw new Error("缺少自習室");

  const deleted = await db
    .delete(studyRooms)
    .where(eq(studyRooms.id, id))
    .returning({ id: studyRooms.id });
  if (deleted.length === 0) throw new Error("自習室不存在");

  revalidatePath("/admin");
  revalidatePath("/study-rooms");
}

// ============================================================
// 商城商品 shop_item
// ============================================================

/** 編輯商品價格／描述／效果。 */
export async function updateShopItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "");
  if (!id) throw new Error("缺少商品");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) throw new Error("商品名稱不可為空");
  const description =
    String(formData.get("description") ?? "").trim().slice(0, 300) || null;

  const priceRaw = Number(formData.get("price"));
  const price = Number.isFinite(priceRaw) ? Math.max(0, Math.trunc(priceRaw)) : 0;
  const hpRaw = Number(formData.get("hpRestore"));
  const hpRestore = Number.isFinite(hpRaw) ? Math.max(0, Math.trunc(hpRaw)) : 0;
  const expRaw = Number(formData.get("expGain"));
  const expGain = Number.isFinite(expRaw) ? Math.max(0, Math.trunc(expRaw)) : 0;
  const sortOrderRaw = Number(formData.get("sortOrder"));
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;

  const updated = await db
    .update(shopItems)
    .set({ name, description, price, hpRestore, expGain, sortOrder })
    .where(eq(shopItems.id, id))
    .returning({ id: shopItems.id });
  if (updated.length === 0) throw new Error("商品不存在");

  revalidatePath("/admin");
  revalidatePath("/shop");
}

/**
 * 上下架商品：schema 無「上架旗標」欄位，故以 sortOrder 的正負作為上下架語意——
 * sortOrder < 0 視為「下架」（商城頁仍依 sortOrder 排序，但管理端可一眼分辨）。
 * 由於不可改 schema，這是現有欄位下最不侵入的折衷；若日後要嚴格隱藏需新增 active 欄位。
 */
export async function toggleShopItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "");
  if (!id) throw new Error("缺少商品");

  const [item] = await db
    .select({ sortOrder: shopItems.sortOrder })
    .from(shopItems)
    .where(eq(shopItems.id, id))
    .limit(1);
  if (!item) throw new Error("商品不存在");

  // 下架 → 上架：取絕對值並 +1（避免 0 被視為已上架仍排在前面時無變化）；
  // 上架 → 下架：取負絕對值。以正負號表達狀態，數值大小維持原本排序意義。
  const abs = Math.abs(item.sortOrder);
  const next = item.sortOrder < 0 ? abs : -(abs + 1);

  await db.update(shopItems).set({ sortOrder: next }).where(eq(shopItems.id, id));

  revalidatePath("/admin");
  revalidatePath("/shop");
}

/** 刪除商品（謹慎）：庫存紀錄（inventory）以 FK cascade 一併移除。 */
export async function deleteShopItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "");
  if (!id) throw new Error("缺少商品");

  const deleted = await db
    .delete(shopItems)
    .where(eq(shopItems.id, id))
    .returning({ id: shopItems.id });
  if (deleted.length === 0) throw new Error("商品不存在");

  revalidatePath("/admin");
  revalidatePath("/shop");
}

// ============================================================
// 使用者 user
// ============================================================

/** 變更使用者角色（student/ta/professor/admin）。 */
export async function setUserRole(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId) throw new Error("缺少使用者");
  if (!(VALID_ROLES as string[]).includes(role)) throw new Error("無效的角色");

  // 防呆：避免管理員把自己降權後再也進不來後台（仍可由 ADMIN_BOOTSTRAP_EMAIL 救回，
  // 但這裡先擋下明顯的自我降權誤操作）。
  if (session.user?.id === userId && role !== "admin") {
    throw new Error("不可變更自己的管理員角色（請改用其他管理員帳號操作）");
  }

  const updated = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (updated.length === 0) throw new Error("使用者不存在");

  revalidatePath("/admin");
}

// ============================================================
// 科系 department（由管理員維護的清單；所有選科系處只能從此清單選）
// ============================================================

/** 由系名產生英數 slug；非英數字元轉連字號，作為 id 備援。 */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** 新增科系：id 留空時由系名自動產生 slug；需唯一且不可為空。 */
export async function createDepartment(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) throw new Error("科系名稱不可為空");

  const idRaw = String(formData.get("id") ?? "").trim();
  const id = (idRaw ? slugify(idRaw) : slugify(name)) || `dept-${Date.now()}`;

  const college = String(formData.get("college") ?? "").trim().slice(0, 32) || null;
  const sortOrderRaw = Number(formData.get("sortOrder"));
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;

  const [exists] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.id, id))
    .limit(1);
  if (exists) throw new Error(`科系代碼「${id}」已存在，請改用其他代碼`);

  await db.insert(departments).values({ id, name, college, sortOrder });
  revalidatePath("/admin");
}

/** 編輯科系名稱／所屬學院／排序（id 為 PK，不可變更）。 */
export async function updateDepartment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("departmentId") ?? "");
  if (!id) throw new Error("缺少科系");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) throw new Error("科系名稱不可為空");
  const college = String(formData.get("college") ?? "").trim().slice(0, 32) || null;
  const sortOrderRaw = Number(formData.get("sortOrder"));
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;

  const updated = await db
    .update(departments)
    .set({ name, college, sortOrder })
    .where(eq(departments.id, id))
    .returning({ id: departments.id });
  if (updated.length === 0) throw new Error("科系不存在");

  revalidatePath("/admin");
}

/**
 * 刪除科系：僅從清單移除，不更動既有 users.department / posts.department 的文字快照
 * （那些欄位為純文字，無 FK；移除後新選單將不再提供此項，但歷史資料仍保留原值）。
 */
export async function deleteDepartment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("departmentId") ?? "");
  if (!id) throw new Error("缺少科系");

  const deleted = await db
    .delete(departments)
    .where(eq(departments.id, id))
    .returning({ id: departments.id });
  if (deleted.length === 0) throw new Error("科系不存在");

  revalidatePath("/admin");
}

// ============================================================
// Bootstrap：第一位管理員的安全產生途徑
// ============================================================

/**
 * 「成為管理員」安全 bootstrap。
 *
 * 用途：清空假資料後可能整個系統沒有任何 admin，無人能進後台指派角色。
 * 此 action 讓「其 email 恰好等於環境變數 ADMIN_BOOTSTRAP_EMAIL」的登入者，
 * 把自己升級為 admin。流程：
 *   1. 在伺服器設定環境變數 ADMIN_BOOTSTRAP_EMAIL=你的 Google 帳號 email。
 *   2. 以該 Google 帳號登入網站。
 *   3. 進入 /admin（此時仍是非 admin，會看到「成為管理員」卡片），點按鈕。
 *   4. server 端比對 session.user.email === ADMIN_BOOTSTRAP_EMAIL（大小寫不敏感）後升級。
 *
 * 安全性：
 *   - 升級條件完全在 server 端、以環境變數為準，前端無法偽造。
 *   - 未設定 ADMIN_BOOTSTRAP_EMAIL 時此途徑停用（直接拋錯），不會有「人人可點」的後門。
 *   - 升級完成後，建議移除該環境變數，避免長期留存可自助升權的入口。
 *   - 注意：auth.ts 另有寫死的 ADMIN_EMAILS 清單也會在登入時自動賦予 admin；
 *     兩者互補——bootstrap 提供「不改程式碼、只設環境變數」的彈性途徑。
 */
export async function bootstrapAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");

  const allowed = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!allowed) {
    throw new Error(
      "未設定 ADMIN_BOOTSTRAP_EMAIL，bootstrap 入口已停用。請先於伺服器設定該環境變數。",
    );
  }
  if (session.user.email.toLowerCase() !== allowed) {
    throw new Error("你的帳號不符合 bootstrap 條件，無法自我升級為管理員。");
  }

  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, session.user.id));

  // 角色寫進 DB 後需重新登入才會反映到 session（資料庫 session 策略）；
  // 先導回 /admin，使用者下次請求（或重新整理）即取得新角色。
  revalidatePath("/admin");
  redirect("/admin");
}
