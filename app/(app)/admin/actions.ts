"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { reports, posts, comments } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") throw new Error("需要系統管理員權限");
}

/** 重新驗證受某篇貼文影響的所有列表/詳情頁。 */
function revalidatePostSurfaces(postId: string, boardId?: string) {
  revalidatePath("/admin");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/discussion");
  revalidatePath("/boards");
  if (boardId) revalidatePath(`/boards/${boardId}`);
}

/** 封鎖：隱藏被檢舉內容，並把案件標記為已封鎖（移出待處理清單） */
export async function blockReport(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reportId") ?? "");
  if (!id) throw new Error("缺少案件");

  const [rep] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!rep) throw new Error("案件不存在");
  if (rep.status !== "pending") return;

  if (rep.targetType === "post") {
    // 隱藏被檢舉貼文；檢查實際是否有內容被隱藏，避免日誌與處置不符。
    const updated = await db
      .update(posts)
      .set({ hidden: true })
      .where(eq(posts.id, rep.targetId))
      .returning({ id: posts.id, boardId: posts.boardId });
    if (updated.length === 0) {
      throw new Error("被檢舉的提問已不存在，無法封鎖");
    }
    revalidatePostSurfaces(rep.targetId, updated[0].boardId);
  } else {
    // 隱藏被檢舉留言；需取得其所在貼文以重新驗證該詳情頁。
    const updated = await db
      .update(comments)
      .set({ hidden: true })
      .where(eq(comments.id, rep.targetId))
      .returning({ id: comments.id, postId: comments.postId });
    if (updated.length === 0) {
      throw new Error("被檢舉的留言已不存在，無法封鎖");
    }
    revalidatePostSurfaces(updated[0].postId);
  }

  await db
    .update(reports)
    .set({ status: "blocked", resolvedAt: new Date() })
    .where(eq(reports.id, id));

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

/**
 * 後台直接刪除提問：以 hidden=true 達成「刪除」效果（軟刪除，資料保留供稽核）。
 * 對應 legacy 的「刪除問題」按鈕。
 * 註：legacy 另有「刪除並封鎖帳號」，但本專案 users schema 無封鎖欄位，
 * 且嚴格規則禁止變更 schema，故僅實作刪除（隱藏）提問；封鎖帳號功能不提供。
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

/** 還原被隱藏的提問（誤刪復原），讓刪除控制項雙向可用。 */
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
