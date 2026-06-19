import { eq } from "drizzle-orm";
import Sidebar, { type SidebarData } from "@/components/Sidebar";
import GuidedTour from "@/components/GuidedTour";
import VoiceCallProvider from "@/components/voice/VoiceCallProvider";
import FloatingVoiceWidget from "@/components/voice/FloatingVoiceWidget";
import { auth } from "@/auth";
import { getOrCreatePet, isCheckedInToday } from "@/lib/pet";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema";

// (app) 內所有頁面都是個人化／即時內容（側欄寵物狀態、最新貼文、自習室…），
// 一律改為動態渲染：不在 build 時靜態預渲染，build 就不需連 DB（避免無 DB 環境 build 失敗），
// 且使用者每次都看到最新資料。
export const dynamic = "force-dynamic";

const DEFAULT_SIDEBAR: SidebarData = {
  loggedIn: false,
  role: "student",
  petName: "",
  petStyle: null,
  level: 1,
  hp: 0,
  maxHp: 0,
  exp: 0,
  coins: 0,
  checkedIn: false,
  equippedHat: false,
  equippedBackground: false,
  equippedRareStyle: false,
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 側欄資料容錯：layout 自身拋錯不會被 (app)/error.tsx 接住，會直接冒泡成全域 500
  // （線上偶發 DB 連線瞬斷時就會這樣，且 Cloudflare 會把舊頁當快取送出）。
  // 因此這裡用 try/catch 保底——失敗就退回預設側欄並記 log，頁面照常渲染、不整頁 500。
  let sidebar: SidebarData = DEFAULT_SIDEBAR;

  try {
    const session = await auth();
    if (session?.user?.id) {
      const pet = await getOrCreatePet(session.user.id);
      const [me] = await db
        .select({ petStyle: users.petStyle })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      sidebar = {
        loggedIn: true,
        role: (session.user.role ?? "student") as Role,
        petName: pet.name,
        petStyle: me?.petStyle ?? "classic",
        level: pet.level,
        hp: pet.hp,
        maxHp: pet.maxHp,
        exp: pet.exp,
        coins: pet.coins,
        checkedIn: isCheckedInToday(pet.lastCheckIn),
        equippedHat: pet.equippedHat,
        equippedBackground: pet.equippedBackground,
        equippedRareStyle: pet.equippedRareStyle,
      };
    }
  } catch (e) {
    console.error("[app layout] 側欄資料載入失敗，改用預設側欄保底：", e);
    sidebar = DEFAULT_SIDEBAR;
  }

  return (
    <VoiceCallProvider>
      <Sidebar data={sidebar} />
      <main className="min-h-screen pt-14 md:pt-0 md:pl-64">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-6 md:py-8 animate-fade-in-up">
          {children}
        </div>
      </main>
      <GuidedTour role={sidebar.role} />
      {/* 持久語音：右下角浮動小視窗（不在該房頁面且通話中時顯示） */}
      <FloatingVoiceWidget />
    </VoiceCallProvider>
  );
}
