export default function LoginPage() {
  return (
    <section className="flex justify-center pt-8">
      <div className="w-full max-w-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-sm dark:bg-surface-container">
        <h1 className="text-headline-md font-semibold text-on-background">登入 PetScholar</h1>
        <p className="mt-1 text-body-md text-secondary">使用 Google 帳號登入。</p>

        <button
          type="button"
          disabled
          className="mt-lg flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface px-4 py-3 text-body-md font-medium text-on-surface opacity-60"
          title="登入功能將於 Phase 2 提供"
        >
          <span className="material-symbols-outlined text-[20px]">login</span>
          使用 Google 登入
        </button>

        <p className="mt-md text-label-md text-secondary">
          登入功能將於 Phase 2 接上 Google OAuth。
        </p>
      </div>
    </section>
  );
}
