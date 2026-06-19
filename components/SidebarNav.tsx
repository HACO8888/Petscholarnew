"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "./nav-config";
import { startGuidedTour } from "./GuidedTour";

/** 側欄「說明」按鈕：啟動站內 3 分鐘導覽（沒有獨立說明頁，導覽即為說明來源）。 */
export function SidebarHelpButton() {
  return (
    <button
      type="button"
      onClick={() => startGuidedTour()}
      className="w-full text-on-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest transition-colors"
    >
      <span className="material-symbols-outlined">help</span>
      <span>說明與導覽</span>
    </button>
  );
}

const ITEMS = [
  { href: "/", label: "首頁", icon: "home" },
  { href: "/boards", label: "看板", icon: "dashboard" },
  { href: "/discussion", label: "討論版", icon: "forum" },
  { href: "/study-rooms", label: "自習室", icon: "menu_book" },
  { href: "/shop", label: "寵物商城", icon: "storefront" },
  { href: "/pet/feed", label: "寵物餵食", icon: "restaurant" },
  { href: "/leaderboard", label: "排行榜", icon: "leaderboard" },
  { href: "/profile", label: "個人檔案", icon: "person" },
];

export default function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const items = [...ITEMS];
  if (role === "professor" || role === "admin") {
    items.push({ href: "/professor", label: "課程教授主頁", icon: "school" });
  }
  if (role === "admin") {
    items.push({ href: "/admin", label: "系統管理後台", icon: "admin_panel_settings" });
  }

  return (
    <nav className="flex-1 flex flex-col gap-sm overflow-y-auto">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active(it.href) ? "page" : undefined}
          className={`rounded-lg flex items-center gap-md px-md py-sm transition-colors active:scale-[0.98] no-underline ${
            active(it.href)
              ? "bg-primary-container text-on-primary-container"
              : "text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          <span className="material-symbols-outlined">{it.icon}</span>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
