import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { buyItem } from "@/app/pet/actions";

type GradeStyle = {
  card: string;
  imageBox: string;
  imageOverlay: string;
  title: string;
  button: string;
};

const DEFAULT_GRADE_STYLE: GradeStyle = {
  card: "bg-surface-bright rounded-xl p-md border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden",
  imageBox: "h-32 bg-surface-container-low rounded-lg mb-md flex items-center justify-center relative overflow-hidden group",
  imageOverlay: "absolute inset-0 bg-gradient-to-br from-secondary-container to-surface-container opacity-50",
  title: "font-body-lg text-body-lg font-bold text-on-surface mb-xs",
  button: "px-md py-xs border border-secondary text-secondary rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors disabled:opacity-50",
};

const GRADE_STYLE: Record<string, GradeStyle> = {
  基礎: DEFAULT_GRADE_STYLE,
  普通: {
    card: "bg-surface-bright rounded-xl p-md border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden",
    imageBox: "h-32 bg-primary-container/20 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group",
    imageOverlay: "",
    title: "font-body-lg text-body-lg font-bold text-on-surface mb-xs",
    button: "px-md py-xs bg-primary/10 text-primary border border-primary/20 rounded-lg font-label-md text-label-md hover:bg-primary/20 transition-colors disabled:opacity-50",
  },
  稀有: {
    card: "bg-surface-bright rounded-xl p-md border-2 border-primary-container shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden",
    imageBox: "h-32 bg-primary-container/40 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group",
    imageOverlay: "",
    title: "font-body-lg text-body-lg font-bold text-on-surface mb-xs",
    button: "px-md py-xs bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-surface-tint transition-colors disabled:opacity-50",
  },
  史詩: {
    card: "bg-surface-bright rounded-xl p-md border border-tertiary-container shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden bg-gradient-to-b from-surface-bright to-tertiary-fixed/10",
    imageBox: "h-32 bg-tertiary-container/30 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group",
    imageOverlay: "",
    title: "font-body-lg text-body-lg font-bold text-on-tertiary-container mb-xs",
    button: "px-md py-xs bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50",
  },
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
    <div className="space-y-xl">
      {/* Page Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">寵物商城</h1>
          <p className="font-body-md text-body-md text-secondary">為您的學習夥伴補充能量與裝備</p>
        </div>
        {coins !== null ? (
          <div className="hidden sm:flex items-center gap-sm bg-surface-container px-md py-sm rounded-full shadow-sm">
            <span className="material-symbols-outlined text-tertiary">account_balance_wallet</span>
            <span className="font-label-md text-label-md text-on-surface">餘額: {coins} 枚金幣</span>
          </div>
        ) : (
          <Link
            href="/login"
            className="hidden sm:flex items-center gap-sm bg-surface-container px-md py-sm rounded-full shadow-sm font-label-md text-label-md text-primary hover:text-surface-tint transition-colors"
          >
            <span className="material-symbols-outlined text-tertiary">account_balance_wallet</span>
            登入以購買
          </Link>
        )}
      </header>

      {/* Pet Food Bento Grid */}
      <section>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined text-primary">restaurant</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">補給品</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {items.map((item) => {
            const ownedQty = owned.get(item.id) ?? 0;
            const affordable = coins === null || coins >= item.price;
            const style = (item.grade && GRADE_STYLE[item.grade]) || DEFAULT_GRADE_STYLE;
            const isFeatured = item.grade === "稀有";
            return (
              <div key={item.id} className={style.card}>
                {isFeatured && (
                  <div className="absolute top-0 right-0 bg-primary text-on-primary px-sm py-xs rounded-bl-lg font-label-md text-label-md z-20">
                    熱銷
                  </div>
                )}
                <div className={style.imageBox}>
                  {style.imageOverlay && <div className={style.imageOverlay}></div>}
                  <span className="text-6xl relative z-10 group-hover:scale-110 transition-transform">
                    {item.icon}
                  </span>
                </div>
                <h3 className={style.title}>
                  {item.name}
                  {item.grade ? ` (${item.grade})` : ""}
                </h3>
                <p className="font-body-md text-body-md text-secondary mb-md flex-1">
                  {item.description}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-label-md text-label-md text-tertiary flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] icon-fill">monetization_on</span>{" "}
                    {item.price}
                  </span>
                  <div className="flex items-center gap-sm">
                    {ownedQty > 0 && (
                      <span className="font-label-md text-label-md text-secondary">已有 {ownedQty}</span>
                    )}
                    <form action={buyItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button type="submit" disabled={!affordable} className={style.button}>
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
    </div>
  );
}
