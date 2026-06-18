import Link from "next/link";
import { revalidatePath } from "next/cache";
import { claimCheckin, feedPet, simulateTimePass, healPet } from "@/app/(app)/pet/actions";

/**
 * 首頁側邊欄的互動會改動寵物狀態，但底層 action 只會 revalidate 寵物相關頁。
 * 這裡用 server action 包一層，補上首頁 "/" 的 revalidate，讓側邊欄即時更新。
 */
async function homeCheckin() {
  "use server";
  await claimCheckin();
  revalidatePath("/");
}

async function homeSimulateTimePass() {
  "use server";
  await simulateTimePass();
  revalidatePath("/");
}

async function homeHealPet() {
  "use server";
  await healPet();
  revalidatePath("/");
}

async function homeFeedPet(formData: FormData) {
  "use server";
  await feedPet(formData);
  revalidatePath("/");
}

export interface HomeSidebarData {
  loggedIn: boolean;
  userName: string;
  userDept: string;
  userImage: string | null;
  petName: string;
  level: number;
  hp: number;
  maxHp: number;
  exp: number;
  coins: number;
  checkedIn: boolean;
  quickFeed: { itemId: string; name: string; icon: string | null; quantity: number }[];
}

export default function HomeSidebar({ data }: { data: HomeSidebarData }) {
  const maxHearts = Math.max(1, Math.round(data.maxHp / 100));
  const full = Math.max(0, Math.floor(data.hp / 100));
  const hearts = "❤️".repeat(Math.min(full, maxHearts)) + "🖤".repeat(Math.max(0, maxHearts - full));
  const maxExp = data.level * 100;
  const hpPct = data.maxHp > 0 ? Math.round((data.hp / data.maxHp) * 100) : 0;
  const expPct = maxExp > 0 ? Math.round((data.exp / maxExp) * 100) : 0;

  return (
    <aside className="w-full xl:w-64 flex flex-col gap-lg shrink-0">
      {/* User Profile widget */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-2xl border border-outline-variant/30 shadow-sm flex items-center justify-between gap-2">
        <div className="flex items-center gap-sm min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-surface-container-low border border-outline-variant/20 shadow-inner">
            {data.userImage ? (
               
              <img src={data.userImage} alt={data.userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">👤</span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-body-md text-on-surface truncate">{data.userName}</h4>
            <p className="text-[10px] text-secondary truncate">{data.userDept}</p>
          </div>
        </div>
        <Link href="/profile" className="shrink-0 p-2 text-secondary hover:text-primary transition-colors" title="編輯個人設定">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </Link>
      </div>

      {/* Electronic Pet mascot widget */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col items-center relative overflow-hidden">
        <div className="relative mt-4 mb-2">
          <div className="anim-float w-[120px] h-[120px] flex items-center justify-center text-[88px] leading-none">🤖</div>
        </div>

        <div className="flex justify-between items-center w-full mb-3 px-1">
          <span className="font-bold text-body-md text-on-surface">{data.petName}</span>
          <span className="text-xs font-bold text-primary dark:text-primary-fixed-dim">Lv.{data.level}</span>
        </div>

        <div className="w-full space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-secondary text-[11px]">❤️ 生命值 (Hearts)</span>
            <span className="hearts-glow tracking-widest">{hearts}</span>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-secondary mb-0.5">
              <span>🔋 活力值 (HP)</span>
              <span>{data.hp}/{data.maxHp}</span>
            </div>
            <div className="w-full bg-surface-container-low dark:bg-surface h-2 rounded-full overflow-hidden border border-outline-variant/10">
              <div className="hp-bar h-full rounded-full" style={{ width: `${hpPct}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-secondary mb-0.5">
              <span>⚡ 經驗值 (EXP)</span>
              <span>{data.exp}/{maxExp}</span>
            </div>
            <div className="w-full bg-surface-container-low dark:bg-surface h-2 rounded-full overflow-hidden border border-outline-variant/10">
              <div className="exp-bar h-full rounded-full" style={{ width: `${expPct}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2.5 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xl anim-spin-slow">🪙</span>
              <div className="flex flex-col">
                <span className="font-bold text-body-lg text-yellow-600 dark:text-yellow-400">{data.coins}</span>
                <span className="text-[9px] text-secondary">金幣餘額</span>
              </div>
            </div>
            {data.loggedIn ? (
              <form action={homeCheckin}>
                <button
                  type="submit"
                  disabled={data.checkedIn}
                  className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold text-[10.5px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {data.checkedIn ? "已簽到" : "每日簽到 (+20)"}
                </button>
              </form>
            ) : (
              <Link href="/login" className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold text-[10.5px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all no-underline">
                每日簽到
              </Link>
            )}
          </div>

          {data.loggedIn ? (
            <>
              {/* Simulate hour passing — 對齊 legacy index.html sidebar */}
              <form action={homeSimulateTimePass}>
                <button
                  type="submit"
                  className="w-full mt-2 bg-surface-container border border-outline-variant/30 hover:bg-surface-container-highest text-secondary hover:text-on-surface font-semibold text-[10.5px] py-1.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1"
                >
                  <span>⏳</span> 模擬時間流逝 1 小時
                </button>
              </form>

              {/* Heal pet entry */}
              <form action={homeHealPet}>
                <button
                  type="submit"
                  disabled={data.coins < 20 || data.hp >= data.maxHp}
                  className="w-full mt-1.5 bg-surface-container border border-outline-variant/30 hover:bg-surface-container-highest text-secondary hover:text-on-surface font-semibold text-[10.5px] py-1.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <span>💊</span> 治療寵物 (-20 金幣)
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="w-full mt-2 bg-surface-container border border-outline-variant/30 hover:bg-surface-container-highest text-secondary hover:text-on-surface font-semibold text-[10.5px] py-1.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 no-underline"
            >
              <span>⏳</span> 模擬時間流逝 1 小時
            </Link>
          )}

          <Link
            href="/pet/feed"
            className="w-full mt-1.5 bg-surface-container border border-outline-variant/30 hover:bg-surface-container-highest text-secondary hover:text-on-surface font-semibold text-[10.5px] py-1.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 no-underline"
          >
            <span>🍖</span> 前往餵食寵物
          </Link>
        </div>
      </div>

      {/* Quick Feed widget */}
      <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-2xl border border-outline-variant/30 shadow-sm">
        <h3 className="font-bold text-body-md text-on-surface mb-2 flex items-center gap-0.5 border-b border-outline-variant/20 pb-1.5">
          <span>🍖</span> 快捷餵食
        </h3>
        <div className="space-y-1.5">
          {data.quickFeed.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-[11px] text-secondary mb-1">背包目前沒有食物喔！</p>
              <Link href="/shop" className="text-[11px] font-bold text-primary hover:underline">前往商城購買 →</Link>
            </div>
          ) : (
            data.quickFeed.map((f) => (
              <form key={f.itemId} action={homeFeedPet} className="flex items-center justify-between gap-1 rounded-lg bg-surface-container-low dark:bg-surface-container p-1.5">
                <input type="hidden" name="itemId" value={f.itemId} />
                <span className="flex items-center gap-1 text-[11px] text-on-surface truncate">
                  <span className="text-base">{f.icon}</span>
                  <span className="truncate">{f.name}</span>
                  <span className="text-secondary">x{f.quantity}</span>
                </span>
                <button type="submit" className="shrink-0 bg-primary text-on-primary text-[10px] font-bold px-2 py-1 rounded-md hover:bg-surface-tint transition-all">
                  餵食
                </button>
              </form>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
