"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "@/lib/format";

export interface CoinTxView {
  id: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  description: string;
  createdAt: Date;
}

// 依異動類型給對應 Material icon，未知類型退回通用金幣圖示
const REASON_ICON: Record<string, string> = {
  ask: "post_add",
  adopt: "done_all",
  ta_verify: "verified",
  levelup: "trending_up",
  checkin: "event_available",
  purchase: "shopping_bag",
  heal: "healing",
  opening: "savings",
};

/**
 * 「金幣紀錄」彈窗：點個人檔案的總金幣卡片開啟，列出每一筆金幣增減。
 * 觸發鈕外觀沿用原統計卡，內容為可捲動的流水帳（最新在上），
 * 正數綠色、負數紅色，右側顯示異動後餘額。
 */
export default function CoinHistoryDialog({
  coins,
  transactions,
}: {
  coins: number;
  transactions: CoinTxView[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="查看金幣紀錄"
        className="bg-surface rounded-lg p-md flex flex-col justify-center items-center text-center border border-surface-container shadow-sm cursor-pointer hover:shadow-md hover:border-primary/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          className="material-symbols-outlined text-primary mb-xs"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          monetization_on
        </span>
        <span className="font-headline-md text-headline-md text-on-surface">
          {coins.toLocaleString()}
        </span>
        <span className="font-label-md text-label-md text-secondary">總金幣</span>
        <span className="mt-xs inline-flex items-center gap-0.5 font-label-md text-label-md text-primary">
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            history
          </span>
          查看紀錄
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="金幣紀錄"
              className="w-[min(30rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-surface-container-lowest dark:bg-surface-container-high rounded-2xl border border-outline-variant/40 shadow-xl"
            >
              {/* 標題 + 目前餘額 */}
              <div className="flex items-center justify-between gap-sm p-lg pb-md border-b border-outline-variant/30">
                <div className="flex items-center gap-sm min-w-0">
                  <span
                    className="material-symbols-outlined text-primary text-[22px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    aria-hidden
                  >
                    monetization_on
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-body-lg text-on-surface">金幣紀錄</h3>
                    <p className="font-label-md text-label-md text-secondary">
                      目前餘額 {coins.toLocaleString()} 金幣
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="關閉"
                  onClick={() => setOpen(false)}
                  className="shrink-0 p-1 rounded-full text-secondary hover:text-on-surface hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* 流水帳清單 */}
              <div className="flex-1 overflow-y-auto p-md">
                {transactions.length === 0 ? (
                  <div className="text-secondary font-body-md text-body-md text-center py-xl border border-dashed border-outline-variant rounded-lg">
                    尚無紀錄。獲得或花費金幣後會顯示在這裡。
                  </div>
                ) : (
                  <ul className="flex flex-col gap-xs">
                    {transactions.map((t) => {
                      const positive = t.amount >= 0;
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-sm p-sm rounded-lg bg-surface border border-outline-variant/40"
                        >
                          <span
                            className="material-symbols-outlined text-secondary text-[20px] shrink-0"
                            aria-hidden
                          >
                            {REASON_ICON[t.reason] ?? "monetization_on"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-body-md text-body-md text-on-surface truncate">
                              {t.description}
                            </p>
                            <p className="font-label-md text-label-md text-secondary">
                              {formatDateTime(t.createdAt)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`font-bold text-body-md ${
                                positive
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-500 dark:text-rose-400"
                              }`}
                            >
                              {positive ? "+" : "−"}
                              {Math.abs(t.amount).toLocaleString()}
                            </p>
                            <p className="font-label-md text-label-md text-secondary">
                              餘額 {t.balanceAfter.toLocaleString()}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
