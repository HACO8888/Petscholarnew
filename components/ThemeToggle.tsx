"use client";

import { useSyncExternalStore } from "react";

/** 深淺模式切換鈕：以 documentElement 的 .dark class 為單一狀態來源，
 *  寫入 localStorage 並廣播事件，讓多個切換鈕同步。 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const isDark = useSyncExternalStore(
    (cb) => {
      window.addEventListener("petscholar-theme-change", cb);
      return () => window.removeEventListener("petscholar-theme-change", cb);
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("petscholar-theme", next ? "dark" : "light");
    } catch {}
    window.dispatchEvent(new Event("petscholar-theme-change"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`p-2 rounded-full hover:bg-surface-container-highest transition-colors shrink-0 ${className}`}
      title="切換深淺模式"
      aria-label="切換深淺模式"
    >
      <span className="material-symbols-outlined">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
