export default function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section>
      <div className="mb-lg">
        <h1 className="text-headline-lg font-semibold text-on-background">{title}</h1>
        {description && (
          <p className="mt-1 text-body-md text-secondary">{description}</p>
        )}
      </div>
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 text-body-md text-secondary dark:bg-surface-container">
        此頁面為 Phase 1 路由骨架，功能將於後續階段實作。
      </div>
    </section>
  );
}
