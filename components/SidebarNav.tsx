"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "./nav-config";

const ITEMS = [
  { href: "/boards", label: "看板", icon: "dashboard" },
  { href: "/shop", label: "寵物商城", icon: "storefront" },
  { href: "/study-rooms", label: "自習室", icon: "menu_book" },
  { href: "/discussion", label: "討論版", icon: "forum" },
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
          className={`rounded-lg flex items-center gap-md px-md py-sm transition-transform scale-95 active:scale-90 no-underline ${
            active(it.href)
              ? "bg-primary-container text-on-primary-container"
              : "text-on-surface-variant hover:bg-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-variant"
          }`}
        >
          <span className="material-symbols-outlined">{it.icon}</span>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
