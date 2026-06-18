/**
 * 認證頁（登入）專用 layout：只提供置中容器與避開固定 Header 的上方留白，
 * 不掛 (app) 的右側寵物側欄，讓登入畫面維持精簡、不顯示登入後才有意義的側欄。
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 min-h-[calc(100vh-64px)]">
      {children}
    </main>
  );
}
