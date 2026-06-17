"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "./nav-config";
import { logout } from "@/app/actions/auth";
import GuidedTour, { startGuidedTour } from "./GuidedTour";

export interface HeaderUser {
  name?: string | null;
  role: Role;
}

const TABS = [
  { href: "/boards", label: "看板" },
  { href: "/study-rooms", label: "自習室" },
  { href: "/discussion", label: "討論版" },
  { href: "/pet/feed", label: "寵物餵食" },
  { href: "/shop", label: "寵物商城" },
  { href: "/leaderboard", label: "排行榜與成就" },
  { href: "/profile", label: "個人檔案" },
];

const ROLE_OPTS: { value: Role; label: string }[] = [
  { value: "student", label: "一般學生" },
  { value: "ta", label: "課程助教" },
  { value: "professor", label: "課程教授" },
  { value: "admin", label: "系統管理員" },
];

function tabClass(active: boolean, extra = "") {
  return `tab-link px-sm h-full flex items-center text-body-md font-medium ${extra || "text-secondary"} hover:text-primary border-b-2 ${active ? "border-primary text-primary" : "border-transparent"} transition-all`;
}

export default function Header({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>(user?.role ?? "student");
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
    <nav className="fixed top-0 w-full z-50 flex items-center justify-between px-4 md:px-margin-desktop h-16 bg-surface border-b border-outline-variant/30 shadow-sm transition-colors">
      <div className="flex items-center flex-1 justify-between pr-xl">
        <Link
          href="/"
          className="font-bold text-headline-md text-primary dark:text-primary-fixed tracking-tight cursor-pointer no-underline"
        >
          PetScholar
        </Link>

        <div className="hidden xl:flex items-center gap-[3em] ml-auto mr-xl h-16 top-nav-fixed">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={tabClass(isActive(t.href))}>
              {t.label}
            </Link>
          ))}
          {(role === "professor" || role === "admin") && (
            <Link
              href="/professor"
              className={tabClass(isActive("/professor"), "text-purple-600 dark:text-purple-400")}
            >
              課程管理
            </Link>
          )}
          {role === "admin" && (
            <Link
              href="/admin"
              className={tabClass(isActive("/admin"), "text-red-600 dark:text-red-400")}
            >
              系統管理後台
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-md">
        <ThemeToggleButton />

        <button
          type="button"
          onClick={() => startGuidedTour()}
          className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-label-md px-4 py-2 rounded-full hidden sm:flex items-center justify-center gap-1 shadow-sm transition-all whitespace-nowrap shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">explore</span>
          <span className="hidden lg:inline">3分鐘簡報導覽</span>
          <span className="lg:hidden">簡報導覽</span>
        </button>

        <div className="hidden md:flex items-center gap-1.5 bg-surface-container-low dark:bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/30 text-xs">
          <span className="font-bold text-secondary text-[11px]">🎭 身分:</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="bg-transparent border-none p-0 focus:ring-0 text-primary dark:text-primary-fixed-dim font-bold cursor-pointer outline-none text-[11.5px]"
            aria-label="切換身分"
          >
            {ROLE_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {user ? (
          <form action={logout}>
            <button
              type="submit"
              className="bg-primary text-on-primary hover:bg-surface-tint font-label-md text-label-md px-4 py-2 rounded-full transition-all flex items-center gap-1 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>登出</span>
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="bg-primary text-on-primary hover:bg-surface-tint font-label-md text-label-md px-4 py-2 rounded-full transition-all flex items-center gap-1 whitespace-nowrap no-underline"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>登入</span>
          </Link>
        )}
      </div>
    </nav>
    <GuidedTour role={role} />
    </>
  );
}

import { useSyncExternalStore } from "react";

function ThemeToggleButton() {
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
    try { localStorage.setItem("petscholar-theme", next ? "dark" : "light"); } catch {}
    window.dispatchEvent(new Event("petscholar-theme-change"));
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="p-2 rounded-full hover:bg-surface-container transition-colors"
      title="切換深淺模式"
    >
      <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
    </button>
  );
}
