"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, comments, boards, pets, reports, departments } from "@/db/schema";
import { getOrCreatePet, applyExp } from "@/lib/pet";

const ADOPT_EXP = 20;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createPost(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const boardId = str(formData, "boardId");
  const title = str(formData, "title").slice(0, 200);
  const content = str(formData, "content").slice(0, 20000);
  // 科系：只接受 departments 清單內的值；其餘（含竄改表單）一律 null。
  const departmentRaw = str(formData, "department").slice(0, 60);
  let department: string | null = null;
  if (departmentRaw) {
    const [match] = await db
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.name, departmentRaw))
      .limit(1);
    department = match?.name ?? null;
  }
  const tags = str(formData, "tags")
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  const bounty = Math.max(
    0,
    Math.min(9999, Number.parseInt(str(formData, "bounty"), 10) || 0),
  );
  // 附圖：只接受本站上傳服務 URL（前端先上傳 /api/uploads 取得），其餘一律忽略。
  const imageRaw = str(formData, "image");
  const image = imageRaw.startsWith("/api/uploads/file?") ? imageRaw : null;

  if (!boardId || !title || !content) {
    throw new Error("看板、標題與內容為必填");
  }

  const [board] = await db
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) throw new Error("看板不存在");

  await getOrCreatePet(userId); // 確保發問者錢包存在

  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    // 懸賞採「託管」制：發文時先原子扣除發問者金幣（餘額不足則中止），
    // 採納時再把這筆託管轉給解答者 → 金幣守恆，杜絕無中生有的增發。
    if (bounty > 0) {
      const debited = await tx
        .update(pets)
        .set({ coins: sql`${pets.coins} - ${bounty}`, updatedAt: new Date() })
        .where(and(eq(pets.userId, userId), gte(pets.coins, bounty)))
        .returning({ userId: pets.userId });
      if (debited.length === 0) throw new Error("金幣不足以設定此懸賞");
    }
    await tx.insert(posts).values({
      id,
      boardId,
      authorId: userId,
      authorName: session.user.name ?? "使用者",
      title,
      content,
      image,
      department,
      tags,
      bounty,
    });
  });

  // 重新驗證所有會顯示此貼文的清單頁，避免新貼文在清單上過期
  revalidatePath("/");
  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/discussion");

  redirect(`/posts/${id}`);
}

export async function addComment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const postId = str(formData, "postId");
  const parentId = str(formData, "parentId") || null;
  const content = str(formData, "content").slice(0, 20000);
  const imageRaw = str(formData, "image");
  const image = imageRaw.startsWith("/api/uploads/file?") ? imageRaw : null;

  if (!postId || (!content && !image)) throw new Error("回覆內容不可為空");

  // 確認 post 存在；若指定 parent，需屬於同一篇 post
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post) throw new Error("文章不存在");

  if (parentId) {
    const [parent] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, parentId), eq(comments.postId, postId)))
      .limit(1);
    if (!parent) throw new Error("回覆對象不存在");
  }

  await db.insert(comments).values({
    postId,
    parentId,
    authorId: session.user.id,
    authorName: session.user.name ?? "使用者",
    content,
    image,
  });

  revalidatePath(`/posts/${postId}`);
}

export async function reportPost(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const postId = str(formData, "postId");
  const reason = str(formData, "reason").slice(0, 100) || "未說明原因";
  if (!postId) throw new Error("缺少文章");

  const [post] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post) throw new Error("文章不存在");

  await db.insert(reports).values({
    targetType: "post",
    targetId: post.id,
    targetText: post.title,
    reason,
    reporter: session.user.name ?? "使用者",
    status: "pending",
  });

  revalidatePath(`/posts/${postId}`);
}

export async function adoptAnswer(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const postId = str(formData, "postId");
  const commentId = str(formData, "commentId");
  if (!postId || !commentId) throw new Error("缺少參數");

  // 僅發問者可採納
  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post) throw new Error("文章不存在");
  if (post.authorId !== userId) {
    throw new Error("只有發問者可以採納解答");
  }

  const [target] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.postId, postId)))
    .limit(1);
  if (!target) throw new Error("回覆不存在");

  // 解答者錢包先確保存在（交易外，避免巢狀建立）
  const rewardTo =
    target.authorId && target.authorId !== userId ? target.authorId : null;
  if (rewardTo) await getOrCreatePet(rewardTo);

  await db.transaction(async (tx) => {
    // 以條件式 UPDATE 作為原子領取閘門：唯有把 solved false→true 的那一個請求才會繼續發放，
    // 杜絕並發 / 雙擊造成的重複發放。bounty 取自被領取的那一列（已於發文時託管扣款）。
    const claimed = await tx
      .update(posts)
      .set({ solved: true })
      .where(and(eq(posts.id, postId), eq(posts.solved, false)))
      .returning({ bounty: posts.bounty });
    if (claimed.length === 0) throw new Error("此提問已採納解答");

    await tx
      .update(comments)
      .set({ isAdopted: true })
      .where(and(eq(comments.id, commentId), eq(comments.postId, postId)));

    if (rewardTo) {
      // 鎖定解答者寵物列，避免成長與金幣 lost-update
      const [answerer] = await tx
        .select()
        .from(pets)
        .where(eq(pets.userId, rewardTo))
        .for("update");
      if (answerer) {
        const grown = applyExp(
          answerer.level,
          answerer.exp,
          answerer.maxHp,
          ADOPT_EXP,
        );
        await tx
          .update(pets)
          .set({
            // 懸賞託管轉帳 + 升級獎勵金幣（每升一級 +20×新等級，連升多級已累加）
            coins: sql`${pets.coins} + ${Math.max(0, claimed[0].bounty) + grown.coinReward}`,
            hp: Math.min(grown.maxHp, answerer.hp + grown.hpGain),
            exp: grown.exp,
            level: grown.level,
            maxHp: grown.maxHp,
            updatedAt: new Date(),
          })
          .where(eq(pets.userId, rewardTo));
      }
    }
  });

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/discussion");
  revalidatePath("/boards");
}

/**
 * 助教認證正解：role==='ta' 的使用者把某則留言標記為正解。
 * 沿用既有 isAdopted/solved 欄位作為「已認證/已解決」狀態（schema 無 isTaVerified 欄位），
 * 並發放懸賞金幣與經驗值給解答者，與發問者採納相同的單次發放閘門。
 */
export async function verifyAnswerAsTA(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ta") {
    throw new Error("只有課程助教可以認證正解");
  }
  const userId = session.user.id;

  const postId = str(formData, "postId");
  const commentId = str(formData, "commentId");
  if (!postId || !commentId) throw new Error("缺少參數");

  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post) throw new Error("文章不存在");

  const [target] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.postId, postId)))
    .limit(1);
  if (!target) throw new Error("回覆不存在");

  const rewardTo =
    target.authorId && target.authorId !== userId ? target.authorId : null;
  if (rewardTo) await getOrCreatePet(rewardTo);

  await db.transaction(async (tx) => {
    // 與 adoptAnswer 相同的原子領取閘門：bounty 已於發文時託管扣款，此處僅轉帳，發放一次
    const claimed = await tx
      .update(posts)
      .set({ solved: true })
      .where(and(eq(posts.id, postId), eq(posts.solved, false)))
      .returning({ bounty: posts.bounty });
    if (claimed.length === 0) throw new Error("此提問已採納解答");

    await tx
      .update(comments)
      .set({ isAdopted: true })
      .where(and(eq(comments.id, commentId), eq(comments.postId, postId)));

    if (rewardTo) {
      const [answerer] = await tx
        .select()
        .from(pets)
        .where(eq(pets.userId, rewardTo))
        .for("update");
      if (answerer) {
        const grown = applyExp(
          answerer.level,
          answerer.exp,
          answerer.maxHp,
          ADOPT_EXP,
        );
        await tx
          .update(pets)
          .set({
            // 懸賞託管轉帳 + 升級獎勵金幣（每升一級 +20×新等級，連升多級已累加）
            coins: sql`${pets.coins} + ${Math.max(0, claimed[0].bounty) + grown.coinReward}`,
            hp: Math.min(grown.maxHp, answerer.hp + grown.hpGain),
            exp: grown.exp,
            level: grown.level,
            maxHp: grown.maxHp,
            updatedAt: new Date(),
          })
          .where(eq(pets.userId, rewardTo));
      }
    }
  });

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/discussion");
  revalidatePath("/boards");
}

export async function reportComment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const postId = str(formData, "postId");
  const commentId = str(formData, "commentId");
  const reason = str(formData, "reason").slice(0, 100) || "未說明原因";
  if (!postId || !commentId) throw new Error("缺少參數");

  const [comment] = await db
    .select({ id: comments.id, content: comments.content })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.postId, postId)))
    .limit(1);
  if (!comment) throw new Error("回覆不存在");

  await db.insert(reports).values({
    targetType: "comment",
    targetId: comment.id,
    targetText: comment.content.slice(0, 200),
    reason,
    reporter: session.user.name ?? "使用者",
    status: "pending",
  });

  revalidatePath(`/posts/${postId}`);
}
