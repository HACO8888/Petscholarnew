"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, comments, boards, pets, reports } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createPost(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const boardId = str(formData, "boardId");
  const title = str(formData, "title").slice(0, 200);
  const content = str(formData, "content");
  const department = str(formData, "department") || null;
  const tags = str(formData, "tags")
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  const bounty = Math.max(
    0,
    Math.min(9999, Number.parseInt(str(formData, "bounty"), 10) || 0),
  );

  if (!boardId || !title || !content) {
    throw new Error("看板、標題與內容為必填");
  }

  const [board] = await db
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) throw new Error("看板不存在");

  const id = crypto.randomUUID();
  await db.insert(posts).values({
    id,
    boardId,
    authorId: session.user.id,
    authorName: session.user.name ?? "使用者",
    title,
    content,
    department,
    tags,
    bounty,
  });

  redirect(`/posts/${id}`);
}

export async function addComment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const postId = str(formData, "postId");
  const parentId = str(formData, "parentId") || null;
  const content = str(formData, "content");

  if (!postId || !content) throw new Error("回覆內容不可為空");

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

  const postId = str(formData, "postId");
  const commentId = str(formData, "commentId");
  if (!postId || !commentId) throw new Error("缺少參數");

  // 僅發問者可採納
  const [post] = await db
    .select({ authorId: posts.authorId, bounty: posts.bounty })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post) throw new Error("文章不存在");
  if (post.authorId !== session.user.id) {
    throw new Error("只有發問者可以採納解答");
  }

  const [target] = await db
    .select({ authorId: comments.authorId, isAdopted: comments.isAdopted })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.postId, postId)))
    .limit(1);
  if (!target) throw new Error("回覆不存在");

  await db
    .update(comments)
    .set({ isAdopted: true })
    .where(and(eq(comments.id, commentId), eq(comments.postId, postId)));
  await db.update(posts).set({ solved: true }).where(eq(posts.id, postId));

  // 將懸賞金幣發給被採納的解答者（避免重複發放、不發給自己）
  if (
    !target.isAdopted &&
    post.bounty > 0 &&
    target.authorId &&
    target.authorId !== session.user.id
  ) {
    const answererPet = await getOrCreatePet(target.authorId);
    await db
      .update(pets)
      .set({ coins: answererPet.coins + post.bounty, updatedAt: new Date() })
      .where(eq(pets.userId, target.authorId));
  }

  revalidatePath(`/posts/${postId}`);
}
