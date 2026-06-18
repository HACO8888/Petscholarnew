"use client";

import "./globals.css";

/** 根 layout 失敗時的最後防線（取代 root layout，需自帶 html/body）。 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-background text-on-background antialiased">
        <section className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <h1 className="text-headline-md font-semibold">發生了嚴重錯誤</h1>
          <p className="mt-2 text-secondary">請重新整理頁面，或稍後再試。</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-full bg-primary px-4 py-2 text-on-primary transition-all hover:opacity-90"
          >
            重試
          </button>
        </section>
      </body>
    </html>
  );
}
