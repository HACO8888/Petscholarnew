"use client";
/* eslint-disable react-hooks/set-state-in-effect -- 導覽於 mount/resize 時量測目標位置更新 spotlight，屬合理用法 */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "./nav-config";

// ==========================================================================
// 3 分鐘簡報導覽 (Guided Tour)
// 參考 legacy/script.js 的 GUIDE_TOUR_STEPS / startGuidedTour 實作為 React 版本。
// ==========================================================================

const START_TOUR_EVENT = "petscholar-start-tour";

/** 從任意 client 元件觸發導覽（Header 按鈕使用）。 */
export function startGuidedTour() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}

interface GuideStep {
  /** 對應導覽列分頁，用於 spotlight 指向與「前往此分頁」。 */
  href: string;
  /** 導覽列分頁連結的選擇器（指向用）。 */
  selector: string;
  title: string;
  message: string;
  adminOnly?: boolean;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    href: "/boards",
    selector: 'a[href="/boards"]',
    title: "看板",
    message:
      "這裡是全站問題入口，可以依學院與科系快速找到課業提問，也可以按『發佈新提問』提出問題。",
  },
  {
    href: "/study-rooms",
    selector: 'a[href="/study-rooms"]',
    title: "自習室",
    message:
      "自習室用來模擬共讀與學習小組，學生可以查看不同讀書房間、加入討論並完成讀書目標。",
  },
  {
    href: "/discussion",
    selector: 'a[href="/discussion"]',
    title: "討論版",
    message:
      "討論版集中顯示提問與解答。發佈問題後會出現在這裡，也能檢視懸賞、狀態與回覆。",
  },
  {
    href: "/pet/feed",
    selector: 'a[href="/pet/feed"]',
    title: "寵物餵食",
    message:
      "答題或簽到得到金幣後，可以購買道具並在這裡餵食寵物，恢復生命值與經驗值。",
  },
  {
    href: "/shop",
    selector: 'a[href="/shop"]',
    title: "寵物商城",
    message: "商城可以購買食物、裝飾與道具。購買後金幣餘額會即時同步到所有分頁。",
  },
  {
    href: "/leaderboard",
    selector: 'a[href="/leaderboard"]',
    title: "排行榜與成就",
    message: "這裡展示學術排行榜、徽章與成就，讓學習互助形成遊戲化回饋。",
  },
  {
    href: "/profile",
    selector: 'a[href="/profile"]',
    title: "個人檔案",
    message:
      "個人檔案可以設定身分、性別、頭像、電子雞造型，也能查看自己的提問紀錄。",
  },
  {
    href: "/admin",
    selector: 'a[href="/admin"]',
    title: "系統管理後台",
    adminOnly: true,
    message:
      "系統管理員可以查看上線狀態、全站提問紀錄、檢舉案件、封鎖帳號與學習方向分析。",
  },
];

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function GuidedTour({ role = "student" }: { role?: Role }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spot, setSpot] = useState<SpotRect | null>(null);

  const steps = GUIDE_STEPS.filter((s) => !s.adminOnly || role === "admin");
  const total = steps.length;
  const step = steps[stepIndex];

  // 監聽 Header 按鈕觸發的事件。
  useEffect(() => {
    function onStart() {
      setActive((prev) => {
        if (prev) return false; // 再按一次=結束導覽
        setStepIndex(0);
        return true;
      });
    }
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    setSpot(null);
  }, []);

  // 計算目前分頁連結位置（用於 spotlight 指向）。
  const measure = useCallback(() => {
    if (!active || !step) return;
    const el = document.querySelector<HTMLElement>(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
        return;
      }
    }
    setSpot(null); // 目標不存在（如窄螢幕隱藏導覽列）→ 置中顯示
  }, [active, step]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!active) return;
    function onResize() {
      measure();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, measure]);

  // 鍵盤操作：Esc 結束、左右切換步驟。
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight") setStepIndex((i) => Math.min(i + 1, total - 1));
      else if (e.key === "ArrowLeft") setStepIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, total, stop]);

  if (!active || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  function next() {
    if (isLast) {
      stop();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, total - 1));
  }
  function prev() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }
  function goToTab() {
    router.push(step.href);
  }

  // 卡片定位：若有指向目標，置於目標下方並對齊；否則畫面置中。
  const cardStyle: React.CSSProperties = spot
    ? {
        position: "fixed",
        top: Math.min(spot.top + spot.height + 14, window.innerHeight - 24),
        left: Math.min(
          Math.max(spot.left + spot.width / 2 - 180, 12),
          window.innerWidth - 372,
        ),
        width: 360,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 360,
        maxWidth: "calc(100vw - 24px)",
      };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="網站導覽">
      {/* 遮罩，點擊可結束 */}
      <div
        className="absolute inset-0 bg-black/55 transition-opacity"
        onClick={stop}
      />

      {/* spotlight：以 box-shadow 鏤空目標區域 */}
      {spot && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all"
          style={{
            top: spot.top - 6,
            left: spot.left - 8,
            width: spot.width + 16,
            height: spot.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      {/* 提示卡 */}
      <div
        style={cardStyle}
        className="bg-surface text-on-surface rounded-2xl shadow-2xl border border-outline-variant/30 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-label-sm text-secondary font-bold">
              互動式網站導覽 {stepIndex + 1} / {total}
            </p>
            <h3 className="font-bold text-title-lg text-on-surface mt-0.5">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={stop}
            title="結束導覽"
            aria-label="結束導覽"
            className="text-secondary hover:text-error transition-colors p-1 -m-1 rounded-full"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <p className="text-body-md text-secondary leading-relaxed mb-4">{step.message}</p>

        <div className="flex flex-wrap gap-2 justify-between items-center">
          <button
            type="button"
            onClick={prev}
            disabled={isFirst}
            className="px-3 py-2 rounded-lg border border-outline-variant/40 text-label-md font-bold text-secondary bg-surface-container-low hover:bg-surface-container transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            上一步
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goToTab}
              className="px-3 py-2 rounded-lg border border-primary/30 text-label-md font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              前往此分頁
            </button>
            <button
              type="button"
              onClick={next}
              className="px-3 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold hover:bg-surface-tint transition-colors"
            >
              {isLast ? "完成導覽" : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
