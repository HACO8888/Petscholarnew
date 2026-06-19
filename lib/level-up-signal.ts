import { cookies } from "next/headers";
import { LEVEL_UP_COOKIE as COOKIE_NAME } from "@/lib/level-up-cookie";

/**
 * 升級慶祝訊號：server action 在寵物升級時寫一個短效 cookie，
 * 由 LevelUpToast（client）在下一次渲染讀取並清除，顯示「升級了！」慶祝提示。
 *
 * 用 cookie 而非 server action 回傳值，是因為頁面上的互動都走 <form action={...}>，
 * 表單動作的回傳值不會回流到 server component。cookie 能跨 revalidate 後的重新渲染傳遞一次性訊號。
 */

/** 在 server action 內呼叫：記錄「升到第 newLevel 級、共升 levels 級」的一次性訊號。 */
export async function setLevelUpSignal(newLevel: number, levels: number): Promise<void> {
  if (levels <= 0) return;
  const store = await cookies();
  store.set(COOKIE_NAME, `${newLevel}:${levels}`, {
    path: "/",
    maxAge: 30, // 短效：僅供下一次渲染消費，避免殘留
    httpOnly: false, // 需讓 client 元件讀取
    sameSite: "lax",
  });
}

export interface LevelUpSignal {
  newLevel: number;
  levels: number;
}

/** 在 server component 內呼叫：讀出升級訊號（不清除。清除交給 client 端避免破壞渲染快取）。 */
export async function readLevelUpSignal(): Promise<LevelUpSignal | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [lvl, lvls] = raw.split(":");
  const newLevel = Number.parseInt(lvl, 10);
  const levels = Number.parseInt(lvls, 10);
  if (!Number.isFinite(newLevel) || !Number.isFinite(levels) || levels <= 0) {
    return null;
  }
  return { newLevel, levels };
}
