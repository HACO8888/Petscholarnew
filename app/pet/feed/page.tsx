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

  // 生命值的滿心數（每顆心 = maxHp / 5）
  const heartFull = Math.round((pet.hp / pet.maxHp) * 5);

  return (
    <div className="relative flex flex-col">
      {/* 狀態膠囊：生命值 + 金幣 */}
      <div className="mb-md flex w-fit items-center gap-lg rounded-full border border-surface-container-high bg-surface-container-low/80 p-sm px-md shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-sm">
          <span className="text-label-md text-on-surface-variant">生命值</span>
          <div className="flex text-error">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: `'FILL' ${i < heartFull ? 1 : 0}` }}
              >
                favorite
              </span>
            ))}
          </div>
        </div>
        <div className="h-4 w-px bg-outline-variant" />
        <div className="flex items-center gap-sm">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monetization_on
            </span>
          </div>
          <span className="text-body-lg font-bold text-on-surface">{pet.coins}</span>
        </div>
      </div>

      {/* 中央英雄區：虛擬寵物 */}
      <div className="relative mb-xl flex min-h-[40vh] flex-1 flex-col items-center justify-center md:min-h-[50vh]">
        {/* 環境光暈 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
          <div className="h-[300px] w-[300px] rounded-full bg-primary-fixed blur-3xl md:h-[500px] md:w-[500px]" />
        </div>

        {/* 寵物容器 */}
        <div className="group relative mb-md">
          <div className="relative z-10 flex h-64 w-64 items-center justify-center md:h-80 md:w-80">
            <PetMascot
              petStyle={me?.petStyle ?? "classic"}
              face={status.face}
              equippedHat={pet.equippedHat}
              equippedBackground={pet.equippedBackground}
              equippedRareStyle={pet.equippedRareStyle}
            />
          </div>
          {/* 底部陰影 */}
          <div className="absolute bottom-0 left-1/2 z-0 h-8 w-48 -translate-x-1/2 rounded-full bg-black/10 blur-xl" />
        </div>

        <div className="z-10 mt-sm flex flex-wrap items-center justify-center gap-2 text-center">
          <h1 className="text-headline-lg font-semibold text-on-surface">{pet.name}</h1>
          <span className="rounded-full bg-primary-container px-3 py-0.5 text-label-md font-medium text-on-primary-container">
            Lv.{pet.level}
          </span>
          <span className="rounded-full bg-surface-container-high px-3 py-0.5 text-label-md text-on-surface-variant">
            {status.label}
          </span>
        </div>
        <p className="z-10 mt-xs text-center text-body-lg text-on-surface-variant">
          從背包中選擇食物進行餵食。
        </p>

        {/* 愛心條 + 經驗條 + 簽到 */}
        <div className="z-10 mt-md w-full max-w-md">
          <HeartBar hp={pet.hp} maxHp={pet.maxHp} />

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-label-md text-secondary">
              <span>經驗值</span>
              <span>
                {pet.exp} / {maxExp}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full bg-tertiary transition-all"
                style={{ width: `${expPct}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <form action={claimCheckin}>
              <button
                type="submit"
                disabled={checkedIn}
                className="rounded-full bg-primary px-4 py-1.5 text-label-md font-bold text-on-primary transition-colors hover:bg-surface-tint active:bg-secondary disabled:opacity-50"
              >
                {checkedIn ? "今日已簽到" : `每日簽到 +${CHECKIN_REWARD}`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 互動區：食物背包 */}
      <div
        className="relative z-20 mt-auto w-full rounded-[24px] border border-surface-container-high p-lg shadow-sm"
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div className="mb-md flex items-end justify-between">
          <h2 className="text-headline-md font-semibold text-on-surface">食物背包</h2>
          <Link
            className="flex items-center gap-1 text-label-md text-primary transition-colors hover:text-primary-fixed"
            href="/shop"
          >
            前往商城
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        {foodRows.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-sm p-4 py-lg text-center">
            <span
              className="material-symbols-outlined text-outline"
              style={{ fontSize: "48px" }}
            >
              shopping_bag
            </span>
            <p className="mt-2 text-body-md text-secondary">
              背包目前沒有食物，餵食需要先前往商城購買喔！
            </p>
            <Link
              href="/shop"
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-md py-sm text-label-md text-on-primary shadow-sm transition-all hover:bg-surface-tint"
            >
              <span className="material-symbols-outlined text-sm">storefront</span>
              前往寵物商城購買
            </Link>
          </div>
        ) : (
          <div
            className="flex snap-x snap-mandatory gap-md overflow-x-auto px-xs pb-xs"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {foodRows.map((f) => (
              <div
                key={f.itemId}
                className="group flex w-32 flex-shrink-0 snap-center flex-col items-center justify-between rounded-xl border border-surface-container-low bg-surface p-sm shadow-sm transition-shadow hover:shadow-md md:w-40"
              >
                <div className="mb-sm flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-surface-container-lowest p-2 text-4xl md:h-24 md:w-24 md:text-5xl">
                  <span className="transition-transform duration-300 group-hover:scale-110">
                    {f.icon}
                  </span>
                </div>
                <span className="mb-1 line-clamp-1 text-center text-label-md text-on-surface">
                  {f.name}
                </span>
                <span className="mb-sm text-center text-label-md text-secondary">
                  +{f.hpRestore} HP · +{f.expGain} EXP · x{f.quantity}
                </span>
                <form action={feedPet} className="w-full">
                  <input type="hidden" name="itemId" value={f.itemId} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-primary py-2 text-label-md font-bold text-on-primary transition-colors hover:bg-surface-tint active:bg-secondary"
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
        <div
          className="relative z-20 mt-md w-full rounded-[24px] border border-surface-container-high p-lg shadow-sm"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <h2 className="mb-md text-headline-md font-semibold text-on-surface">配件裝備</h2>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            {accessoryRows.map((a) => {
              const equipped = a.accessoryType ? equippedMap[a.accessoryType] : false;
              return (
                <div
                  key={a.accessoryType}
                  className="flex items-center gap-3 rounded-xl border border-surface-container-low bg-surface p-4 shadow-sm"
                >
                  <span className="text-3xl">{a.icon}</span>
                  <div className="flex-1">
                    <p className="text-body-md font-semibold text-on-surface">{a.name}</p>
                  </div>
                  <form action={toggleEquip}>
                    <input
                      type="hidden"
                      name="accessoryType"
                      value={a.accessoryType ?? ""}
                    />
                    <button
                      type="submit"
                      className={`rounded-full px-4 py-1.5 text-label-md font-bold transition-colors ${
                        equipped
                          ? "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                          : "bg-primary text-on-primary hover:bg-surface-tint active:bg-secondary"
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
    </div>
  );
}
