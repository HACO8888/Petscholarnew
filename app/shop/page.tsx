import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { buyItem, toggleEquip } from "@/app/pet/actions";

export default async function ShopPage() {
  const session = await auth();
  const items = await db.select().from(shopItems).orderBy(shopItems.sortOrder);

  const owned = new Map<string, number>();
  let equipped: Record<string, boolean> = {};
  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    equipped = {
      hat: pet.equippedHat,
      background: pet.equippedBackground,
      rareStyle: pet.equippedRareStyle,
    };
    const inv = await db
      .select({ itemId: inventory.itemId, quantity: inventory.quantity })
      .from(inventory)
      .where(eq(inventory.userId, session.user.id));
    for (const r of inv) owned.set(r.itemId, r.quantity);
  }

  const accessories = items.filter((item) => item.type === "accessory");
  const ownedAccs = accessories.filter((item) => (owned.get(item.id) ?? 0) > 0);

  return (
    <section className="tab-section" id="sect-shop">
      <div className="mb-lg">
        <h1 className="font-semibold text-headline-lg text-on-background">電子雞養成商店</h1>
        <p className="text-secondary text-body-md">消費賺得的金幣，購買營養補給品或限時精緻裝飾配件。</p>
      </div>

      {/* Backpack Closet Panel */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm mb-lg">
        <h3 className="font-bold text-body-lg text-tertiary flex items-center gap-1 mb-md">
          <span className="material-symbols-outlined">backpack</span> 電子雞裝飾配件背包
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md" id="inventory-items-container">
          {ownedAccs.length === 0 ? (
            <p className="text-secondary text-xs w-full text-center py-6 col-span-2 md:col-span-4">
              背包目前是空的。在下方選購配件，為「北科科」穿戴打扮吧！🎩
            </p>
          ) : (
            ownedAccs.map((item) => {
              const isEquipped = item.accessoryType
                ? !!equipped[item.accessoryType]
                : false;
              const equipText = isEquipped ? "📴 卸下" : "🥋 穿戴";
              const cardBg = isEquipped
                ? "bg-tertiary-container/20 border-tertiary-container dark:bg-tertiary-container/10 dark:border-tertiary-container"
                : "bg-surface-container-low dark:bg-surface border-outline-variant/30";
              return (
                <div
                  key={item.id}
                  className={`flex flex-col items-center p-3 rounded-xl border ${cardBg} transition-all relative overflow-hidden`}
                  id={`inv-slot-${item.id}`}
                >
                  <span className="text-3xl mb-1">{item.icon}</span>
                  <span className="text-xs font-bold text-on-surface text-center line-clamp-1">
                    {item.name}
                  </span>
                  <form action={toggleEquip} className="mt-2 w-full">
                    <input
                      type="hidden"
                      name="accessoryType"
                      value={item.accessoryType ?? ""}
                    />
                    <button
                      type="submit"
                      className={`w-full text-[10px] font-bold py-1 px-2.5 rounded-md border transition-all ${
                        isEquipped
                          ? "bg-tertiary text-on-tertiary border-transparent"
                          : "bg-transparent text-secondary border-outline-variant hover:bg-surface-container"
                      }`}
                    >
                      {equipText}
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Shop Grid */}
      <div className="flex items-center gap-1.5 mb-md">
        <span className="material-symbols-outlined text-primary">restaurant</span>
        <h3 className="font-bold text-headline-md text-on-surface">商店美食補給品與裝飾</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md" id="full-shop-container">
        {items.map((item) => {
          const isAccessory = item.type === "accessory";
          const highlightBorder = isAccessory
            ? "border-tertiary-container/60 bg-gradient-to-b from-surface to-tertiary-container/5 dark:from-surface-container-high dark:to-tertiary-container/5"
            : "border-outline-variant/20";
          const btnStyle = isAccessory
            ? "bg-tertiary text-on-tertiary hover:opacity-90"
            : "bg-primary text-on-primary hover:bg-surface-tint";
          return (
            <div
              key={item.id}
              className={`bg-surface-container-lowest dark:bg-surface-container-high rounded-xl p-md border ${highlightBorder} shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden`}
              id={`shop-item-${item.id}`}
            >
              {item.price >= 50 && !isAccessory && (
                <div className="absolute top-0 right-0 bg-primary text-on-primary px-2.5 py-0.5 rounded-bl-lg text-[9px] font-bold tracking-wider uppercase">
                  熱銷
                </div>
              )}
              <div className="h-28 bg-surface-container-low dark:bg-surface rounded-lg mb-md flex items-center justify-center relative overflow-hidden group">
                <span className="text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </span>
              </div>
              <h3 className="font-bold text-body-lg text-on-surface mb-1">{item.name}</h3>
              <p className="text-[11px] text-secondary mb-md leading-relaxed flex-1">
                {item.description}
              </p>
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/10">
                <span className="font-bold text-body-md text-tertiary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-yellow-500 icon-fill">
                    monetization_on
                  </span>
                  {item.price}
                </span>
                <form action={buyItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button
                    type="submit"
                    className={`${btnStyle} font-bold text-xs px-4 py-1.5 rounded-lg transition-all shadow-sm`}
                  >
                    {isAccessory ? "購買配件" : "購買食物"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
