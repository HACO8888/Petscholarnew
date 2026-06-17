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

/** 套用經驗值並處理升級（exp 溢出進位、maxHp 隨等級提升） */
export function applyExp(
  level: number,
  exp: number,
  maxHp: number,
  gained: number,
): { level: number; exp: number; maxHp: number } {
  let newLevel = level;
  let newExp = exp + gained;
  let newMaxHp = maxHp;
  while (newExp >= maxExpForLevel(newLevel)) {
    newExp -= maxExpForLevel(newLevel);
    newLevel += 1;
    newMaxHp += HP_PER_HEART; // 每升一級多一顆愛心上限
  }
  return { level: newLevel, exp: newExp, maxHp: newMaxHp };
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

export function isSameDay(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
