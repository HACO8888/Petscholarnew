"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { comments, studyRoomMembers, couponRedemptions } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { WELFARE_ITEMS, type WelfareItem } from "./welfare-data";

/**
 * 計算使用者目前的福利社解鎖能力：寵物等級與已擁有的徽章名稱。
 * 徽章判定與 leaderboard 頁面 badges-showcase 完全一致（真實 DB 來源）。
 */
export async function getWelfareEligibility(userId: string): Promise<{
  petLevel: number;
  ownedBadgeNames: string[];
}> {
  const [{ ac }] = await db
    .select({ ac: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.authorId, userId), eq(comments.hidden, false)));
  const [{ adopted }] = await db
    .select({ adopted: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.authorId, userId), eq(comments.isAdopted, true)));
  const [{ rooms }] = await db
    .select({ rooms: sql<number>`count(*)::int` })
    .from(studyRoomMembers)
    .where(eq(studyRoomMembers.userId, userId));
  const pet = await getOrCreatePet(userId);

  // 與 page.tsx badges 判定一致：
  // 好學新手=註冊即得(true)、解題達人=被採納>=1、共讀先鋒=自習室>=1、熱心助人=回覆>=1
  const ownedBadgeNames: string[] = [];
  ownedBadgeNames.push("好學新手");
  if (adopted >= 1) ownedBadgeNames.push("解題達人");
  if (rooms >= 1) ownedBadgeNames.push("共讀先鋒");
  if (ac >= 1) ownedBadgeNames.push("熱心助人");

  return { petLevel: pet.level, ownedBadgeNames };
}

/** 判斷單張優惠券是否達成兌換條件 */
function isCouponUnlocked(
  coupon: WelfareItem,
  petLevel: number,
  ownedBadgeNames: string[],
): boolean {
  if (coupon.reqType === "level") {
    return petLevel >= (coupon.reqValue as number);
  }
  return ownedBadgeNames.includes(coupon.reqValue as string);
}

/** 兌換優惠券：登入後驗證條件，達成才寫入 couponRedemptions */
export async function redeemCoupon(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const couponId = String(formData.get("couponId") ?? "");
  const coupon = WELFARE_ITEMS.find((c) => c.id === couponId);
  if (!coupon) throw new Error("優惠券不存在");

  const { petLevel, ownedBadgeNames } = await getWelfareEligibility(userId);
  if (!isCouponUnlocked(coupon, petLevel, ownedBadgeNames)) {
    throw new Error(
      coupon.reqType === "level"
        ? `尚未達成兌換條件：需寵物等級 ${coupon.reqValue}`
        : `尚未達成兌換條件：需解鎖徽章「${coupon.reqValue}」`,
    );
  }

  await db
    .insert(couponRedemptions)
    .values({
      userId,
      couponId: coupon.id,
      code: coupon.couponCode,
    })
    .onConflictDoNothing();

  revalidatePath("/leaderboard");
}
