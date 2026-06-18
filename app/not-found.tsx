import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-headline-lg font-semibold text-on-background">404</h1>
      <p className="mt-2 text-body-md text-secondary">找不到這個頁面。</p>
      <div className="mt-lg flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-primary px-4 py-2 text-label-md font-medium text-on-primary no-underline transition-all hover:bg-surface-tint"
        >
          回首頁
        </Link>
        <Link
          href="/boards"
          className="rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-label-md font-medium text-on-surface no-underline transition-all hover:bg-surface-container"
        >
          前往看板
        </Link>
      </div>
    </section>
  );
}
