import Link from "next/link";

export default function AccessDenied({ need }: { need: string }) {
  return (
    <section className="flex flex-col items-center justify-center py-24 text-center">
      <span className="material-symbols-outlined text-[48px] text-error">lock</span>
      <h1 className="mt-2 text-headline-md font-semibold text-on-background">權限不足</h1>
      <p className="mt-1 text-body-md text-secondary">此頁面僅限「{need}」身分存取。</p>
      <Link
        href="/boards"
        className="mt-lg rounded-full bg-primary px-4 py-2 text-label-md font-medium text-on-primary no-underline transition-all hover:bg-surface-tint"
      >
        回到看板
      </Link>
    </section>
  );
}
