"use client";

import { useEffect, useState } from "react";
import { LEVEL_UP_COOKIE } from "@/lib/level-up-cookie";

/**
 * 升級慶祝提示：讀取由 server action 寫入的一次性 cookie（petLevelUp），
 * 顯示「升級到 Lv.X」的浮動慶祝卡片後自動消失，並立即清除 cookie 避免重播。
 *
 * 接收 server 端讀到的初值（initial）以利首屏即時顯示；client 端再做一次讀取與清除，
 * 確保 SPA 導覽與重新整理都不會重複觸發。
 */
export default function LevelUpToast({
  initialLevel,
  initialLevels,
}: {
  initialLevel: number | null;
  initialLevels: number | null;
}) {
  const [state, setState] = useState<{ level: number; levels: number } | null>(
    initialLevel != null && initialLevels != null && initialLevels > 0
      ? { level: initialLevel, levels: initialLevels }
      : null,
  );

  // 立即清除 cookie，避免下次渲染重播；並設定自動關閉計時。
  useEffect(() => {
    if (!state) return;
    document.cookie = `${LEVEL_UP_COOKIE}=; path=/; max-age=0`;
    const t = setTimeout(() => setState(null), 4200);
    return () => clearTimeout(t);
  }, [state]);

  if (!state) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
    >
      <div className="anim-float pointer-events-auto flex items-center gap-md bg-surface-container-lowest dark:bg-surface-container-high border border-tertiary-container rounded-2xl shadow-lg px-lg py-md">
        <span className="text-4xl" aria-hidden>
          🎉
        </span>
        <div className="flex flex-col">
          <span className="font-bold text-body-lg text-on-surface">
            升級啦！Lv.{state.level}
          </span>
          <span className="text-label-md text-secondary">
            {state.levels > 1
              ? `一口氣連升 ${state.levels} 級，獲得升級金幣獎勵 🪙`
              : "你的學習夥伴更強壯了，獲得升級金幣獎勵 🪙"}
          </span>
        </div>
      </div>
    </div>
  );
}
