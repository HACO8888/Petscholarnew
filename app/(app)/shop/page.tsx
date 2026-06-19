import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { buyItem, toggleEquip } from "@/app/(app)/pet/actions";

/** 稀有度視覺層次：依 grade 給卡片邊框／圖底／徽章一致的色系，讓商品價值一目了然。 */
function gradeStyle(grade: string) {
  switch (grade) {
    case "史詩":
      return {
        card: "border-tertiary-container bg-gradient-to-b from-surface-bright to-tertiary-fixed/15",
        media: "bg-tertiary-container/30",
        badge: "bg-tertiary text-on-tertiary",
        title: "text-on-tertiary-container",
        buy: "bg-tertiary text-on-tertiary hover:opacity-90 shadow-sm",
      };
    case "稀有":
      return {
        card: "border-2 border-primary-container bg-surface-bright",
        media: "bg-primary-container/40",
        badge: "bg-primary text-on-primary",
        title: "text-on-surface",
        buy: "bg-primary text-on-primary hover:bg-surface-tint",
      };
    case "普通":
      return {
        card: "border-outline-variant bg-surface-bright",
        media: "bg-primary-container/20",
        badge: "bg-primary/15 text-primary",
        title: "text-on-surface",
        buy: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20",
      };
    default:
      return {
        card: "border-outline-variant bg-surface-bright",
        media: "bg-surface-container-low",
        badge: "bg-surface-container-highest text-on-surface-variant",
        title: "text-on-surface",
        buy: "border border-secondary text-secondary hover:bg-surface-variant",
      };
  }
}

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bright";

export default async function ShopPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;
  const items = await db.select().from(shopItems).orderBy(shopItems.sortOrder);

  const owned = new Map<string, number>();
  let equipped: Record<string, boolean> = {};
  // 未登入者不顯示假餘額，coins 為 null 代表「需登入」。
  let coins: number | null = null;
  // 未登入者 petLevel 為 0，等級鎖一律顯示「需登入」狀態。
  let petLevel = 0;
  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    coins = pet.coins;
    petLevel = pet.level;
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
    <div className="space-y-xl">
      {/* Page Header */}
      <header className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">寵物商城</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            為您的學習夥伴補充能量與裝備。
          </p>
        </div>
        {coins !== null ? (
          <div className="flex shrink-0 items-center gap-sm self-start rounded-full border border-tertiary-container bg-tertiary-container/30 px-md py-sm shadow-sm sm:self-auto">
            <span
              aria-hidden
              className="material-symbols-outlined text-tertiary icon-fill"
            >
              account_balance_wallet
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">餘額</span>
            <span className="font-headline-md text-headline-md text-on-surface tabular-nums leading-none">
              {coins}
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">金幣</span>
          </div>
        ) : (
          <Link
            href="/login"
            className={`flex shrink-0 items-center gap-sm self-start bg-primary text-on-primary px-md py-sm rounded-full shadow-sm font-label-md text-label-md hover:bg-surface-tint transition-colors sm:self-auto ${FOCUS_RING}`}
          >
            <span className="material-symbols-outlined" aria-hidden>
              login
            </span>
            登入後可購買與穿戴
          </Link>
        )}
      </header>

      {/* Pet Food Grid */}
      <section>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined text-primary" aria-hidden>
            restaurant
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">補給品</h2>
          {foods.length > 0 && (
            <span className="font-label-md text-label-md text-on-surface-variant tabular-nums">
              {foods.length} 項
            </span>
          )}
        </div>
        {foods.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant text-center py-lg bg-surface-bright rounded-xl border border-outline-variant">
            目前沒有上架的補給品，敬請期待。
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            {foods.map((item) => {
              const grade = item.grade ?? "";
              const gs = gradeStyle(grade);
              const isHot = grade === "稀有" && item.price >= 50;
              const img = item.image;
              const ownedQty = owned.get(item.id) ?? 0;
              const cannotAfford = coins !== null && coins < item.price;
              // 等級鎖：min_level 高於當前寵物等級則鎖定（登入後才比對真實等級）
              const locked = isLoggedIn && item.minLevel > 0 && petLevel < item.minLevel;

              return (
                <div
                  className={`group relative flex flex-col overflow-hidden rounded-xl border p-md shadow-sm transition-shadow hover:shadow-md ${gs.card}`}
                  key={item.id}
                  id={`shop-item-${item.id}`}
                >
                  {/* 稀有度標籤 */}
                  {grade && (
                    <span
                      className={`absolute top-0 left-0 z-20 rounded-br-lg px-sm py-xs font-label-md text-label-md ${gs.badge}`}
                    >
                      {grade}
                    </span>
                  )}
                  {isHot && (
                    <span className="absolute top-0 right-0 z-20 bg-error text-on-error px-sm py-xs rounded-bl-lg font-label-md text-label-md">
                      熱銷
                    </span>
                  )}

                  <div
                    className={`relative mb-md mt-lg flex h-32 items-center justify-center overflow-hidden rounded-lg ${gs.media}`}
                  >
                    {img ? (

                      <img
                        alt={item.name}
                        className="h-28 w-28 object-contain transition-transform duration-300 group-hover:scale-110"
                        src={img}
                      />
                    ) : (
                      <span className="text-5xl transition-transform duration-300 group-hover:scale-110">
                        {item.icon}
                      </span>
                    )}
                    {ownedQty > 0 && (
                      <span className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-full bg-tertiary text-on-tertiary px-sm py-xs font-label-md text-label-md shadow-sm">
                        <span className="material-symbols-outlined text-[14px] icon-fill" aria-hidden>
                          inventory_2
                        </span>
                        {ownedQty}
                      </span>
                    )}
                    {item.minLevel > 0 && (
                      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 rounded-full bg-surface-container-highest/90 px-sm py-xs font-label-md text-label-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]" aria-hidden>
                          {locked ? "lock" : "lock_open"}
                        </span>
                        Lv.{item.minLevel}
                      </div>
                    )}
                  </div>

                  <h3 className={`font-body-lg text-body-lg font-bold mb-xs ${gs.title}`}>
                    {item.name}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-md flex-1">
                    {item.description}
                  </p>

                  {/* 效果一覽 */}
                  {(item.hpRestore > 0 || item.expGain > 0) && (
                    <div className="mb-md flex flex-wrap gap-xs">
                      {item.hpRestore > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-error/10 px-sm py-xs font-label-md text-label-md text-error">
                          <span className="material-symbols-outlined text-[14px] icon-fill" aria-hidden>
                            favorite
                          </span>
                          +{item.hpRestore}
                        </span>
                      )}
                      {item.expGain > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-sm py-xs font-label-md text-label-md text-primary">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden>
                            trending_up
                          </span>
                          +{item.expGain} EXP
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-sm">
                    <span className="flex items-center gap-xs font-body-lg text-body-lg font-bold text-on-surface tabular-nums">
                      <span className="material-symbols-outlined text-[18px] icon-fill text-tertiary" aria-hidden>
                        monetization_on
                      </span>
                      {item.price}
                    </span>
                    {!isLoggedIn ? (
                      <Link
                        href="/login"
                        className={`px-md py-xs rounded-lg font-label-md text-label-md transition-colors ${gs.buy} ${FOCUS_RING}`}
                      >
                        登入購買
                      </Link>
                    ) : locked ? (
                      <button
                        type="button"
                        disabled
                        title={`寵物達到 Lv.${item.minLevel} 後解鎖`}
                        className="flex items-center gap-1 px-md py-xs rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant/60 cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden>
                          lock
                        </span>
                        需 Lv.{item.minLevel}
                      </button>
                    ) : cannotAfford ? (
                      <button
                        type="button"
                        disabled
                        title="金幣不足，先去解題賺金幣吧"
                        className="px-md py-xs rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant/60 cursor-not-allowed"
                      >
                        金幣不足
                      </button>
                    ) : (
                      <form action={buyItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className={`px-md py-xs rounded-lg font-label-md text-label-md transition-colors ${gs.buy} ${FOCUS_RING}`}
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
        )}
      </section>

      {/* Accessory Backpack */}
      <section>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined text-tertiary" aria-hidden>
            backpack
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">裝飾配件背包</h2>
          {ownedAccs.length > 0 && (
            <span className="font-label-md text-label-md text-on-surface-variant tabular-nums">
              {ownedAccs.length} 件
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-md">
          {ownedAccs.length === 0 ? (
            <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex flex-col items-center gap-sm text-center py-lg bg-surface-bright rounded-xl border border-outline-variant">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant/50" aria-hidden>
                styler
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {isLoggedIn
                  ? "背包目前是空的。在下方選購配件，為您的學習夥伴穿戴打扮吧。"
                  : "登入後即可查看與穿戴你擁有的裝飾配件。"}
              </p>
            </div>
          ) : (
            ownedAccs.map((item) => {
              const isEquipped = item.accessoryType
                ? !!equipped[item.accessoryType]
                : false;
              return (
                <div
                  key={item.id}
                  id={`inv-slot-${item.id}`}
                  className={`relative flex flex-col items-center rounded-xl border bg-surface-bright p-md text-center shadow-sm transition-shadow hover:shadow-md ${
                    isEquipped ? "border-2 border-tertiary-container" : "border-outline-variant"
                  }`}
                >
                  {isEquipped && (
                    <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-tertiary text-on-tertiary px-sm py-xs font-label-md text-label-md shadow-sm">
                      <span className="material-symbols-outlined text-[14px] icon-fill" aria-hidden>
                        check
                      </span>
                      穿戴中
                    </span>
                  )}
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
                      className={`w-full px-md py-xs rounded-lg font-label-md text-label-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING} ${
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
            <span className="material-symbols-outlined text-tertiary" aria-hidden>
              styler
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface">精緻裝飾配件</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            {accessories.map((item) => {
              const isOwned = (owned.get(item.id) ?? 0) > 0;
              const cannotAfford = coins !== null && coins < item.price;
              const locked = isLoggedIn && item.minLevel > 0 && petLevel < item.minLevel;
              return (
                <div
                  key={item.id}
                  id={`shop-item-${item.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-tertiary-container bg-gradient-to-b from-surface-bright to-tertiary-fixed/15 p-md shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative mb-md flex h-32 items-center justify-center overflow-hidden rounded-lg bg-tertiary-container/30">
                    {isOwned && (
                      <span className="absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-full bg-tertiary text-on-tertiary px-sm py-xs font-label-md text-label-md shadow-sm">
                        <span className="material-symbols-outlined text-[14px] icon-fill" aria-hidden>
                          check
                        </span>
                        已擁有
                      </span>
                    )}
                    {item.minLevel > 0 && (
                      <span className="absolute bottom-2 left-2 z-20 flex items-center gap-0.5 rounded-full bg-surface-container-highest/90 px-sm py-xs font-label-md text-label-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]" aria-hidden>
                          {locked ? "lock" : "lock_open"}
                        </span>
                        Lv.{item.minLevel}
                      </span>
                    )}
                    <span className="text-5xl transition-transform duration-300 group-hover:scale-110">
                      {item.icon}
                    </span>
                  </div>
                  <h3 className="font-body-lg text-body-lg font-bold text-on-tertiary-container mb-xs">
                    {item.name}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-md flex-1">
                    {item.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-sm">
                    <span className="flex items-center gap-xs font-body-lg text-body-lg font-bold text-on-surface tabular-nums">
                      <span className="material-symbols-outlined text-[18px] icon-fill text-tertiary" aria-hidden>
                        monetization_on
                      </span>
                      {item.price}
                    </span>
                    {!isLoggedIn ? (
                      <Link
                        href="/login"
                        className={`px-md py-xs bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm ${FOCUS_RING}`}
                      >
                        登入購買
                      </Link>
                    ) : isOwned ? (
                      <span className="flex items-center gap-0.5 px-md py-xs border border-tertiary-container text-tertiary rounded-lg font-label-md text-label-md">
                        <span className="material-symbols-outlined text-[16px] icon-fill" aria-hidden>
                          check_circle
                        </span>
                        已擁有
                      </span>
                    ) : locked ? (
                      <button
                        type="button"
                        disabled
                        title={`寵物達到 Lv.${item.minLevel} 後解鎖`}
                        className="flex items-center gap-1 px-md py-xs rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant/60 cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden>
                          lock
                        </span>
                        需 Lv.{item.minLevel}
                      </button>
                    ) : cannotAfford ? (
                      <button
                        type="button"
                        disabled
                        title="金幣不足，先去解題賺金幣吧"
                        className="px-md py-xs rounded-lg font-label-md text-label-md bg-surface-variant text-on-surface-variant/60 cursor-not-allowed"
                      >
                        金幣不足
                      </button>
                    ) : (
                      <form action={buyItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className={`px-md py-xs bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm ${FOCUS_RING}`}
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
