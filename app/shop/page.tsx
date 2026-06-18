import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { shopItems, inventory } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";
import { buyItem, toggleEquip } from "@/app/pet/actions";

// 對應部署版 _7/code.html 各食物的 Stitch <img>，依稀有度(grade)分配真實食物圖片。
// 同一稀有度有多張時，依出現順序輪流套用，視覺與部署版一致。
const FOOD_IMAGES_BY_GRADE: Record<string, string[]> = {
  基礎: [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDBSZm0-7ujJMJXQO8YyOJkVr9UyuO_AExHK7LCmF77lew_9aOrVGaZ77Z18euG15wWszGRYxoPROjnUN8_1MgHurw159OLGxqabMWVYxSvRCSri7MQJgiUndbAe-xGb18GABhyFk2kdHoqE_QHx9J46EuQKMDtMWONambSGVCVkG8lgcjYzo3pGtMTG5CU72Nhwc4dO00VEWx3FtN9ATPd2_3TlJd1SZmsLtTnoXbsosjue_kGZas15xR6dug3frKg3JSjnfm-nncd",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDAYRM9dbWl8datrcYD0aoItj7fFziw91cWgJZntsglPVtLrjQ_RBarjGjvTWNNDWDIDXIyjBkdyVQ6IHw2WveNoxiOztCpaFTa9fK1_8-gyt-2fw-CEODFrRcmNe8jGvicNPYtfRjCPwDUCgOAK3Shtoak-WBM1GaVQtV3d7TJMICFuzVsT7AhsDllgnaGksTvaXYfuHHVHosZVvaxho9worNVF_BO8m1J2sfSB1GIjiG-r68NpfyXOQtPh_wt2zehUNl07fHq3X9-",
  ],
  普通: [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB0STl3aP4dNiMiKUTNotuqNvJtL9g4JnecHrz9L7CHBtnvLVOd4fUfgwiCMTDDSqDFWqm4BrvMI_YzgShv85r2ZUgRG1aacK3TTBH7od1IhhRtRpWbh-Hm13jT8wa0bJ-3o6LEAcSU3IPKsGXDEgI_l-gmFYcMbD0zvKduXEdCcrzk4spqBct5rirrqv5TNY9cOYHe-K6hHPqsiao8NxnC-7fSOd-IcvITS27QCMyQXZF6i1tUyLwK_L9DjuMh5tm53KS__vM_n00i",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAZlRqXHjGqXvdF6risfFY9x6FFRQ4DMf_f13QQ4_7t4vgBJPK43REf8u6rUknDY0IKI9og1kgJ1QrTRurkruPozjQVos-HHF56HWFbAY0DgZXtcTSiGFwEmd_mTbt17cNTXTn0zpTRV8y8Jgxs39deWEFuNWZAm5r1lg68pwHYUbWxl1xo1aYsErD2oWk2cRvlUjTtr_5WA_ZSH2VTYFY-O9isk3D5a0bv--fvS5QWQirCUca_02WV5ZPHZT38vL35cgqUPy4EOXWk",
  ],
  稀有: [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCxZqKdh393mrmu3xRHnlDQIK6Bou4neKs24252VpTbuTn9TL9bYwNYLQJaMz3vCNC750D7dVSTy2ge5VbY0jCmMFsLPIbMGu1pc-ngBoMCS-gN8GxAoIN7dDTYYJQSk5BYLMIHY-SEIqQ1R2tIgmPqCdZGu9rOxvsbbq_5tnVL5r5RGVeg7jl2nvtvzElH39i7n8wHiIrclTB-9jXpikcKesYWpn3K_8W1EeWHQEp4hp6-yqrRD_8mc1auC2aOmpsvVokERqtglDIy",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBpJqmC_0gs_kIfA95wCtB3mR3r-8dR9HTa8t20ZhRLTxUI9OG1eKBiXoiI-Rx7CfW0sud-7LpiRnmpFsrDQ51_2SqAjTHQWWcYQOpZEsoD-ZJZIjya0aEcXDExoAxadgMnywvw4AFs2yWu_p3ZhLudXfbJhv7PpRhcShvEuuxWeFxWkzlOXWyFKrxZwrFh_378SrMm00jErQy3sfaqRpyZgo8BWApfHxhp82z34XDRM-i06C4CuaR000nL14O6NiH062lCtuPrd6g6",
  ],
  史詩: [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDbd4I9bmiLHOnYtLGOXCgR3kdDXRE1D6SudyHO7MFxGcGuJbGJxERhKvXMPX7Vo0TGD3jI-n9yB_w23BvXQ30w8m4a59WjBlJ0DrvNfSk-LQxjRZQ5qpCicxXSXljcErUqUfC7Vm0tt1Ajp12im40LoRjsq4gTRhnHK1GrogDc-a5LSqygpICaEsvEvHj6HryUKU8InFbxNNjws9NxTo9Qyuc8VxRHLeCZtk3mi0fdqCqIY63xTH21grKahZups29DCihFHatK4gu_",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC-5Y3-i1lX5qFNwzJkoCuS8jHNUViv1A6XrGXr2UOyCfJvGpaKAIxIAbm1O1iOtZfan4Agbfesds_OPhy-qYMqAWdys2LBlIR3oT9j_GVmBeKVGr0kiAjxqRmdK0gmSxK3LPUVGU9sqoTka3C0nzvDeDS_Fz9eCV8orxH83V-avq5T2ChZ1LGA5qMOWH3FrkH6mKuMNqIKLxeB5zqiLzDleenYIX2UIbLzjhZCmQZYUupsg9yLcgcN22hnoSbq-wAZ0Df_GB7oGfDx",
  ],
};

export default async function ShopPage() {
  const session = await auth();
  const items = await db.select().from(shopItems).orderBy(shopItems.sortOrder);

  const owned = new Map<string, number>();
  let equipped: Record<string, boolean> = {};
  let coins = 120;
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

  const foods = items.filter((item) => item.type !== "accessory");
  const accessories = items.filter((item) => item.type === "accessory");
  const ownedAccs = accessories.filter((item) => (owned.get(item.id) ?? 0) > 0);

  // 依稀有度為每件食物分配對應的 Stitch 食物圖片（同稀有度依序輪流）。
  const gradeCounter: Record<string, number> = {};
  const foodImageFor = (grade: string | null) => {
    const list = FOOD_IMAGES_BY_GRADE[grade ?? ""] ?? [];
    if (list.length === 0) return undefined;
    const idx = gradeCounter[grade ?? ""] ?? 0;
    gradeCounter[grade ?? ""] = idx + 1;
    return list[idx % list.length];
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-6xl mx-auto space-y-xl">
      {/* Page Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">寵物商城</h1>
          <p className="font-body-md text-body-md text-secondary">為您的學習夥伴補充能量與裝備</p>
        </div>
        <div className="hidden sm:flex items-center gap-sm bg-surface-container px-md py-sm rounded-full shadow-sm">
          <span className="material-symbols-outlined text-tertiary">account_balance_wallet</span>
          <span className="font-label-md text-label-md text-on-surface">餘額: {coins} 枚金幣</span>
        </div>
      </header>

      {/* Pet Food Bento Grid */}
      <section>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined text-primary">restaurant</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">補給品</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {foods.map((item) => {
            const grade = item.grade ?? "";
            const isEpic = grade === "史詩";
            const isRare = grade === "稀有";
            const isCommon = grade === "普通";
            const isHot = isRare && item.price >= 50;
            const img = foodImageFor(item.grade);

            const cardClass = isEpic
              ? "bg-surface-bright rounded-xl p-md border border-tertiary-container shadow-sm hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-surface-bright to-tertiary-fixed/10"
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
                  <div className="absolute top-0 right-0 bg-primary text-on-primary px-sm py-xs rounded-bl-lg font-label-md text-label-md">
                    熱銷
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
                  <form action={buyItem}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit" className={buyBtnClass}>
                      購買
                    </button>
                  </form>
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
              背包目前是空的。在下方選購配件，為您的學習夥伴穿戴打扮吧！🎩
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
                      className={`w-full px-md py-xs rounded-lg font-label-md text-label-md transition-colors ${
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
            {accessories.map((item) => (
              <div
                key={item.id}
                id={`shop-item-${item.id}`}
                className="bg-surface-bright rounded-xl p-md border border-tertiary-container shadow-sm hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-surface-bright to-tertiary-fixed/10"
              >
                <div className="h-32 bg-tertiary-container/30 rounded-lg mb-md flex items-center justify-center relative overflow-hidden group">
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
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-label-md text-label-md text-tertiary flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] icon-fill">
                      monetization_on
                    </span>{" "}
                    {item.price}
                  </span>
                  <form action={buyItem}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      className="px-md py-xs bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm"
                    >
                      購買
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
