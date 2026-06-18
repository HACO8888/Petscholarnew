import Link from "next/link";
import { healPet } from "@/app/(app)/pet/actions";
import { logout } from "@/app/actions/auth";
import SidebarNav, { SidebarHelpButton } from "./SidebarNav";
import type { Role } from "./nav-config";

export interface SidebarData {
  loggedIn: boolean;
  role: Role;
  petName: string;
  petStyle: string | null;
  hp: number;
  maxHp: number;
  coins: number;
}

const STYLE_EMOJI: Record<string, string> = {
  classic: "🤖",
  cat: "🐱",
  dog: "🐶",
  rabbit: "🐰",
  dragon: "🐉",
};

export default function Sidebar({ data }: { data: SidebarData }) {
  const maxHearts = Math.max(1, Math.round(data.maxHp / 100));
  const full = Math.max(0, Math.floor(data.hp / 100));
  const hearts = "❤️".repeat(Math.min(full, maxHearts)) + "🖤".repeat(Math.max(0, maxHearts - full));
  const emoji = STYLE_EMOJI[data.petStyle ?? "classic"] ?? STYLE_EMOJI.classic;

  return (
    <aside className="hidden md:flex bg-surface-container dark:bg-surface-container-high font-label-md text-label-md shadow-md fixed right-0 top-16 h-[calc(100vh-64px)] w-64 flex-col p-md border-l border-outline-variant dark:border-outline">
      {/* Pet Status */}
      <div className="flex flex-col items-center mb-xl p-md bg-surface rounded-xl shadow-sm border border-outline-variant text-center">
        <div className={`w-24 h-24 rounded-full mb-sm border-2 border-primary-container bg-primary-container/30 shadow-sm flex items-center justify-center text-5xl ${data.loggedIn ? "" : "opacity-60 grayscale"}`}>
          {data.loggedIn ? emoji : "🥚"}
        </div>
        {data.loggedIn ? (
          <>
            <h3 className="text-xl leading-tight text-primary mb-xs font-bold break-words max-w-full">{data.petName}</h3>
            <div className="hearts-glow flex items-center justify-center gap-1 text-[22px] leading-none mb-2">{hearts}</div>
            <p className="text-[11px] text-secondary mb-0.5">生命值：{data.hp} / {data.maxHp}</p>
            <p className="text-[11px] text-secondary mb-md">金幣：{data.coins}</p>
          </>
        ) : (
          <>
            <h3 className="text-xl leading-tight text-primary mb-xs font-bold">尚未領養寵物</h3>
            <p className="text-[11px] text-secondary mb-md px-1 leading-relaxed">登入後即可領養你的學習夥伴，透過答題與簽到一起成長。</p>
          </>
        )}

        {data.loggedIn ? (
          <form action={healPet} className="w-full">
            <button
              type="submit"
              disabled={data.coins < 20 || data.hp >= data.maxHp}
              className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-on-primary-container transition-colors w-full flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">healing</span>
              <span>治療寵物（20 金幣）</span>
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-on-primary-container transition-colors w-full flex items-center justify-center gap-1 no-underline"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>登入養成寵物</span>
          </Link>
        )}
      </div>

      {/* Icon nav */}
      <SidebarNav role={data.role} />

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-sm pt-md border-t border-outline-variant">
        <SidebarHelpButton />
        {data.loggedIn ? (
          <form action={logout}>
            <button type="submit" className="w-full text-on-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined">logout</span>
              <span>登出</span>
            </button>
          </form>
        ) : (
          <Link href="/login" className="text-on-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest transition-colors no-underline">
            <span className="material-symbols-outlined">login</span>
            <span>登入</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
