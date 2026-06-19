import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory, users } from "@/db/schema";
import { getOrCreatePet, statusFromHp, petTitle, maxExpForLevel } from "@/lib/pet";
import { readLevelUpSignal } from "@/lib/level-up-signal";
import { feedPet } from "@/app/(app)/pet/actions";
import PetMascot from "@/components/PetMascot";
import LevelUpToast from "@/components/LevelUpToast";

export default async function PetFeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pet = await getOrCreatePet(userId);
  const levelUp = await readLevelUpSignal();
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
      image: shopItems.image,
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
    )
    .orderBy(shopItems.sortOrder);

  // 愛心顯示與 Sidebar/HomeSidebar 一致：每 100 HP 一顆，上限隨 maxHp 成長
  const maxHearts = Math.max(1, Math.round(pet.maxHp / 100));
  const filledHearts = Math.min(maxHearts, Math.max(0, Math.floor(pet.hp / 100)));
  const isHungry = pet.hp <= Math.round(pet.maxHp * 0.35);
  const status = statusFromHp(pet.hp, pet.maxHp);
  const hpPercent = pet.maxHp > 0 ? Math.round((pet.hp / pet.maxHp) * 100) : 0;
  const expNeeded = maxExpForLevel(pet.level);
  const expPercent = expNeeded > 0 ? Math.min(100, Math.round((pet.exp / expNeeded) * 100)) : 0;
  const totalStock = foodRows.reduce((sum, f) => sum + f.quantity, 0);

  return (
    <div className="flex flex-col flex-1 min-h-[calc(100vh-220px)] relative overflow-x-hidden">
      <LevelUpToast
        initialLevel={levelUp?.newLevel ?? null}
        initialLevels={levelUp?.levels ?? null}
      />

      {/* Status capsule: level/title, hearts, coins */}
      <div className="flex flex-wrap items-center gap-sm sm:gap-md mb-md bg-surface-container-low/80 backdrop-blur-sm py-sm px-md rounded-full border border-surface-container-high w-fit max-w-full shadow-sm animate-fade-in-up">
        <span className="flex items-center gap-xs rounded-full bg-primary-container text-on-primary-container px-sm py-xs font-label-md text-label-md font-bold">
          <span className="material-symbols-outlined text-[16px] icon-fill" aria-hidden>
            military_tech
          </span>
          Lv.{pet.level}・{petTitle(pet.level)}
        </span>
        <div className="hidden sm:block w-px h-4 bg-outline-variant" aria-hidden></div>
        <div className="flex items-center gap-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">生命值</span>
          <div className="flex text-error" aria-label={`生命值 ${pet.hp}/${pet.maxHp}`}>
            {Array.from({ length: maxHearts }).map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: `'FILL' ${i < filledHearts ? 1 : 0}` }}
              >
                favorite
              </span>
            ))}
          </div>
        </div>
        <div className="hidden sm:block w-px h-4 bg-outline-variant" aria-hidden></div>
        <div className="flex items-center gap-sm">
          <div className="w-6 h-6 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center shrink-0">
            <span
              aria-hidden
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monetization_on
            </span>
          </div>
          <span className="font-body-lg text-body-lg text-on-surface font-bold tabular-nums">
            {pet.coins}
          </span>
        </div>
      </div>

      {/* Central Hero: Virtual Pet */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[40vh] md:min-h-[50vh] mb-xl animate-fade-in-up">
        {/* Ambient Background Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[260px] h-[260px] md:w-[500px] md:h-[500px] rounded-full bg-primary-fixed blur-3xl"></div>
        </div>
        {/* Pet Container：以真實 petStyle + 已穿戴配件渲染，讓商城購買/穿戴有可見效果 */}
        <div className="relative mb-md anim-float z-10">
          <PetMascot
            petStyle={me?.petStyle ?? "classic"}
            face={status.face}
            equippedHat={pet.equippedHat}
            equippedBackground={pet.equippedBackground}
            equippedRareStyle={pet.equippedRareStyle}
            large
          />
          {/* Base Shadow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 sm:w-48 h-8 bg-black/10 blur-xl rounded-full z-0"></div>
        </div>

        {/* Mood chip */}
        <span
          className={`z-10 inline-flex items-center gap-xs rounded-full px-md py-xs font-label-md text-label-md font-bold ${
            isHungry
              ? "bg-error-container text-on-error-container"
              : "bg-secondary-container text-on-secondary-container"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            {isHungry ? "restaurant" : "mood"}
          </span>
          {status.label}
        </span>

        <h1 className="font-headline-lg text-headline-lg text-on-surface mt-sm z-10 text-center text-balance">
          {isHungry ? "學習夥伴肚子餓了！" : `${pet.name} 活力滿滿！`}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant z-10 mt-xs text-center">
          從背包中選擇食物進行餵食。
        </p>

        {/* HP & EXP progress */}
        <div className="z-10 mt-md w-full max-w-sm flex flex-col gap-sm">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-xs">
                <span className="material-symbols-outlined text-[14px] icon-fill text-error" aria-hidden>
                  favorite
                </span>
                生命值
              </span>
              <span className="font-label-md text-label-md text-on-surface tabular-nums">
                {pet.hp}/{pet.maxHp}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="hp-bar h-full rounded-full" style={{ width: `${hpPercent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-xs">
                <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden>
                  trending_up
                </span>
                經驗值
              </span>
              <span className="font-label-md text-label-md text-on-surface tabular-nums">
                {pet.exp}/{expNeeded}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="exp-bar h-full rounded-full" style={{ width: `${expPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Interaction Area: Food Inventory */}
      <div className="w-full mt-auto bg-surface-container-lowest/70 dark:bg-surface-container-high/70 backdrop-blur-md rounded-[24px] p-md sm:p-lg shadow-sm border border-surface-container-high relative z-20">
        <div className="flex justify-between items-center gap-sm mb-md">
          <div className="flex items-center gap-sm min-w-0">
            <h2 className="font-headline-md text-headline-md text-on-surface">食物背包</h2>
            {totalStock > 0 && (
              <span className="shrink-0 rounded-full bg-surface-container-high px-sm py-xs font-label-md text-label-md text-on-surface-variant tabular-nums">
                {totalStock} 份
              </span>
            )}
          </div>
          <Link
            className="font-label-md text-label-md text-primary hover:text-primary-fixed transition-colors flex items-center gap-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full px-2 py-1"
            href="/shop"
          >
            前往商城
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </div>
        {/* Horizontal Scrollable Tray */}
        <div className="flex overflow-x-auto gap-md pb-xs hide-scrollbar snap-x snap-mandatory">
          {foodRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-lg text-center w-full gap-sm">
              <span
                className="material-symbols-outlined text-[48px] text-on-surface-variant/60"
                aria-hidden
              >
                shopping_bag
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
                背包目前沒有食物，餵食前請先前往商城購買喔。
              </p>
              <Link
                href="/shop"
                className="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-surface-tint transition-all mt-2 inline-flex items-center gap-1 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  storefront
                </span>
                前往寵物商城購買
              </Link>
            </div>
          ) : (
            foodRows.map((f) => (
              <div
                key={f.itemId}
                className="flex-shrink-0 w-32 md:w-40 bg-surface rounded-xl p-sm flex flex-col items-center justify-between shadow-sm border border-surface-container-low hover:shadow-md transition-shadow snap-center group"
              >
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg bg-surface-container-lowest flex items-center justify-center p-2 mb-sm overflow-hidden">
                  {f.image ? (
                    // 與商城同一張商品圖：購買後在背包仍顯示圖片，不退回 emoji 文字
                    <img
                      alt={f.name}
                      src={f.image}
                      className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <span className="text-4xl md:text-5xl group-hover:scale-110 transition-transform duration-300">
                      {f.icon}
                    </span>
                  )}
                  <span className="absolute top-1 right-1 rounded-full bg-surface-container-high/90 px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant tabular-nums">
                    ×{f.quantity}
                  </span>
                </div>
                <span className="font-label-md text-label-md text-on-surface text-center mb-1 line-clamp-1 w-full">
                  {f.name}
                </span>
                <div className="mb-sm flex flex-wrap items-center justify-center gap-1">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-error/10 px-1.5 py-0.5 text-[11px] font-medium text-error">
                    <span className="material-symbols-outlined text-[12px] icon-fill" aria-hidden>
                      favorite
                    </span>
                    +{f.hpRestore}
                  </span>
                  {f.expGain > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      <span className="material-symbols-outlined text-[12px]" aria-hidden>
                        trending_up
                      </span>
                      +{f.expGain}
                    </span>
                  )}
                </div>
                <form action={feedPet} className="w-full">
                  <input type="hidden" name="itemId" value={f.itemId} />
                  <button
                    type="submit"
                    className="w-full bg-primary text-on-primary font-label-md text-label-md py-2 rounded-lg hover:bg-surface-tint active:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    餵食
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
