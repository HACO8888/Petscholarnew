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

// 商品封面圖 itemId -> URL 對照表。
// 來源：legacy/stitch_studypet_village 2/_7/code.html（補給品食物卡的真實 <img> 封面圖）。
// legacy 與 DB SHOP_ITEMS 的商品名稱不同，採「grade + price 槽位」對應（非靠 name）。
// 對不到的食物與全部 accessory 不在此表，會 fallback 回 emoji icon。
const ITEM_COVER: Record<string, string> = {
  // item-riceball (基礎/10) -> legacy「牛奶 (基礎/10)」
  "item-riceball":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDBSZm0-7ujJMJXQO8YyOJkVr9UyuO_AExHK7LCmF77lew_9aOrVGaZ77Z18euG15wWszGRYxoPROjnUN8_1MgHurw159OLGxqabMWVYxSvRCSri7MQJgiUndbAe-xGb18GABhyFk2kdHoqE_QHx9J46EuQKMDtMWONambSGVCVkG8lgcjYzo3pGtMTG5CU72Nhwc4dO00VEWx3FtN9ATPd2_3TlJd1SZmsLtTnoXbsosjue_kGZas15xR6dug3frKg3JSjnfm-nncd",
  // item-sandwich (基礎/15) -> legacy「蜂蜜罐 (基礎/15)」
  "item-sandwich":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDAYRM9dbWl8datrcYD0aoItj7fFziw91cWgJZntsglPVtLrjQ_RBarjGjvTWNNDWDIDXIyjBkdyVQ6IHw2WveNoxiOztCpaFTa9fK1_8-gyt-2fw-CEODFrRcmNe8jGvicNPYtfRjCPwDUCgOAK3Shtoak-WBM1GaVQtV3d7TJMICFuzVsT7AhsDllgnaGksTvaXYfuHHVHosZVvaxho9worNVF_BO8m1J2sfSB1GIjiG-r68NpfyXOQtPh_wt2zehUNl07fHq3X9-",
  // item-chicken (普通/25) -> legacy「蘋果 (普通/25)」
  "item-chicken":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB0STl3aP4dNiMiKUTNotuqNvJtL9g4JnecHrz9L7CHBtnvLVOd4fUfgwiCMTDDSqDFWqm4BrvMI_YzgShv85r2ZUgRG1aacK3TTBH7od1IhhRtRpWbh-Hm13jT8wa0bJ-3o6LEAcSU3IPKsGXDEgI_l-gmFYcMbD0zvKduXEdCcrzk4spqBct5rirrqv5TNY9cOYHe-K6hHPqsiao8NxnC-7fSOd-IcvITS27QCMyQXZF6i1tUyLwK_L9DjuMh5tm53KS__vM_n00i",
  // item-coffee (普通/30) -> legacy「葡萄 (普通/30)」
  "item-coffee":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAZlRqXHjGqXvdF6risfFY9x6FFRQ4DMf_f13QQ4_7t4vgBJPK43REf8u6rUknDY0IKI9og1kgJ1QrTRurkruPozjQVos-HHF56HWFbAY0DgZXtcTSiGFwEmd_mTbt17cNTXTn0zpTRV8y8Jgxs39deWEFuNWZAm5r1lg68pwHYUbWxl1xo1aYsErD2oWk2cRvlUjTtr_5WA_ZSH2VTYFY-O9isk3D5a0bv--fvS5QWQirCUca_02WV5ZPHZT38vL35cgqUPy4EOXWk",
  // item-bento (稀有/50) -> legacy「鮪魚三明治 (稀有/50)」
  "item-bento":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCxZqKdh393mrmu3xRHnlDQIK6Bou4neKs24252VpTbuTn9TL9bYwNYLQJaMz3vCNC750D7dVSTy2ge5VbY0jCmMFsLPIbMGu1pc-ngBoMCS-gN8GxAoIN7dDTYYJQSk5BYLMIHY-SEIqQ1R2tIgmPqCdZGu9rOxvsbbq_5tnVL5r5RGVeg7jl2nvtvzElH39i7n8wHiIrclTB-9jXpikcKesYWpn3K_8W1EeWHQEp4hp6-yqrRD_8mc1auC2aOmpsvVokERqtglDIy",
  // item-candy (史詩/120) -> legacy「草莓蛋糕 (史詩/120)」
  "item-candy":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC-5Y3-i1lX5qFNwzJkoCuS8jHNUViv1A6XrGXr2UOyCfJvGpaKAIxIAbm1O1iOtZfan4Agbfesds_OPhy-qYMqAWdys2LBlIR3oT9j_GVmBeKVGr0kiAjxqRmdK0gmSxK3LPUVGU9sqoTka3C0nzvDeDS_Fz9eCV8orxH83V-avq5T2ChZ1LGA5qMOWH3FrkH6mKuMNqIKLxeB5zqiLzDleenYIX2UIbLzjhZCmQZYUupsg9yLcgcN22hnoSbq-wAZ0Df_GB7oGfDx",
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
            const coverUrl = ITEM_COVER[item.id];
            return (
              <div key={item.id} className={style.card}>
                {isFeatured && (
                  <div className="absolute top-0 right-0 bg-primary text-on-primary px-sm py-xs rounded-bl-lg font-label-md text-label-md z-20">
                    熱銷
                  </div>
                )}
                <div className={style.imageBox}>
                  {style.imageOverlay && <div className={style.imageOverlay}></div>}
                  {coverUrl ? (
                     
                    <img
                      src={coverUrl}
                      alt={item.name}
                      className="h-28 w-28 object-contain relative z-10 group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <span className="text-6xl relative z-10 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                  )}
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
