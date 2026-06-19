"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pets, shopItems, inventory } from "@/db/schema";
import { getOrCreatePet, applyExp, CHECKIN_REWARD } from "@/lib/pet";
import { setLevelUpSignal } from "@/lib/level-up-signal";

function revalidatePetPages() {
  revalidatePath("/pet/feed");
  revalidatePath("/shop");
  revalidatePath("/profile");
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function buyItem(formData: FormData) {
  const userId = await requireUserId();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) throw new Error("缺少商品");

  const [item] = await db
    .select()
    .from(shopItems)
    .where(eq(shopItems.id, itemId))
    .limit(1);
  if (!item) throw new Error("商品不存在");

  const pet = await getOrCreatePet(userId); // 確保錢包存在
  // 等級解鎖：server 端把關，不信任 UI 隱藏鈕；未達門檻直接拒絕。
  if (item.minLevel > 0 && pet.level < item.minLevel) {
    throw new Error(`需寵物等級 Lv.${item.minLevel} 才能購買`);
  }

  await db.transaction(async (tx) => {
    // 配件為一次性物品：已擁有則禁止重複購買（server 端把關，不信任 UI 隱藏鈕）
    if (item.accessoryType) {
      const [owned] = await tx
        .select({ qty: inventory.quantity })
        .from(inventory)
        .where(and(eq(inventory.userId, userId), eq(inventory.itemId, itemId)))
        .limit(1);
      if (owned && owned.qty > 0) throw new Error("已擁有此配件");
    }

    // 原子條件式扣款：唯有餘額足夠且等級達標的列才會被更新，杜絕並發雙重消費 / 負餘額 / 繞過等級鎖
    const debited = await tx
      .update(pets)
      .set({ coins: sql`${pets.coins} - ${item.price}`, updatedAt: new Date() })
      .where(
        and(
          eq(pets.userId, userId),
          gte(pets.coins, item.price),
          gte(pets.level, item.minLevel),
        ),
      )
      .returning({ coins: pets.coins });
    if (debited.length === 0) throw new Error("金幣不足或等級不足");

    await tx
      .insert(inventory)
      .values({ userId, itemId, quantity: 1 })
      .onConflictDoUpdate({
        target: [inventory.userId, inventory.itemId],
        set: { quantity: sql`${inventory.quantity} + 1` },
      });
  });

  revalidatePetPages();
}

export async function feedPet(formData: FormData) {
  const userId = await requireUserId();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) throw new Error("缺少食物");

  const [item] = await db
    .select()
    .from(shopItems)
    .where(eq(shopItems.id, itemId))
    .limit(1);
  if (!item || item.type !== "food") throw new Error("此物品無法餵食");

  await getOrCreatePet(userId); // 確保寵物存在

  const levelUp = await db.transaction(async (tx) => {
    // 原子扣除一份庫存
    const consumed = await tx
      .update(inventory)
      .set({ quantity: sql`${inventory.quantity} - 1` })
      .where(
        and(
          eq(inventory.userId, userId),
          eq(inventory.itemId, itemId),
          gt(inventory.quantity, 0),
        ),
      )
      .returning({ quantity: inventory.quantity });
    if (consumed.length === 0) throw new Error("庫存不足");

    // 鎖定寵物列，避免並發餵食造成成長 lost-update
    const [pet] = await tx
      .select()
      .from(pets)
      .where(eq(pets.userId, userId))
      .for("update");
    if (!pet) throw new Error("寵物不存在");

    const leveled = applyExp(pet.level, pet.exp, pet.maxHp, item.expGain);
    // 升級新增的上限（hpGain）也補進當前 HP，避免升級瞬間多出空心、HP 比例下降
    const newHp = Math.min(leveled.maxHp, pet.hp + item.hpRestore + leveled.hpGain);

    await tx
      .update(pets)
      .set({
        hp: newHp,
        exp: leveled.exp,
        level: leveled.level,
        maxHp: leveled.maxHp,
        // 升級獎勵金幣：每升一級 +20×新等級（連升多級已逐級累加）
        coins: sql`${pets.coins} + ${leveled.coinReward}`,
        updatedAt: new Date(),
      })
      .where(eq(pets.userId, userId));

    return leveled.levelsGained > 0
      ? { level: leveled.level, levels: leveled.levelsGained }
      : null;
  });

  if (levelUp) await setLevelUpSignal(levelUp.level, levelUp.levels);
  revalidatePetPages();
}

export async function claimCheckin() {
  const userId = await requireUserId();
  await getOrCreatePet(userId);
  const now = new Date();
  // 以台灣時區（Asia/Taipei = 固定 UTC+8）計算「今天」起點，避免 server UTC 造成的翻日誤差
  const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
  const startOfTodayTaipei = new Date(
    Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth(), taipei.getUTCDate()) -
      8 * 3600 * 1000,
  );
  // 原子條件式：唯有今天尚未簽到（lastCheckIn 為空或早於今日起點）的列才會被更新並發獎
  const res = await db
    .update(pets)
    .set({ coins: sql`${pets.coins} + ${CHECKIN_REWARD}`, lastCheckIn: now, updatedAt: now })
    .where(
      and(
        eq(pets.userId, userId),
        or(isNull(pets.lastCheckIn), lt(pets.lastCheckIn, startOfTodayTaipei)),
      ),
    )
    .returning({ userId: pets.userId });
  if (res.length === 0) return; // 今天已簽到
  revalidatePetPages();
}

/** 時間流逝：HP 隨時間下降（最低 0），餓了就要餵
 *  注意："use server" 檔案只能 export async function，故常數不可 export。 */
const TIME_PASS_HP_LOSS = 50;

export async function simulateTimePass() {
  const userId = await requireUserId();
  const pet = await getOrCreatePet(userId);
  const newHp = Math.max(0, pet.hp - TIME_PASS_HP_LOSS);

  await db
    .update(pets)
    .set({ hp: newHp, updatedAt: new Date() })
    .where(eq(pets.userId, userId));

  revalidatePetPages();
}

/** 治療寵物：花費金幣把 HP 補滿至 maxHp（金幣不足則 throw） */
const HEAL_COST = 20;

export async function healPet() {
  const userId = await requireUserId();
  await getOrCreatePet(userId); // 確保寵物存在
  // 原子條件式：補滿 HP 並扣費，唯有金幣足夠的列才更新 → 杜絕並發雙重治療 / 負餘額
  const res = await db
    .update(pets)
    .set({ hp: sql`${pets.maxHp}`, coins: sql`${pets.coins} - ${HEAL_COST}`, updatedAt: new Date() })
    .where(and(eq(pets.userId, userId), gte(pets.coins, HEAL_COST)))
    .returning({ userId: pets.userId });
  if (res.length === 0) throw new Error("金幣不足");

  revalidatePetPages();
}

export async function toggleEquip(formData: FormData) {
  const userId = await requireUserId();
  const accessoryType = String(formData.get("accessoryType") ?? "");
  const column =
    accessoryType === "hat"
      ? "equippedHat"
      : accessoryType === "background"
        ? "equippedBackground"
        : accessoryType === "rareStyle"
          ? "equippedRareStyle"
          : null;
  if (!column) throw new Error("未知配件");

  // 必須擁有該類型配件
  const owned = await db
    .select({ qty: inventory.quantity })
    .from(inventory)
    .innerJoin(shopItems, eq(inventory.itemId, shopItems.id))
    .where(
      and(
        eq(inventory.userId, userId),
        eq(shopItems.accessoryType, accessoryType),
        gt(inventory.quantity, 0),
      ),
    )
    .limit(1);
  if (owned.length === 0) throw new Error("尚未擁有此配件");

  const pet = await getOrCreatePet(userId);
  const current = pet[column];
  await db
    .update(pets)
    .set({ [column]: !current, updatedAt: new Date() })
    .where(eq(pets.userId, userId));

  revalidatePetPages();
}
