import type { Metadata } from "next";
import "./globals.css";
import { eq } from "drizzle-orm";
import Header, { type HeaderUser } from "@/components/Header";
import Sidebar, { type SidebarData } from "@/components/Sidebar";
import { auth } from "@/auth";
import { getOrCreatePet } from "@/lib/pet";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema";

export const metadata: Metadata = {
  title: "PetScholar｜遊戲化校園學業交流區",
  description: "結合論壇討論與虛擬寵物養成的遊戲化校園學業 Q&A 平台。",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('petscholar-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

const DEFAULT_SIDEBAR: SidebarData = {
  loggedIn: false,
  role: "student",
  petName: "未命名小精靈",
  petStyle: "classic",
  hp: 500,
  maxHp: 500,
  coins: 100,
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
      .select({ name: users.name, role: users.role, petStyle: users.petStyle })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const role = (session.user.role ?? "student") as Role;

    headerUser = { name: me?.name ?? session.user.name, role };
    sidebar = {
      loggedIn: true,
      role,
      petName: pet.name,
      petStyle: me?.petStyle ?? "classic",
      hp: pet.hp,
      maxHp: pet.maxHp,
      coins: pet.coins,
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
        <Sidebar data={sidebar} />
        <main className="max-w-7xl mx-auto w-full pt-24 pb-16 px-4 md:px-margin-desktop md:pr-[calc(256px+32px)] min-h-[calc(100vh-64px)] animate-fade-in-up">
          {children}
        </main>
      </body>
    </html>
  );
}
