"use client";

import Link from "next/link";

/** 共用錯誤畫面：給 app/error.tsx 與 app/(app)/error.tsx 使用的友善錯誤邊界 UI。 */
export default function ErrorState({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
      <span className="material-symbols-outlined text-[48px] text-error">error</span>
      <h1 className="mt-2 text-headline-md font-semibold text-on-background">發生了一點問題</h1>
      <p className="mt-2 max-w-md text-body-md text-secondary">
        頁面處理時發生錯誤，請重試。若持續發生，請稍後再回來。
      </p>
      <div className="mt-lg flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-all hover:bg-surface-tint"
        >
          重試
        </button>
        <Link
          href="/"
          className="rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-label-md font-medium text-on-surface no-underline transition-all hover:bg-surface-container"
        >
          回首頁
        </Link>
      </div>
    </section>
  );
}
