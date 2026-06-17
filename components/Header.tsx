"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, ROLE_OPTIONS, type NavItem, type Role } from "./nav-config";
import ThemeToggle from "./ThemeToggle";
import { logout } from "@/app/actions/auth";

export interface HeaderUser {
  name?: string | null;
  image?: string | null;
  role: Role;
  coins: number;
  hp: number;
  maxHp: number;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function accentClass(item: NavItem, active: boolean) {
  if (active) return "text-primary border-primary";
  if (item.accent === "professor") return "text-purple-600 dark:text-purple-400 border-transparent hover:text-primary";
  if (item.accent === "admin") return "text-red-600 dark:text-red-400 border-transparent hover:text-primary";
  return "text-secondary border-transparent hover:text-primary";
}

export default function Header({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  // 身分切換為 demo 預覽，預設帶入登入者真實角色；控制角色限定 tab 顯示。
  // 真正的權限仍由 /professor、/admin 頁面 server 端依登入身分強制把關。
  const [role, setRole] = useState<Role>(user?.role ?? "student");

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  function handleGuidedTour() {
    alert("3 分鐘簡報導覽將於後續階段提供。");
  }

  return (
    <nav className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-outline-variant/30 bg-surface px-margin-desktop shadow-sm transition-colors dark:bg-inverse-surface">
      <div className="flex flex-1 items-center justify-between pr-xl">
        <Link
          href="/"
          className="cursor-pointer text-headline-md font-bold tracking-tight text-primary no-underline dark:text-primary-fixed"
        >
          PetScholar
        </Link>

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

      <div className="flex items-center gap-md">
        <ThemeToggle />

        <button
          type="button"
          onClick={handleGuidedTour}
          className="flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-label-md font-bold text-on-primary shadow-sm transition-all hover:bg-surface-tint"
        >
          <span className="material-symbols-outlined text-[16px]">explore</span>
          <span className="hidden lg:inline">3分鐘簡報導覽</span>
          <span className="lg:hidden">簡報導覽</span>
        </button>

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

        {user ? (
          <div className="flex items-center gap-2">
            {/* 全站單一資料來源的寵物 HP 與金幣，所有頁面一致 */}
            <Link
              href="/pet/feed"
              className="hidden items-center gap-1 rounded-full bg-surface-container-high px-3 py-1.5 text-label-md font-medium text-on-surface-variant no-underline md:flex"
              title="寵物狀態"
            >
              <span aria-hidden>❤️</span>
              <span>{Math.floor(user.hp / 100)}/{Math.round(user.maxHp / 100)}</span>
              <span className="ml-1 inline-flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[15px] text-tertiary">paid</span>
                {user.coins}
              </span>
            </Link>
            <Link href="/profile" className="flex items-center gap-2 no-underline" title="個人檔案">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "使用者"}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">
                  {(user.name ?? "U").charAt(0)}
                </span>
              )}
              <span className="hidden max-w-[8rem] truncate text-body-md font-medium text-on-background lg:inline">
                {user.name}
              </span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1 whitespace-nowrap rounded-full border border-outline-variant px-3 py-1.5 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
                title="登出"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span className="hidden lg:inline">登出</span>
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-label-md font-medium text-on-primary no-underline transition-all hover:bg-surface-tint"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>登入</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
