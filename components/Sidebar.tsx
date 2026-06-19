import Link from "next/link";
import { revalidatePath } from "next/cache";
import { claimCheckin, healPet } from "@/app/(app)/pet/actions";
import { logout } from "@/app/actions/auth";
import { maxExpForLevel, petTitle } from "@/lib/pet";
import SidebarNav, { SidebarHelpButton } from "./SidebarNav";
import SidebarShell from "./SidebarShell";
import ThemeToggle from "./ThemeToggle";
import type { Role } from "./nav-config";

export interface SidebarData {
  loggedIn: boolean;
  role: Role;
  petName: string;
  petStyle: string | null;
  level: number;
  hp: number;
  maxHp: number;
  exp: number;
  coins: number;
  checkedIn: boolean;
  equippedHat: boolean;
  equippedBackground: boolean;
  equippedRareStyle: boolean;
}

const STYLE_EMOJI: Record<string, string> = {
  classic: "🤖",
  cat: "🐱",
  dog: "🐶",
  rabbit: "🐰",
  dragon: "🐉",
};

// 側欄的寵物互動在每一頁都可能觸發，故 revalidate 整個 layout 讓側欄即時更新。
async function sidebarCheckin() {
  "use server";
  await claimCheckin();
  revalidatePath("/", "layout");
}
async function sidebarHeal() {
  "use server";
  await healPet();
  revalidatePath("/", "layout");
}

/**
 * 左側欄：品牌 / 深淺模式 / 寵物狀態卡（登入才顯示）/ 導航 / 登入登出。
 * 寵物與使用者狀態集中在此一處，首頁不再重複顯示。
 */
export default function Sidebar({ data }: { data: SidebarData }) {
  const maxHearts = Math.max(1, Math.round(data.maxHp / 100));
  const full = Math.max(0, Math.floor(data.hp / 100));
  const hearts =
    "❤️".repeat(Math.min(full, maxHearts)) + "🖤".repeat(Math.max(0, maxHearts - full));
  const emoji = STYLE_EMOJI[data.petStyle ?? "classic"] ?? STYLE_EMOJI.classic;
  const maxExp = maxExpForLevel(data.level);
  const hpPct = data.maxHp > 0 ? Math.round((data.hp / data.maxHp) * 100) : 0;
  const expPct = maxExp > 0 ? Math.round((data.exp / maxExp) * 100) : 0;

  return (
    <SidebarShell>
      {/* 品牌列 + 深淺模式 */}
      <div className="flex items-center justify-between gap-2 mb-md px-1 shrink-0">
        <Link
          href="/"
          className="font-bold text-headline-md text-primary dark:text-primary-fixed tracking-tight no-underline whitespace-nowrap"
        >
          PetScholar
        </Link>
        <ThemeToggle />
      </div>

      {/* 寵物狀態卡（登入才顯示） */}
      {data.loggedIn ? (
        <div className="mb-md p-md bg-surface rounded-xl shadow-sm border border-outline-variant shrink-0">
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className={`relative w-14 h-14 rounded-full border-2 shadow-sm flex items-center justify-center text-3xl shrink-0 ${
                data.equippedBackground
                  ? "border-tertiary bg-gradient-to-br from-primary-container to-tertiary-container"
                  : "border-primary-container bg-primary-container/30"
              } ${data.equippedRareStyle ? "ring-2 ring-tertiary" : ""}`}
            >
              {data.equippedHat && (
                <span className="absolute -top-2.5 text-lg" aria-hidden>
                  🎓
                </span>
              )}
              <span aria-hidden>{emoji}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-on-surface truncate leading-tight">{data.petName}</h3>
              <p className="text-[10px] font-semibold text-tertiary dark:text-tertiary-fixed-dim truncate">
                🎖️ {petTitle(data.level)} · Lv.{data.level}
              </p>
            </div>
          </div>

          <div className="hearts-glow text-center text-[18px] leading-none mb-2">{hearts}</div>

          <div className="space-y-1.5 mb-2.5">
            <div>
              <div className="flex justify-between text-[10px] text-secondary mb-0.5">
                <span>🔋 活力 (HP)</span>
                <span>
                  {data.hp}/{data.maxHp}
                </span>
              </div>
              <div className="w-full bg-surface-container-low dark:bg-surface h-1.5 rounded-full overflow-hidden">
                <div className="hp-bar h-full rounded-full" style={{ width: `${hpPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-secondary mb-0.5">
                <span>⚡ 經驗 (EXP)</span>
                <span>
                  {data.exp}/{maxExp}
                </span>
              </div>
              <div className="w-full bg-surface-container-low dark:bg-surface h-1.5 rounded-full overflow-hidden">
                <div className="exp-bar h-full rounded-full" style={{ width: `${expPct}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className="text-secondary">🪙 金幣</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">{data.coins}</span>
            </div>
          </div>

          <div className="flex gap-1.5">
            <form action={sidebarCheckin} className="flex-1">
              <button
                type="submit"
                disabled={data.checkedIn}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold text-[11px] py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[15px]">event_available</span>
                {data.checkedIn ? "已簽到" : "簽到 +20"}
              </button>
            </form>
            <form action={sidebarHeal} className="flex-1">
              <button
                type="submit"
                disabled={data.coins < 20 || data.hp >= data.maxHp}
                className="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold text-[11px] py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[15px]">healing</span>
                治療 20
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="mb-md p-md bg-surface rounded-xl shadow-sm border border-outline-variant text-center shrink-0 flex flex-col items-center gap-2">
          <span className="text-4xl" aria-hidden>
            🥚
          </span>
          <h3 className="text-base leading-tight text-primary font-bold">尚未領養寵物</h3>
          <p className="text-[11px] text-secondary leading-relaxed">
            登入即可領養學習夥伴，透過答題與簽到一起成長。
          </p>
          <Link
            href="/login"
            className="w-full bg-primary text-on-primary font-label-md text-label-md px-3 py-2 rounded-lg hover:bg-surface-tint transition-colors flex items-center justify-center gap-1 no-underline"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            登入養成寵物
          </Link>
        </div>
      )}

      {/* 導航（個人/寵物相關項目登入後才出現） */}
      <SidebarNav role={data.role} loggedIn={data.loggedIn} />

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-sm pt-md border-t border-outline-variant shrink-0">
        <SidebarHelpButton />
        {data.loggedIn ? (
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-on-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>登出</span>
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="text-on-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest transition-colors no-underline"
          >
            <span className="material-symbols-outlined">login</span>
            <span>登入</span>
          </Link>
        )}
      </div>
    </SidebarShell>
  );
}
