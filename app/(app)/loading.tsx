export default function Loading() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-label="載入中"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
      <span className="sr-only">載入中…</span>
    </div>
  );
}
