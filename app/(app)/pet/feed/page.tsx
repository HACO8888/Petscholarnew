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

  const heartCount = Math.max(0, Math.min(5, Math.ceil((pet.hp / pet.maxHp) * 5)));

  return (
    <main className="flex-1 px-margin-mobile md:px-margin-desktop py-lg md:py-xl flex flex-col min-h-[calc(100vh-64px)] relative">
      {/* HP + Coins capsule */}
      <div className="flex items-center gap-lg mb-md bg-surface-container-low/80 backdrop-blur-sm p-sm px-md rounded-full border border-surface-container-high w-fit shadow-sm animate-fade-in-up">
        <div className="flex items-center gap-sm">
          <span className="font-label-md text-on-surface-variant">生命值</span>
          <div className="flex text-error">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: `'FILL' ${i < heartCount ? 1 : 0}` }}
              >
                favorite
              </span>
            ))}
          </div>
        </div>
        <div className="w-px h-4 bg-outline-variant"></div>
        <div className="flex items-center gap-sm">
          <div className="w-6 h-6 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monetization_on
            </span>
          </div>
          <span className="font-body-lg text-on-surface font-bold">{pet.coins}</span>
        </div>
      </div>

      {/* Central Hero: Virtual Pet */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[40vh] md:min-h-[50vh] mb-xl animate-fade-in-up -translate-x-1/2 left-1/2">
        {/* Ambient Background Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full bg-primary-fixed blur-3xl"></div>
        </div>
        {/* Pet Container */}
        <div className="relative group cursor-pointer mb-md">
          { }
          <img
            alt="Study Buddy"
            className="w-64 h-64 md:w-80 md:h-80 object-contain drop-shadow-2xl transition-transform duration-300 ease-out z-10 relative"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsgDFI3t3murIaM6LOyFuTo2_5VHcIaiGOOxU0-PLU4CeH-5Dq6AfqSxv1wurTlkINBEkjz3ROkehz_BP9JDQDYKhMgtQsSuV4qf22TgBjMkdUvAVZJCJDNLwIiQD-mteBWz19UYrAwFyozhkJubz2OMR1JQLLDHYwlZGhijDzKdr7Bkp0bfKe-140PEddCVCLL2armwnpExwowHhCES0Y_6aUm4g8L3ntD8ylaPmAu16aH-Bqwi_5ySO0IV8lu-s60PLWTOrvKION"
          />
          {/* Base Shadow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-black/10 blur-xl rounded-full z-0"></div>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mt-sm z-10 text-center">
          {pet.hp <= Math.round(pet.maxHp * 0.35)
            ? "學習夥伴肚子餓了！"
            : `${pet.name}活力滿滿！`}
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant z-10 mt-xs text-center">
          從背包中選擇食物進行餵食。 (HP: {pet.hp}/{pet.maxHp})
        </p>
      </div>

      {/* Interaction Area: Food Inventory */}
      <div className="w-full mt-auto bg-surface-container-lowest/70 dark:bg-surface-container-high/70 backdrop-blur-md rounded-[24px] p-lg shadow-sm border border-surface-container-high relative z-20">
        <div className="flex justify-between items-end mb-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">食物背包</h2>
          <Link
            className="font-label-md text-label-md text-primary hover:text-primary-fixed transition-colors flex items-center gap-1"
            href="/shop"
          >
            前往商城{" "}
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
        {/* Horizontal Scrollable Tray */}
        <div className="flex overflow-x-auto gap-md pb-xs hide-scrollbar snap-x snap-mandatory px-xs">
          {foodRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-lg text-center w-full gap-sm p-4">
              <span
                className="material-symbols-outlined text-4xl text-outline"
                style={{ fontSize: "48px", color: "#73777c" }}
              >
                shopping_bag
              </span>
              <p className="font-body-md text-body-md text-secondary mt-2">
                背包目前沒有食物，餵食需要先前往商城購買喔！
              </p>
              <Link
                href="/shop"
                className="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-surface-tint transition-all mt-3 inline-flex items-center gap-1 shadow-sm"
                style={{ padding: "8px 16px" }}
              >
                <span className="material-symbols-outlined text-sm">storefront</span> 前往寵物商城購買
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
                <span className="font-label-md text-label-md text-on-surface text-center mb-sm line-clamp-1">
                  {f.name} (x{f.quantity})
                </span>
                <span className="text-[10px] text-secondary text-center mb-sm">
                  +{f.hpRestore} HP
                </span>
                <form action={feedPet} className="w-full">
                  <input type="hidden" name="itemId" value={f.itemId} />
                  <button
                    type="submit"
                    className="w-full bg-primary text-on-primary font-label-md text-label-md py-2 rounded-lg hover:bg-surface-tint active:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
