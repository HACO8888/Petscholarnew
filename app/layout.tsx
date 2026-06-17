import type { Metadata } from "next";
import "./globals.css";
import { eq } from "drizzle-orm";
import Header, { type HeaderUser } from "@/components/Header";
import Sidebar, { type SidebarPet } from "@/components/Sidebar";
import { auth } from "@/auth";
import { getOrCreatePet } from "@/lib/pet";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema";

export const metadata: Metadata = {
  title: "PetScholar｜遊戲化校園學業交流區",
  description: "結合論壇討論與虛擬寵物養成的遊戲化校園學業 Q&A 平台。",
};

// 在 hydration 前依 localStorage 設定深淺模式，避免閃爍
const themeInitScript = `(function(){try{var t=localStorage.getItem('petscholar-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  let user: HeaderUser | null = null;
  let sidebarPet: SidebarPet | null = null;
  let role: Role | null = null;
  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    role = (session.user.role ?? "student") as Role;
    user = {
      name: session.user.name,
      image: session.user.image,
      role,
      coins: pet.coins,
      hp: pet.hp,
      maxHp: pet.maxHp,
    };
    const [me] = await db
      .select({ petStyle: users.petStyle })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    sidebarPet = {
      name: pet.name,
      hp: pet.hp,
      maxHp: pet.maxHp,
      coins: pet.coins,
      level: pet.level,
      petStyle: me?.petStyle ?? "classic",
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
        <Header user={user} />
        <Sidebar pet={sidebarPet} role={role} />
        <main className="mx-auto w-full max-w-7xl px-4 pt-24 pb-16 md:px-8 md:pr-[288px]">
          {children}
        </main>
      </body>
    </html>
  );
}
