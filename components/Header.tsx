"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, ROLE_OPTIONS, type NavItem, type Role } from "./nav-config";
import ThemeToggle from "./ThemeToggle";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function accentClass(item: NavItem, active: boolean) {
  if (active) return "text-primary border-primary";
  if (item.accent === "professor") return "text-purple-600 dark:text-purple-400 border-transparent hover:text-primary";
  if (item.accent === "admin") return "text-red-600 dark:text-red-400 border-transparent hover:text-primary";
  return "text-secondary border-transparent hover:text-primary";
}

export default function Header() {
  const pathname = usePathname();
  // Phase 1：身分切換為本機 demo 狀態，控制角色限定 tab 顯示；Phase 2 改由登入身分決定。
  const [role, setRole] = useState<Role>("student");

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  function handleGuidedTour() {
    // Phase 1 骨架：完整 3 分鐘簡報導覽流程將於後續階段移植。
    alert("3 分鐘簡報導覽將於後續階段提供。");
  }

  return (
    <nav className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-outline-variant/30 bg-surface px-margin-desktop shadow-sm transition-colors dark:bg-inverse-surface">
      <div className="flex flex-1 items-center justify-between pr-xl">
        {/* Brand */}
        <Link
          href="/"
          className="cursor-pointer text-headline-md font-bold tracking-tight text-primary no-underline dark:text-primary-fixed"
        >
          PetScholar
        </Link>

        {/* Desktop tabs */}
        <div className="ml-auto mr-xl hidden h-16 items-center gap-[3em] xl:flex">
          {visibleItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-full items-center whitespace-nowrap border-b-2 px-sm text-body-md font-medium transition-all ${accentClass(item, active)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-md">
        <ThemeToggle />

        {/* 3 分鐘簡報導覽（保留 demo 元件） */}
        <button
          type="button"
          onClick={handleGuidedTour}
          className="flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-label-md font-bold text-on-primary shadow-sm transition-all hover:bg-surface-tint"
        >
          <span className="material-symbols-outlined text-[16px]">explore</span>
          <span className="hidden lg:inline">3分鐘簡報導覽</span>
          <span className="lg:hidden">簡報導覽</span>
        </button>

        {/* 身分切換（保留 demo 元件） */}
        <div className="flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-1.5 text-xs dark:bg-surface-container">
          <span className="text-[11px] font-bold text-secondary">🎭 身分:</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="cursor-pointer border-none bg-transparent p-0 text-[11.5px] font-bold text-primary outline-none focus:ring-0 dark:text-primary-fixed-dim"
            aria-label="切換身分"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 登入 */}
        <Link
          href="/login"
          className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-label-md font-medium text-on-primary no-underline transition-all hover:bg-surface-tint"
        >
          <span className="material-symbols-outlined text-[18px]">login</span>
          <span>登入</span>
        </Link>
      </div>
    </nav>
  );
}
