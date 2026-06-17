import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-headline-lg font-semibold text-on-background">404</h1>
      <p className="mt-2 text-body-md text-secondary">找不到這個頁面。</p>
      <Link
        href="/boards"
        className="mt-lg rounded-full bg-primary px-4 py-2 text-label-md font-medium text-on-primary no-underline transition-all hover:bg-surface-tint"
      >
        回到看板
      </Link>
    </section>
  );
}
