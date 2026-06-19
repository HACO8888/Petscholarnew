"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 側欄殼層：桌機(md+)固定於左側。行動版以漢堡鈕開啟左側滑入抽屜。
 * 內容（品牌/寵物卡/導航/登入登出）由 server 端的 Sidebar 以 children 傳入。
 */
export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 換頁即自動關閉抽屜（依 pathname 同步開關狀態，屬合理用法）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // 抽屜開啟時鎖背景捲動
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <>
      {/* 行動版頂列：僅漢堡鈕 + 品牌（非完整導航） */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-2 px-3 bg-surface border-b border-outline-variant/30 shadow-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="開啟選單"
          aria-expanded={open}
          className="p-2 rounded-lg hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="font-bold text-headline-md text-primary dark:text-primary-fixed tracking-tight">
          PetScholar
        </span>
      </div>

      {/* 行動版遮罩 */}
      {open && (
        <button
          type="button"
          aria-label="關閉選單"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        />
      )}

      {/* 側欄本體：桌機固定左側。行動版抽屜 */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-72 max-w-[85vw] md:w-64 bg-surface-container dark:bg-surface-container-high font-label-md text-label-md shadow-xl md:shadow-md border-r border-outline-variant dark:border-outline flex flex-col p-md transition-transform duration-300 ease-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}
