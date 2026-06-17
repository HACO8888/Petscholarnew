import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "PetScholar｜遊戲化校園學業交流區",
  description: "結合論壇討論與虛擬寵物養成的遊戲化校園學業 Q&A 平台。",
};

// 在 hydration 前依 localStorage 設定深淺模式，避免閃爍
const themeInitScript = `(function(){try{var t=localStorage.getItem('petscholar-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-on-background antialiased transition-colors duration-300">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-4 pt-20 pb-16 md:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
