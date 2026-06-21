import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { pets } from "@/db/schema";
import type { Pet } from "@/db/schema";

export const HP_PER_HEART = 100;
export const CHECKIN_REWARD = 20;
// 飢餓衰減：未餵食時每滿一小時扣 20 點生命值（滿血 500 約 25 小時歸零）。
export const HP_DECAY_PER_HOUR = 20;
const HP_DECAY_INTERVAL_MS = 60 * 60 * 1000;

/**
 * 依「距上次餵食的實際經過時間」計算飢餓衰減（純函式，不碰 DB，可於任何顯示處重算）。
 * 錨點與現在皆為 epoch 毫秒。以整數小時結算：每滿一小時扣 HP_DECAY_PER_HOUR，
 * 不足一小時的餘數保留到下次；HP 最低 0。
 * 回傳衰減後 hp、前進後的錨點（ms）、以及本次實際扣掉的量 decayed。
 */
export function applyHpDecay(
  hp: number,
  hpUpdatedAtMs: number,
  nowMs: number = Date.now(),
): { hp: number; hpUpdatedAtMs: number; decayed: number } {
  const hours = Math.floor((nowMs - hpUpdatedAtMs) / HP_DECAY_INTERVAL_MS);
  if (!hpUpdatedAtMs || hours <= 0 || hp <= 0) {
    return { hp: Math.max(0, hp), hpUpdatedAtMs, decayed: 0 };
  }
  const newHp = Math.max(0, hp - hours * HP_DECAY_PER_HOUR);
  // 錨點只前進「已結算的整數小時」，保留不足一小時的餘數繼續累積
  const newAnchorMs = hpUpdatedAtMs + hours * HP_DECAY_INTERVAL_MS;
  return { hp: newHp, hpUpdatedAtMs: newAnchorMs, decayed: hp - newHp };
}

/**
 * 將飢餓衰減落地寫回 DB。回傳套用衰減後的最新寵物狀態。
 * 用 lt(錨點 < 新錨點) 做條件式寫入：整數比較精確，且能擋下過期讀的覆蓋
 * （例如另一請求已餵食把錨點推到更新的時間時，本次過期計算不會蓋回去）。
 */
async function persistHpDecay(pet: Pet): Promise<Pet> {
  // 尚未錨定（理論上不會發生：新寵物 insert 即帶現在時間、現有列已回填）：補為現在當作剛餵食
  if (!pet.hpUpdatedAt) {
    const nowMs = Date.now();
    await db
      .update(pets)
      .set({ hpUpdatedAt: nowMs })
      .where(and(eq(pets.userId, pet.userId), eq(pets.hpUpdatedAt, 0)));
    return { ...pet, hpUpdatedAt: nowMs };
  }

  const decayed = applyHpDecay(pet.hp, pet.hpUpdatedAt);
  if (decayed.decayed <= 0) return pet;
  await db
    .update(pets)
    .set({ hp: decayed.hp, hpUpdatedAt: decayed.hpUpdatedAtMs, updatedAt: new Date() })
    .where(and(eq(pets.userId, pet.userId), lt(pets.hpUpdatedAt, decayed.hpUpdatedAtMs)));
  return { ...pet, hp: decayed.hp, hpUpdatedAt: decayed.hpUpdatedAtMs };
}

/** 取得使用者寵物（不存在則建立並錨定現在），並先套用飢餓衰減後再回傳。 */
export async function getOrCreatePet(userId: string): Promise<Pet> {
  const [existing] = await db
    .select()
    .from(pets)
    .where(eq(pets.userId, userId))
    .limit(1);
  if (existing) return persistHpDecay(existing);

  // 新寵物：錨點設為現在，避免一建立就被當成長期未餵食而扣血
  await db
    .insert(pets)
    .values({ userId, hpUpdatedAt: Date.now() })
    .onConflictDoNothing();
  const [created] = await db
    .select()
    .from(pets)
    .where(eq(pets.userId, userId))
    .limit(1);
  return created;
}

/**
 * 升到「下一級」所需的經驗（溫和遞增曲線）。
 * 公式：100 + (level - 1) * 50 → Lv1 需 100、Lv2 需 150、Lv3 需 200…每級多 50。
 * 比原本固定 level×100 更平滑，前期好升、後期需累積，避免升級門檻陡升。
 */
export function maxExpForLevel(level: number): number {
  const lv = Math.max(1, level);
  return 100 + (lv - 1) * 50;
}

/** 升級獎勵金幣：每升一級發放 20 × 新等級（等級越高、單級獎勵越多）。 */
export function levelUpCoinReward(newLevel: number): number {
  return 20 * newLevel;
}

/**
 * 套用經驗值並處理升級（exp 溢出進位、maxHp 隨等級提升、連升多級的金幣獎勵累加）。
 * - hpGain＝本次升級新增的 maxHp 量，呼叫端應把它補進當前 HP，
 *   否則升級瞬間會多出一顆空心、HP 比例不升反降（升級看起來像退步）。
 * - levelsGained＝本次一共升了幾級（前端用來顯示慶祝提示）。
 * - coinReward＝本次所有升級的金幣獎勵總和（連升多級會逐級累加）。
 */
export function applyExp(
  level: number,
  exp: number,
  maxHp: number,
  gained: number,
): {
  level: number;
  exp: number;
  maxHp: number;
  hpGain: number;
  levelsGained: number;
  coinReward: number;
} {
  const startLevel = Math.max(1, level);
  let newLevel = startLevel;
  let newExp = exp + Math.max(0, gained);
  let newMaxHp = maxHp;
  let coinReward = 0;
  // 上限保護：避免異常大的輸入造成過多迴圈
  while (newExp >= maxExpForLevel(newLevel) && newLevel < 999) {
    newExp -= maxExpForLevel(newLevel);
    newLevel += 1;
    newMaxHp += HP_PER_HEART; // 每升一級多一顆愛心上限
    coinReward += levelUpCoinReward(newLevel); // 逐級累加升級金幣獎勵
  }
  return {
    level: newLevel,
    exp: newExp,
    maxHp: newMaxHp,
    hpGain: newMaxHp - maxHp,
    levelsGained: newLevel - startLevel,
    coinReward,
  };
}

/**
 * 等級頭銜：依寵物等級回傳學術頭銜，於側邊欄／個人檔案／排行榜等級旁顯示。
 * 1–2 學習新芽、3–5 勤學者、6–9 學霸、10+ 學術大師。
 */
export function petTitle(level: number): string {
  if (level >= 10) return "學術大師";
  if (level >= 6) return "學霸";
  if (level >= 3) return "勤學者";
  return "學習新芽";
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
