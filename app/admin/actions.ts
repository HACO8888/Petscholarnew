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

/** 封鎖：隱藏被檢舉內容，並把案件標記為已封鎖（移出待處理清單） */
export async function blockReport(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reportId") ?? "");
  if (!id) throw new Error("缺少案件");

  const [rep] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!rep) throw new Error("案件不存在");
  if (rep.status !== "pending") return;

  if (rep.targetType === "post") {
    await db.update(posts).set({ hidden: true }).where(eq(posts.id, rep.targetId));
  } else {
    await db.update(comments).set({ hidden: true }).where(eq(comments.id, rep.targetId));
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

  await db
    .update(reports)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(eq(reports.id, id));

  revalidatePath("/admin");
}
