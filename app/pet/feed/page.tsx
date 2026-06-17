import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, shopItems, inventory } from "@/db/schema";
import {
  getOrCreatePet,
  statusFromHp,
  maxExpForLevel,
  isSameDay,
  CHECKIN_REWARD,
} from "@/lib/pet";
import PetMascot from "@/components/PetMascot";
import HeartBar from "@/components/HeartBar";
import { feedPet, claimCheckin, toggleEquip } from "@/app/pet/actions";

export default async function PetFeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pet = await getOrCreatePet(userId);
  const [me] = await db
    .select({ petStyle: users.petStyle })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const foodRows = await db
    .select({
      itemId: inventory.itemId,
      quantity: inventory.quantity,
      name: shopItems.name,
      icon: shopItems.icon,
      hpRestore: shopItems.hpRestore,
      expGain: shopItems.expGain,
    })
    .from(inventory)
    .innerJoin(shopItems, eq(inventory.itemId, shopItems.id))
    .where(
      and(
        eq(inventory.userId, userId),
        eq(shopItems.type, "food"),
        gt(inventory.quantity, 0),
      ),
    );

  const accessoryRows = await db
    .select({
      accessoryType: shopItems.accessoryType,
      name: shopItems.name,
      icon: shopItems.icon,
    })
    .from(inventory)
    .innerJoin(shopItems, eq(inventory.itemId, shopItems.id))
    .where(
      and(
        eq(inventory.userId, userId),
        eq(shopItems.type, "accessory"),
        gt(inventory.quantity, 0),
      ),
    );

  const status = statusFromHp(pet.hp, pet.maxHp);
  const maxExp = maxExpForLevel(pet.level);
  const expPct = Math.min(100, Math.round((pet.exp / maxExp) * 100));
  const checkedIn = isSameDay(pet.lastCheckIn, new Date());
  const equippedMap: Record<string, boolean> = {
    hat: pet.equippedHat,
    background: pet.equippedBackground,
    rareStyle: pet.equippedRareStyle,
  };

  return (
    <section className="max-w-3xl">
      <h1 className="mb-lg text-headline-lg font-semibold text-on-background">寵物餵食</h1>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 dark:bg-surface-container sm:flex-row sm:items-start">
        <PetMascot
          petStyle={me?.petStyle ?? "classic"}
          face={status.face}
          equippedHat={pet.equippedHat}
          equippedBackground={pet.equippedBackground}
          equippedRareStyle={pet.equippedRareStyle}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-headline-md font-semibold text-on-background">{pet.name}</h2>
            <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-md font-medium text-on-primary-container">
              Lv.{pet.level}
            </span>
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant">
              {status.label}
            </span>
          </div>

          <div className="mt-3">
            <HeartBar hp={pet.hp} maxHp={pet.maxHp} />
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-label-md text-secondary">
              <span>經驗值</span>
              <span>{pet.exp} / {maxExp}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full bg-tertiary transition-all" style={{ width: `${expPct}%` }} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-body-md font-semibold text-on-background">
              <span className="material-symbols-outlined text-[18px] text-tertiary">paid</span>
              {pet.coins} 金幣
            </span>
            <form action={claimCheckin}>
              <button
                type="submit"
                disabled={checkedIn}
                className="rounded-full bg-primary px-4 py-1.5 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint disabled:opacity-50"
              >
                {checkedIn ? "今日已簽到" : `每日簽到 +${CHECKIN_REWARD}`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 餵食：庫存食物 */}
      <div className="mt-6">
        <h2 className="mb-3 text-body-lg font-semibold text-on-background">餵食（我的食物）</h2>
        {foodRows.length === 0 ? (
          <p className="text-body-md text-secondary">
            還沒有食物，先去 <Link href="/shop" className="text-primary hover:underline">寵物商城</Link> 買一些吧！
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            {foodRows.map((f) => (
              <div
                key={f.itemId}
                className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 dark:bg-surface-container"
              >
                <span className="text-3xl">{f.icon}</span>
                <div className="flex-1">
                  <p className="text-body-md font-semibold text-on-background">{f.name}</p>
                  <p className="text-label-md text-secondary">
                    +{f.hpRestore} HP · +{f.expGain} EXP · 庫存 {f.quantity}
                  </p>
                </div>
                <form action={feedPet}>
                  <input type="hidden" name="itemId" value={f.itemId} />
                  <button
                    type="submit"
                    className="rounded-full bg-primary px-4 py-1.5 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint"
                  >
                    餵食
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 配件裝備 */}
      {accessoryRows.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-body-lg font-semibold text-on-background">配件裝備</h2>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            {accessoryRows.map((a) => {
              const equipped = a.accessoryType ? equippedMap[a.accessoryType] : false;
              return (
                <div
                  key={a.accessoryType}
                  className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 dark:bg-surface-container"
                >
                  <span className="text-3xl">{a.icon}</span>
                  <div className="flex-1">
                    <p className="text-body-md font-semibold text-on-background">{a.name}</p>
                  </div>
                  <form action={toggleEquip}>
                    <input type="hidden" name="accessoryType" value={a.accessoryType ?? ""} />
                    <button
                      type="submit"
                      className={`rounded-full px-4 py-1.5 text-label-md font-bold transition-all ${
                        equipped
                          ? "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                          : "bg-primary text-on-primary hover:bg-surface-tint"
                      }`}
                    >
                      {equipped ? "卸下" : "裝備"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
