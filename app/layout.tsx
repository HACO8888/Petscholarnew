import type { Metadata } from "next";
import "./globals.css";
import Header, { type HeaderUser } from "@/components/Header";
import { auth } from "@/auth";
import { getOrCreatePet } from "@/lib/pet";
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
  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    user = {
      name: session.user.name,
      image: session.user.image,
      role: (session.user.role ?? "student") as Role,
      coins: pet.coins,
      hp: pet.hp,
      maxHp: pet.maxHp,
    };
  }

  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-on-background antialiased transition-colors duration-300">
        <Header user={user} />
        <main className="mx-auto w-full max-w-7xl px-4 pt-20 pb-16 md:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
