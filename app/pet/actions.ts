"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pets, shopItems, inventory } from "@/db/schema";
import { getOrCreatePet, applyExp, isSameDay, CHECKIN_REWARD } from "@/lib/pet";

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

  const pet = await getOrCreatePet(userId);
  if (pet.coins < item.price) throw new Error("金幣不足");

  await db
    .update(pets)
    .set({ coins: pet.coins - item.price, updatedAt: new Date() })
    .where(eq(pets.userId, userId));

  await db
    .insert(inventory)
    .values({ userId, itemId, quantity: 1 })
    .onConflictDoUpdate({
      target: [inventory.userId, inventory.itemId],
      set: { quantity: sql`${inventory.quantity} + 1` },
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

  // 原子扣除一份庫存
  const consumed = await db
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

  const pet = await getOrCreatePet(userId);
  const newHp = Math.min(pet.maxHp, pet.hp + item.hpRestore);
  const leveled = applyExp(pet.level, pet.exp, pet.maxHp, item.expGain);
  const cappedHp = Math.min(newHp, leveled.maxHp);

  await db
    .update(pets)
    .set({
      hp: cappedHp,
      exp: leveled.exp,
      level: leveled.level,
      maxHp: leveled.maxHp,
      updatedAt: new Date(),
    })
    .where(eq(pets.userId, userId));

  revalidatePetPages();
}

export async function claimCheckin() {
  const userId = await requireUserId();
  const pet = await getOrCreatePet(userId);
  const now = new Date();
  if (isSameDay(pet.lastCheckIn, now)) {
    return; // 今天已簽到
  }
  await db
    .update(pets)
    .set({ coins: pet.coins + CHECKIN_REWARD, lastCheckIn: now, updatedAt: now })
    .where(eq(pets.userId, userId));
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
  const pet = await getOrCreatePet(userId);
  if (pet.coins < HEAL_COST) throw new Error("金幣不足");

  await db
    .update(pets)
    .set({ hp: pet.maxHp, coins: pet.coins - HEAL_COST, updatedAt: new Date() })
    .where(eq(pets.userId, userId));

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
