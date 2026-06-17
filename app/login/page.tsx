import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginWithGoogle } from "@/app/actions/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/profile");
  }

  return (
    <section className="flex justify-center pt-8">
      <div className="w-full max-w-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-sm dark:bg-surface-container">
        <h1 className="text-headline-md font-semibold text-on-background">登入 PetScholar</h1>
        <p className="mt-1 text-body-md text-secondary">使用 Google 帳號登入。</p>

        <form action={loginWithGoogle}>
          <button
            type="submit"
            className="mt-lg flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface px-4 py-3 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
            使用 Google 登入
          </button>
        </form>
      </div>
    </section>
  );
}
