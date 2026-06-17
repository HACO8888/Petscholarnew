"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "./nav-config";
import { logout } from "@/app/actions/auth";

const STYLE_EMOJI: Record<string, string> = {
  classic: "🤖",
  cat: "🐱",
  dog: "🐶",
  rabbit: "🐰",
  dragon: "🐉",
};

export interface SidebarPet {
  name: string;
  hp: number;
  maxHp: number;
  coins: number;
  level: number;
  petStyle: string | null;
}

const NAV = [
  { href: "/boards", label: "看板", icon: "dashboard" },
  { href: "/shop", label: "寵物商城", icon: "storefront" },
  { href: "/pet/feed", label: "寵物餵食", icon: "pets" },
  { href: "/study-rooms", label: "自習室", icon: "menu_book" },
  { href: "/discussion", label: "討論版", icon: "forum" },
  { href: "/leaderboard", label: "排行榜", icon: "leaderboard" },
  { href: "/profile", label: "個人檔案", icon: "person" },
];

const ROLE_NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: "/professor", label: "課程管理", icon: "school", roles: ["professor", "admin"] },
  { href: "/admin", label: "系統管理後台", icon: "admin_panel_settings", roles: ["admin"] },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({
  pet,
  role,
}: {
  pet: SidebarPet | null;
  role: Role | null;
}) {
  const pathname = usePathname();
  const maxHearts = pet ? Math.max(1, Math.round(pet.maxHp / 100)) : 5;
  const fullHearts = pet ? Math.floor(pet.hp / 100) : 0;

  const navItems = [
    ...NAV,
    ...ROLE_NAV.filter((n) => role && n.roles.includes(role)),
  ];

  return (
    <aside className="fixed right-0 top-16 hidden h-[calc(100vh-64px)] w-64 flex-col border-l border-outline-variant/40 bg-surface-container p-md text-label-md shadow-md md:flex dark:bg-surface-container-high">
      {/* 寵物狀態卡 */}
      <div className="mb-xl flex flex-col items-center rounded-xl border border-outline-variant/40 bg-surface p-md text-center shadow-sm dark:bg-surface-container-low">
        {pet ? (
          <>
            <div className="mb-sm flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary-container bg-primary-container/30 text-5xl shadow-sm">
              {STYLE_EMOJI[pet.petStyle ?? "classic"] ?? STYLE_EMOJI.classic}
            </div>
            <h3 className="text-body-lg font-bold text-on-background">{pet.name}</h3>
            <p className="text-label-md text-secondary">Lv.{pet.level} · 🪙 {pet.coins}</p>
            <div className="mb-md mt-1 flex items-center justify-center gap-0.5 text-[20px] leading-none">
              {Array.from({ length: maxHearts }).map((_, i) => (
                <span key={i}>{i < fullHearts ? "❤️" : "🤍"}</span>
              ))}
            </div>
            <Link
              href="/pet/feed"
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-label-md font-bold text-on-primary no-underline transition-colors hover:bg-surface-tint"
            >
              <span className="material-symbols-outlined text-[18px]">healing</span>
              餵食寵物
            </Link>
          </>
        ) : (
          <>
            <div className="mb-sm flex h-24 w-24 items-center justify-center rounded-full border-2 border-outline-variant/40 bg-surface-container-high text-5xl">
              🥚
            </div>
            <p className="mb-md text-label-md text-secondary">登入後即可養成你的電子雞</p>
            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-label-md font-bold text-on-primary no-underline transition-colors hover:bg-surface-tint"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              登入
            </Link>
          </>
        )}
      </div>

      {/* 側邊導覽 */}
      <nav className="flex flex-1 flex-col gap-sm">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-md rounded-lg px-md py-sm no-underline transition-transform active:scale-95 ${
                active
                  ? "bg-primary-container font-medium text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-variant dark:hover:bg-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 底部 */}
      <div className="mt-auto flex flex-col gap-sm border-t border-outline-variant/40 pt-md">
        {pet ? (
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-md rounded-lg px-md py-sm text-on-surface-variant transition-colors hover:bg-surface-variant"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>登出</span>
            </button>
          </form>
        ) : null}
      </div>
    </aside>
  );
}
