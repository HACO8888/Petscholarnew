/**
 * 認證頁（登入）專用 layout：無頂部 navbar、無側欄，畫面置中，
 * 讓登入維持精簡、不顯示登入後才有意義的側欄。
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
      {children}
    </main>
  );
}
