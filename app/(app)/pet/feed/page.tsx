import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { feedPet } from "@/app/(app)/pet/actions";

export default async function PetFeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pet = await getOrCreatePet(userId);

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
    )
    .orderBy(shopItems.sortOrder);

  const hpRatio = pet.maxHp > 0 ? pet.hp / pet.maxHp : 0;
  const filledHearts = Math.max(
    0,
    Math.min(5, pet.hp > 0 ? Math.round(hpRatio * 5) : 0),
  );
  const isHungry = pet.hp <= Math.round(pet.maxHp * 0.35);

  return (
    <main className="flex-1 px-margin-mobile md:px-margin-desktop py-lg md:py-xl flex flex-col min-h-[calc(100vh-64px)] relative overflow-x-hidden">
      {/* HP + Coins capsule */}
      <div className="flex flex-wrap items-center gap-sm sm:gap-lg mb-md bg-surface-container-low/80 backdrop-blur-sm py-sm px-md rounded-full border border-surface-container-high w-fit max-w-full shadow-sm animate-fade-in-up">
        <div className="flex items-center gap-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">
            生命值
          </span>
          <div className="flex text-error" aria-label={`生命值 ${pet.hp}/${pet.maxHp}`}>
            {Array.from({ length: 5 }).map((_, i) => (
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
        <div className="hidden sm:block w-px h-4 bg-outline-variant"></div>
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
          <span className="font-body-lg text-body-lg text-on-surface font-bold">
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
        {/* Pet Container */}
        <div className="relative mb-md">
          { }
          <img
            alt={`${pet.name} 學習夥伴`}
            className="w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 object-contain drop-shadow-2xl transition-transform duration-300 ease-out z-10 relative"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsgDFI3t3murIaM6LOyFuTo2_5VHcIaiGOOxU0-PLU4CeH-5Dq6AfqSxv1wurTlkINBEkjz3ROkehz_BP9JDQDYKhMgtQsSuV4qf22TgBjMkdUvAVZJCJDNLwIiQD-mteBWz19UYrAwFyozhkJubz2OMR1JQLLDHYwlZGhijDzKdr7Bkp0bfKe-140PEddCVCLL2armwnpExwowHhCES0Y_6aUm4g8L3ntD8ylaPmAu16aH-Bqwi_5ySO0IV8lu-s60PLWTOrvKION"
          />
          {/* Base Shadow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 sm:w-48 h-8 bg-black/10 blur-xl rounded-full z-0"></div>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mt-sm z-10 text-center text-balance">
          {isHungry ? "學習夥伴肚子餓了！" : `${pet.name} 活力滿滿！`}
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant z-10 mt-xs text-center">
          從背包中選擇食物進行餵食。 (HP: {pet.hp}/{pet.maxHp})
        </p>
      </div>

      {/* Interaction Area: Food Inventory */}
      <div className="w-full mt-auto bg-surface-container-lowest/70 dark:bg-surface-container-high/70 backdrop-blur-md rounded-[24px] p-md sm:p-lg shadow-sm border border-surface-container-high relative z-20">
        <div className="flex justify-between items-center gap-sm mb-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">食物背包</h2>
          <Link
            className="font-label-md text-label-md text-primary hover:text-primary-fixed transition-colors flex items-center gap-1 shrink-0"
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
                背包目前沒有食物，餵食前請先前往商城購買喔！
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
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-surface-container-lowest flex items-center justify-center p-2 mb-sm overflow-hidden">
                  <span className="text-4xl md:text-5xl group-hover:scale-110 transition-transform duration-300">
                    {f.icon}
                  </span>
                </div>
                <span className="font-label-md text-label-md text-on-surface text-center mb-1 line-clamp-1 w-full">
                  {f.name}
                </span>
                <span className="text-[11px] leading-tight text-on-surface-variant text-center mb-sm">
                  +{f.hpRestore} HP
                  {f.expGain > 0 ? ` · +${f.expGain} EXP` : ""} · 庫存 {f.quantity}
                </span>
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
    </main>
  );
}
