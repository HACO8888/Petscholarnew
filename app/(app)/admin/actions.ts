"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
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
