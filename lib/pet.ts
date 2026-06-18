import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pets } from "@/db/schema";
import type { Pet } from "@/db/schema";

export const HP_PER_HEART = 100;
export const CHECKIN_REWARD = 20;

/** 取得使用者寵物，不存在則建立預設值 */
export async function getOrCreatePet(userId: string): Promise<Pet> {
  const [existing] = await db
    .select()
    .from(pets)
    .where(eq(pets.userId, userId))
    .limit(1);
  if (existing) return existing;

  await db.insert(pets).values({ userId }).onConflictDoNothing();
  const [created] = await db
    .select()
    .from(pets)
    .where(eq(pets.userId, userId))
    .limit(1);
  return created;
}

export function maxExpForLevel(level: number): number {
  return level * 100;
}

/**
 * 套用經驗值並處理升級（exp 溢出進位、maxHp 隨等級提升）。
 * 回傳 hpGain＝本次升級新增的 maxHp 量，呼叫端應把它補進當前 HP，
 * 否則升級瞬間會多出一顆空心、HP 比例不升反降（升級看起來像退步）。
 */
export function applyExp(
  level: number,
  exp: number,
  maxHp: number,
  gained: number,
): { level: number; exp: number; maxHp: number; hpGain: number } {
  let newLevel = Math.max(1, level);
  let newExp = exp + gained;
  let newMaxHp = maxHp;
  // 上限保護：避免異常大的輸入造成過多迴圈
  while (newExp >= maxExpForLevel(newLevel) && newLevel < 999) {
    newExp -= maxExpForLevel(newLevel);
    newLevel += 1;
    newMaxHp += HP_PER_HEART; // 每升一級多一顆愛心上限
  }
  return { level: newLevel, exp: newExp, maxHp: newMaxHp, hpGain: newMaxHp - maxHp };
}

export function statusFromHp(
  hp: number,
  maxHp: number,
): { key: "happy" | "normal" | "tired" | "hungry"; label: string; face: string } {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (hp <= 0) return { key: "hungry", label: "餓壞了", face: "😵" };
  if (ratio >= 0.8) return { key: "happy", label: "活力充沛", face: "😄" };
  if (ratio >= 0.4) return { key: "normal", label: "心情普通", face: "🙂" };
  return { key: "tired", label: "有點疲憊", face: "😪" };
}

/** 以 Asia/Taipei（UTC+8）今日起點為界，判斷某時間是否落在「今天」——與簽到發放邏輯一致。 */
export function isCheckedInToday(last: Date | null, now: Date = new Date()): boolean {
  if (!last) return false;
  const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
  const startOfTodayTaipei = new Date(
    Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth(), taipei.getUTCDate()) -
      8 * 3600 * 1000,
  );
  return last.getTime() >= startOfTodayTaipei.getTime();
}
