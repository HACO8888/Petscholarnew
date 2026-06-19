import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { buyItem, toggleEquip } from "@/app/(app)/pet/actions";

export default async function ShopPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;
  const items = await db.select().from(shopItems).orderBy(shopItems.sortOrder);

  const owned = new Map<string, number>();
  let equipped: Record<string, boolean> = {};
  // 未登入者不顯示假餘額，coins 為 null 代表「需登入」。
  let coins: number | null = null;
  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    coins = pet.coins;
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

  const foods = items.filter((item) => item.type === "food");
  const accessories = items.filter((item) => item.type === "accessory");
  const ownedAccs = accessories.filter((item) => (owned.get(item.id) ?? 0) > 0);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-6xl mx-auto space-y-xl">
      {/* Page Header */}
      <header className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">寵物商城</h1>
          <p className="font-body-md text-body-md text-secondary">為您的學習夥伴補充能量與裝備</p>
        </div>
        {coins !== null ? (
          <div className="flex shrink-0 items-center gap-sm self-start bg-surface-container px-md py-sm rounded-full shadow-sm sm:self-auto">
            <span className="material-symbols-outlined text-tertiary">account_balance_wallet</span>
            <span className="font-label-md text-label-md text-on-surface">
              餘額: {coins} 枚金幣
            </span>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex shrink-0 items-center gap-sm self-start bg-primary text-on-primary px-md py-sm rounded-full shadow-sm font-label-md text-label-md hover:bg-surface-tint transition-colors sm:self-auto"
          >
            <span className="material-symbols-outlined">login</span>
            登入後可購買與穿戴
          </Link>
        )}
      </header>

      {/* Pet Food Bento Grid */}
      <section>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined text-primary">restaurant</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">補給品</h2>
        </div>
        {foods.length === 0 && (
          <p className="font-body-md text-body-md text-secondary text-center py-lg bg-surface-bright rounded-xl border border-outline-variant">
            目前沒有上架的補給品，敬請期待。
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {foods.map((item) => {
            const grade = item.grade ?? "";
            const isEpic = grade === "史詩";
            const isRare = grade === "稀有";
            const isCommon = grade === "普通";
            const isHot = isRare && item.price >= 50;
            const img = item.image;
            const ownedQty = owned.get(item.id) ?? 0;
            const cannotAfford = coins !== null && coins < item.price;

            const cardClass = isEpic
              ? "bg-surface-bright rounded-xl p-md border border-tertiary-container shadow-sm hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-surface-bright to-tertiary-fixed/10 relative overflow-hidden"
              : isRare
                ? "bg-surface-bright rounded-xl p-md border-2 border-primary-container shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden"
                : "bg-surface-bright rounded-xl p-md border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden";

            const imageWrapClass = isEpic
              ? "h-32 bg-tertiary-container/30 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group"
              : isRare
                ? "h-32 bg-primary-container/40 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group"
                : isCommon
                  ? "h-32 bg-primary-container/20 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group"
                  : "h-32 bg-surface-container-low rounded-lg mb-md flex items-center justify-center relative overflow-hidden group";

            const titleClass = isEpic
              ? "font-body-lg text-body-lg font-bold text-on-tertiary-container mb-xs"
              : "font-body-lg text-body-lg font-bold text-on-surface mb-xs";

            const buyBtnClass = isEpic
              ? "px-md py-xs bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm"
              : isRare
                ? "px-md py-xs bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-surface-tint transition-colors"
                : isCommon
                  ? "px-md py-xs bg-primary/10 text-primary border border-primary/20 rounded-lg font-label-md text-label-md hover:bg-primary/20 transition-colors"
                  : "px-md py-xs border border-secondary text-secondary rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors";

            return (
              <div className={cardClass} key={item.id} id={`shop-item-${item.id}`}>
                {isHot && (
                  <div className="absolute top-0 right-0 bg-primary text-on-primary px-sm py-xs rounded-bl-lg font-label-md text-label-md z-20">
                    熱銷
                  </div>
                )}
                {ownedQty > 0 && (
                  <div className="absolute top-0 left-0 bg-tertiary text-on-tertiary px-sm py-xs rounded-br-lg font-label-md text-label-md z-20">
                    持有 {ownedQty}
                  </div>
                )}
                <div className={imageWrapClass}>
                  {!isEpic && !isRare && !isCommon && (
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary-container to-surface-container opacity-50"></div>
                  )}
                  {img ? (
                     
                    <img
                      alt={item.name}
                      className="h-28 w-28 object-contain relative z-10 group-hover:scale-110 transition-transform"
                      src={img}
                    />
                  ) : (
                    <span className="text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300">
                      {item.icon}
                    </span>
                  )}
                </div>
                <h3 className={titleClass}>{item.name}</h3>
                <p className="font-body-md text-body-md text-secondary mb-md flex-1">
                  {item.description}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-label-md text-label-md text-tertiary flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] icon-fill">
                      monetization_on
                    </span>{" "}
                    {item.price}
                  </span>
                  {!isLoggedIn ? (
                    <Link
                      href="/login"
                      className={buyBtnClass}
                    >
                      登入購買
                    </Link>
                  ) : cannotAfford ? (
                    <button
                      type="button"
                      disabled
                      className="px-md py-xs rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant/60 cursor-not-allowed"
                    >
                      金幣不足
                    </button>
                  ) : (
                    <form action={buyItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button type="submit" className={buyBtnClass}>
                        購買
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Accessory Backpack */}
      <section>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined text-tertiary">backpack</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">裝飾配件背包</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-md">
          {ownedAccs.length === 0 ? (
            <p className="font-body-md text-body-md text-secondary col-span-2 sm:col-span-3 lg:col-span-4 text-center py-lg bg-surface-bright rounded-xl border border-outline-variant">
              {isLoggedIn
                ? "背包目前是空的。在下方選購配件，為您的學習夥伴穿戴打扮吧！🎩"
                : "登入後即可查看與穿戴你擁有的裝飾配件。🎩"}
            </p>
          ) : (
            ownedAccs.map((item) => {
              const isEquipped = item.accessoryType
                ? !!equipped[item.accessoryType]
                : false;
              return (
                <div
                  key={item.id}
                  id={`inv-slot-${item.id}`}
                  className={`bg-surface-bright rounded-xl p-md border shadow-sm flex flex-col items-center text-center transition-shadow hover:shadow-md ${
                    isEquipped ? "border-2 border-tertiary-container" : "border-outline-variant"
                  }`}
                >
                  <span className="text-4xl mb-xs">{item.icon}</span>
                  <h3 className="font-label-md text-label-md font-bold text-on-surface mb-md line-clamp-1">
                    {item.name}
                  </h3>
                  <form action={toggleEquip} className="w-full mt-auto">
                    <input
                      type="hidden"
                      name="accessoryType"
                      value={item.accessoryType ?? ""}
                    />
                    <button
                      type="submit"
                      disabled={!item.accessoryType}
                      className={`w-full px-md py-xs rounded-lg font-label-md text-label-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isEquipped
                          ? "bg-tertiary text-on-tertiary hover:opacity-90"
                          : "border border-secondary text-secondary hover:bg-surface-variant"
                      }`}
                    >
                      {isEquipped ? "卸下" : "穿戴"}
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Accessory Shop */}
      {accessories.length > 0 && (
        <section>
          <div className="flex items-center gap-sm mb-md">
            <span className="material-symbols-outlined text-tertiary">styler</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">精緻裝飾配件</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            {accessories.map((item) => {
              const isOwned = (owned.get(item.id) ?? 0) > 0;
              const cannotAfford = coins !== null && coins < item.price;
              return (
                <div
                  key={item.id}
                  id={`shop-item-${item.id}`}
                  className="bg-surface-bright rounded-xl p-md border border-tertiary-container shadow-sm hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-surface-bright to-tertiary-fixed/10"
                >
                  <div className="h-32 bg-tertiary-container/30 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group">
                    {isOwned && (
                      <span className="absolute top-2 right-2 z-20 bg-tertiary text-on-tertiary px-sm py-xs rounded-full font-label-md text-label-md">
                        已擁有
                      </span>
                    )}
                    <span className="text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300">
                      {item.icon}
                    </span>
                  </div>
                  <h3 className="font-body-lg text-body-lg font-bold text-on-tertiary-container mb-xs">
                    {item.name}
                  </h3>
                  <p className="font-body-md text-body-md text-secondary mb-md flex-1">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between gap-sm mt-auto">
                    <span className="font-label-md text-label-md text-tertiary flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px] icon-fill">
                        monetization_on
                      </span>{" "}
                      {item.price}
                    </span>
                    {!isLoggedIn ? (
                      <Link
                        href="/login"
                        className="px-md py-xs bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm"
                      >
                        登入購買
                      </Link>
                    ) : isOwned ? (
                      <span className="px-md py-xs border border-tertiary-container text-tertiary rounded-lg font-label-md text-label-md">
                        已擁有
                      </span>
                    ) : cannotAfford ? (
                      <button
                        type="button"
                        disabled
                        className="px-md py-xs rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant/60 cursor-not-allowed"
                      >
                        金幣不足
                      </button>
                    ) : (
                      <form action={buyItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="px-md py-xs bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm"
                        >
                          購買
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
