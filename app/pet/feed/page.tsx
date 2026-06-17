import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, shopItems, inventory } from "@/db/schema";
import { getOrCreatePet, statusFromHp } from "@/lib/pet";
import PetMascot from "@/components/PetMascot";
import { feedPet } from "@/app/pet/actions";

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

  const status = statusFromHp(pet.hp, pet.maxHp);

  return (
    <section>
      <div className="mb-lg">
        <h1 className="font-semibold text-headline-lg text-on-background">寵物餵食</h1>
        <p className="text-secondary text-body-md">
          在這裡與您的電子雞夥伴「北科科」近距離互動，使用背包中的食物餵食牠以恢復 HP！
        </p>
      </div>

      {/* Center Stage mascot display */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/30 rounded-2xl p-lg shadow-sm flex flex-col items-center justify-center min-h-[420px] relative mb-lg">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[280px] h-[280px] md:w-[420px] md:h-[420px] rounded-full bg-primary-fixed blur-3xl" />
        </div>

        <div className="relative group cursor-pointer mb-md">
          {/* SVG Mascot scaled up for center stage */}
          <div className="w-48 h-48 md:w-64 md:h-64 flex justify-center items-center">
            <PetMascot
              petStyle={me?.petStyle ?? "classic"}
              face={status.face}
              equippedHat={pet.equippedHat}
              equippedBackground={pet.equippedBackground}
              equippedRareStyle={pet.equippedRareStyle}
            />
          </div>
        </div>

        <h2 className="font-bold text-headline-md text-on-surface text-center mb-1">
          {pet.name}
        </h2>
        <p className="text-secondary text-body-md text-center max-w-md">
          {pet.hp <= 35 ? (
            <>
              😴{" "}
              <span className="text-red-500 font-bold">
                {pet.name}現在非常疲憊 (HP: {pet.hp})！
              </span>
              需要餵食一些歐趴便當來補滿活力！
            </>
          ) : (
            <>
              😊 活力值良好 (HP: {pet.hp})。餵食點心可以讓我的經驗值 (EXP) 持續增長喔！
            </>
          )}
        </p>
      </div>

      {/* Food slider panel */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/30 rounded-2xl p-md shadow-sm">
        <div className="flex justify-between items-center mb-sm">
          <h3 className="font-bold text-body-lg text-on-surface">背包裡的美味食物</h3>
          <Link
            href="/shop"
            className="text-primary hover:underline text-xs flex items-center gap-0.5"
          >
            前往商城選購{" "}
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </Link>
        </div>

        <div className="flex overflow-x-auto gap-md pb-2 pt-2 hide-scrollbar snap-x px-1">
          {foodRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-lg text-center w-full gap-sm p-4 col-span-full">
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
                className="flex-shrink-0 w-32 md:w-36 bg-surface-container-low dark:bg-surface rounded-xl p-3 flex flex-col items-center justify-between border border-outline-variant/30 hover:shadow-md transition-all snap-center group"
              >
                <div className="w-16 h-16 rounded-lg bg-surface-container-lowest dark:bg-surface-container-high flex items-center justify-center p-2 mb-2 overflow-hidden shadow-inner">
                  <span className="text-3xl group-hover:scale-110 transition-transform duration-300">
                    {f.icon}
                  </span>
                </div>
                <span className="text-xs font-bold text-on-surface text-center mb-1">
                  {f.name} (x{f.quantity})
                </span>
                <span className="text-[9px] text-secondary text-center mb-2.5">
                  +{f.hpRestore} HP
                </span>
                <form action={feedPet} className="w-full">
                  <input type="hidden" name="itemId" value={f.itemId} />
                  <button
                    type="submit"
                    className="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs py-1.5 rounded-lg shadow-sm transition-all"
                  >
                    餵食
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
