import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://petscholarnew.haco.tw";
const SITE_DESC =
  "結合論壇討論與虛擬寵物養成的遊戲化校園學業 Q&A 平台：解答同學課業問題賺金幣，養成你的學習寵物。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PetScholar｜遊戲化校園學業交流區",
    template: "%s｜PetScholar",
  },
  description: SITE_DESC,
  applicationName: "PetScholar",
  keywords: [
    "PetScholar",
    "北科大",
    "課業問答",
    "學習社群",
    "虛擬寵物",
    "遊戲化學習",
    "自習室",
    "讀書會",
    "校園 Q&A",
  ],
  authors: [{ name: "PetScholar" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "PetScholar",
    locale: "zh_TW",
    url: SITE_URL,
    title: "PetScholar｜遊戲化校園學業交流區",
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: "PetScholar｜遊戲化校園學業交流區",
    description: SITE_DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

// 預設亮色；只有使用者曾手動切到深色（localStorage='dark'）才套深色，不跟隨系統偏好。
const themeInitScript = `(function(){try{if(localStorage.getItem('petscholar-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
        {children}
      </body>
    </html>
  );
}
