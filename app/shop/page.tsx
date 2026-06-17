import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { buyItem } from "@/app/pet/actions";

const GRADE_STYLE: Record<string, string> = {
  基礎: "bg-surface-container-high text-on-surface-variant",
  普通: "bg-secondary-container text-on-secondary-container",
  稀有: "bg-primary-container text-on-primary-container",
  史詩: "bg-tertiary-container text-on-tertiary-container",
};

export default async function ShopPage() {
  const session = await auth();
  const items = await db.select().from(shopItems).orderBy(shopItems.sortOrder);

  let coins: number | null = null;
  const owned = new Map<string, number>();
  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    coins = pet.coins;
    const inv = await db
      .select({ itemId: inventory.itemId, quantity: inventory.quantity })
      .from(inventory)
      .where(eq(inventory.userId, session.user.id));
    for (const r of inv) owned.set(r.itemId, r.quantity);
  }

  return (
    <section>
      <div className="mb-lg flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg font-semibold text-on-background">寵物商城</h1>
          <p className="mt-1 text-body-md text-secondary">購買食物餵食寵物，或購買配件裝飾。</p>
        </div>
        {coins !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-4 py-2 text-body-md font-semibold text-on-background">
            <span className="material-symbols-outlined text-[18px] text-tertiary">paid</span>
            {coins} 金幣
          </span>
        ) : (
          <Link href="/login" className="text-label-md text-primary hover:underline">登入以購買</Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const ownedQty = owned.get(item.id) ?? 0;
          const affordable = coins === null || coins >= item.price;
          return (
            <div
              key={item.id}
              className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 dark:bg-surface-container"
            >
              <div className="flex items-center gap-2">
                <span className="text-4xl">{item.icon}</span>
                <div>
                  <p className="text-body-md font-semibold text-on-background">{item.name}</p>
                  {item.grade && (
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-label-md ${GRADE_STYLE[item.grade] ?? "bg-surface-container-high text-on-surface-variant"}`}>
                      {item.grade}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 flex-1 text-label-md text-secondary">{item.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-body-md font-bold text-tertiary">
                  <span className="material-symbols-outlined text-[16px]">paid</span>
                  {item.price}
                </span>
                <div className="flex items-center gap-2">
                  {ownedQty > 0 && (
                    <span className="text-label-md text-secondary">已有 {ownedQty}</span>
                  )}
                  <form action={buyItem}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      disabled={!affordable}
                      className="rounded-full bg-primary px-4 py-1.5 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint disabled:opacity-50"
                    >
                      {affordable ? "購買" : "金幣不足"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
