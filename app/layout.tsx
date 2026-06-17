import type { Metadata } from "next";
import "./globals.css";
import { and, eq, gt } from "drizzle-orm";
import Header, { type HeaderUser } from "@/components/Header";
import Sidebar, { type SidebarData } from "@/components/Sidebar";
import { auth } from "@/auth";
import { getOrCreatePet, isSameDay } from "@/lib/pet";
import { db } from "@/db";
import { users, shopItems, inventory } from "@/db/schema";
import type { Role } from "@/db/schema";

export const metadata: Metadata = {
  title: "PetScholar｜遊戲化校園學業交流區",
  description: "結合論壇討論與虛擬寵物養成的遊戲化校園學業 Q&A 平台。",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('petscholar-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

const DEFAULT_SIDEBAR: SidebarData = {
  loggedIn: false,
  userName: "新同學",
  userDept: "請選擇系所",
  petName: "未命名小精靈",
  level: 1,
  hp: 500,
  maxHp: 500,
  exp: 0,
  coins: 100,
  checkedIn: false,
  quickFeed: [],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  let headerUser: HeaderUser | null = null;
  let sidebar: SidebarData = DEFAULT_SIDEBAR;

  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    const [me] = await db
      .select({ name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const food = await db
      .select({
        itemId: inventory.itemId,
        name: shopItems.name,
        icon: shopItems.icon,
        quantity: inventory.quantity,
      })
      .from(inventory)
      .innerJoin(shopItems, eq(inventory.itemId, shopItems.id))
      .where(and(eq(inventory.userId, session.user.id), eq(shopItems.type, "food"), gt(inventory.quantity, 0)))
      .limit(4);

    headerUser = {
      name: me?.name ?? session.user.name,
      role: (session.user.role ?? "student") as Role,
    };
    sidebar = {
      loggedIn: true,
      userName: me?.name ?? session.user.name ?? "同學",
      userDept: "請選擇系所",
      petName: pet.name,
      level: pet.level,
      hp: pet.hp,
      maxHp: pet.maxHp,
      exp: pet.exp,
      coins: pet.coins,
      checkedIn: isSameDay(pet.lastCheckIn, new Date()),
      quickFeed: food,
    };
  }

  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+TC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-on-background antialiased transition-colors duration-300">
        <Header user={headerUser} />
        <div className="flex flex-col xl:flex-row relative max-w-7xl mx-auto w-full pt-20 pb-16 px-4 md:px-8 gap-lg">
          <main className="flex-1 min-h-[calc(100vh-144px)] animate-fade-in-up">{children}</main>
          <Sidebar data={sidebar} />
        </div>
      </body>
    </html>
  );
}
