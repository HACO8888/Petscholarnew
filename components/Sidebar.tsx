import Link from "next/link";
import { logout } from "@/app/actions/auth";
import SidebarNav, { SidebarHelpButton } from "./SidebarNav";
import SidebarShell from "./SidebarShell";
import ThemeToggle from "./ThemeToggle";
import type { Role } from "./nav-config";

export interface SidebarData {
  loggedIn: boolean;
  role: Role;
  petName: string;
  petStyle: string | null;
  hp: number;
  maxHp: number;
  coins: number;
  equippedHat: boolean;
  equippedBackground: boolean;
  equippedRareStyle: boolean;
}

/**
 * 左側欄＝純導航（品牌 / 深淺模式 / 導覽 / 登入登出）。
 * 寵物與使用者狀態統一放在右側面板（首頁的 HomeSidebar），且登入才顯示，
 * 避免左右兩處重複的寵物/登入視窗。
 */
export default function Sidebar({ data }: { data: SidebarData }) {
  return (
    <SidebarShell>
      {/* 品牌列 + 深淺模式 */}
      <div className="flex items-center justify-between gap-2 mb-md px-1 shrink-0">
        <Link
          href="/"
          className="font-bold text-headline-md text-primary dark:text-primary-fixed tracking-tight no-underline whitespace-nowrap"
        >
          PetScholar
        </Link>
        <ThemeToggle />
      </div>

      {/* 導航（個人/寵物相關項目登入後才出現） */}
      <SidebarNav role={data.role} loggedIn={data.loggedIn} />

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-sm pt-md border-t border-outline-variant shrink-0">
        <SidebarHelpButton />
        {data.loggedIn ? (
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-on-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>登出</span>
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="text-on-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest transition-colors no-underline"
          >
            <span className="material-symbols-outlined">login</span>
            <span>登入</span>
          </Link>
        )}
      </div>
    </SidebarShell>
  );
}
