"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
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

function tabClass(active: boolean, extra = "") {
  return `tab-link px-sm h-full flex items-center text-body-md font-medium ${extra || "text-secondary"} hover:text-primary border-b-2 ${active ? "border-primary text-primary" : "border-transparent"} transition-all`;
}

export default function Header({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const role: Role = user?.role ?? "student";
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // 角色決定哪些分頁可見（由伺服器端 session 決定，使用者無法在前端偽造）。
  const tabs = [...TABS];
  const roleTabs: { href: string; label: string; extra: string }[] = [];
  if (role === "professor" || role === "admin") {
    roleTabs.push({ href: "/professor", label: "課程管理", extra: "text-purple-600 dark:text-purple-400" });
  }
  if (role === "admin") {
    roleTabs.push({ href: "/admin", label: "系統管理後台", extra: "text-red-600 dark:text-red-400" });
  }

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-surface border-b border-outline-variant/30 shadow-sm transition-colors h-16">
        <nav className="flex items-center justify-between gap-2 px-4 md:px-margin-desktop h-16">
          <div className="flex items-center min-w-0 flex-1 gap-[3em]">
            <Link
              href="/"
              className="font-bold text-headline-md text-primary dark:text-primary-fixed tracking-tight cursor-pointer no-underline whitespace-nowrap shrink-0"
            >
              PetScholar
            </Link>

            {/* 桌機完整導覽（xl 以上）。較小螢幕改用下方可橫向捲動的分頁列。 */}
            <div className="hidden xl:flex items-center gap-[3em] h-16">
              {tabs.map((t) => (
                <Link key={t.href} href={t.href} className={tabClass(isActive(t.href))}>
                  {t.label}
                </Link>
              ))}
              {roleTabs.map((t) => (
                <Link key={t.href} href={t.href} className={tabClass(isActive(t.href), t.extra)}>
                  {t.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-md shrink-0">
            <ThemeToggleButton />

            <button
              type="button"
              onClick={() => startGuidedTour()}
              className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-label-md px-3 sm:px-4 py-2 rounded-full hidden sm:flex items-center justify-center gap-1 shadow-sm transition-all whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">explore</span>
              <span className="hidden lg:inline">3分鐘簡報導覽</span>
              <span className="lg:hidden">導覽</span>
            </button>

            {user ? (
              <form action={logout}>
                <button
                  type="submit"
                  className="bg-primary text-on-primary hover:bg-surface-tint font-label-md text-label-md px-3 sm:px-4 py-2 rounded-full transition-all flex items-center gap-1 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span className="hidden sm:inline">登出</span>
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="bg-primary text-on-primary hover:bg-surface-tint font-label-md text-label-md px-3 sm:px-4 py-2 rounded-full transition-all flex items-center gap-1 whitespace-nowrap no-underline"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span className="hidden sm:inline">登入</span>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* 行動/平板導覽列：xl 以下顯示，補齊桌機完整導覽（xl 以上）之外的所有寬度，
          避免 768–1280px（如 iPad）出現完全沒有主導覽的死角。固定於底部、可橫向捲動。 */}
      <nav
        className="xl:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-outline-variant/30 shadow-[0_-1px_3px_rgba(0,0,0,0.08)] overflow-x-auto transition-colors"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        aria-label="主導覽"
      >
        <div className="flex items-stretch h-14 w-max mx-auto px-1">
          {[...tabs, ...roleTabs.map((t) => ({ href: t.href, label: t.label }))].map((t) => {
            const a = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center px-3.5 text-label-md font-medium whitespace-nowrap border-t-2 transition-colors -mt-px ${
                  a
                    ? "border-primary text-primary"
                    : "border-transparent text-secondary hover:text-primary"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <GuidedTour role={role} />
    </>
  );
}

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
    try {
      localStorage.setItem("petscholar-theme", next ? "dark" : "light");
    } catch {}
    window.dispatchEvent(new Event("petscholar-theme-change"));
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="p-2 rounded-full hover:bg-surface-container transition-colors shrink-0"
      title="切換深淺模式"
      aria-label="切換深淺模式"
    >
      <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
    </button>
  );
}
