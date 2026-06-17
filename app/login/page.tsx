import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginWithGoogle } from "@/app/actions/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/profile");
  }

  return (
    <div className="flex min-h-[70vh] w-full overflow-hidden rounded-xl border border-surface-variant bg-surface shadow-sm">
      {/* Left Side: Inspiring Academic Imagery (Hidden on mobile) */}
      <div
        className="relative hidden w-1/2 overflow-hidden bg-surface-container-high lg:flex"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBEVQ4yU9HUtksT_W_fvvJcKxh5JFtLowfVhd5M6g_SxQqhr6H5USD_EP1drz85jaY2onDjIPZDMi7CqDZQ2P1gAqZSS9YBdgCcL3FxkfZUuMuZDQTHOuGmfJMMZlmoiryUjuReI42wxOeKiRkjI1RJJQy2YRFT4OsI8CsmEjoTgLc8g9IvC9DGaLP3ATWSjd4XGT2AO4fzSpg701YhKrM7sHrqTWgllwxNXtIZUMynS28y1vaNnXHovsllM25qf4ETc921tf_dGg8k')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay to blend with brand colors */}
        <div className="absolute inset-0 bg-primary/20 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 via-transparent to-transparent" />
        {/* Brand & Quote */}
        <div className="absolute bottom-margin-desktop left-margin-desktop right-margin-desktop z-10">
          <div className="mb-lg flex items-center gap-sm">
            <span
              className="material-symbols-outlined text-tertiary-container"
              style={{ fontSize: "40px", fontVariationSettings: "'FILL' 1" }}
            >
              menu_book
            </span>
            <h1 className="text-headline-lg font-bold tracking-tight text-surface">PetScholar</h1>
          </div>
          <p className="mb-sm max-w-lg text-headline-md text-surface-container-low">
            &quot;Elevating academic achievement through professional engagement and structured
            progress.&quot;
          </p>
          <p className="text-body-lg text-secondary-fixed-dim">加入我們，開啟您的專屬學習旅程。</p>
        </div>
      </div>

      {/* Right Side: Login / Register Form Area */}
      <div className="relative flex w-full items-center justify-center bg-surface p-margin-mobile lg:w-1/2 lg:p-margin-desktop">
        {/* Mobile Brand Logo (Visible only on mobile) */}
        <div className="absolute left-margin-mobile top-margin-mobile flex items-center gap-sm lg:hidden">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontSize: "28px", fontVariationSettings: "'FILL' 1" }}
          >
            menu_book
          </span>
          <span className="text-headline-md font-bold text-primary">PetScholar</span>
        </div>

        <div className="w-full max-w-md rounded-xl border border-surface-variant bg-surface-container-lowest p-lg shadow-sm lg:p-xl">
          {/* Welcome Text */}
          <div className="mb-xl text-center">
            <h2 className="mb-xs text-headline-lg text-on-surface">歡迎回來</h2>
            <p className="text-body-md text-on-surface-variant">請登入您的帳號以繼續</p>
          </div>

          {/* Tabs */}
          <div className="relative mb-xl flex border-b border-outline-variant">
            <button
              type="button"
              className="flex-1 border-b-2 border-primary pb-sm text-center text-label-md uppercase tracking-wider text-primary transition-colors duration-200"
            >
              登入
            </button>
            <button
              type="button"
              className="flex-1 border-b-2 border-transparent pb-sm text-center text-label-md uppercase tracking-wider text-outline transition-colors duration-200 hover:text-primary"
            >
              註冊
            </button>
          </div>

          {/* Form Container */}
          <div className="relative">
            {/* Login Form */}
            <div className="flex flex-col gap-md">
              <div className="flex flex-col gap-xs">
                <label className="text-label-md text-on-surface" htmlFor="login-email">
                  電子郵件
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">
                    mail
                  </span>
                  <input
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-xl pr-sm text-body-md text-on-surface outline-none transition-all placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary"
                    id="login-email"
                    placeholder="name@university.edu"
                    type="email"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-xs">
                <label
                  className="flex justify-between text-label-md text-on-surface"
                  htmlFor="login-password"
                >
                  密碼
                  <a
                    className="text-primary transition-colors hover:text-primary-container"
                    href="#"
                  >
                    忘記密碼？
                  </a>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">
                    lock
                  </span>
                  <input
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-xl pr-sm text-body-md text-on-surface outline-none transition-all placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary"
                    id="login-password"
                    placeholder="••••••••"
                    type="password"
                  />
                </div>
              </div>

              <button
                type="button"
                className="mt-sm flex w-full items-center justify-center gap-xs rounded-lg bg-primary py-sm text-label-md text-on-primary shadow-sm transition-colors hover:bg-on-primary-container"
              >
                登入
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  arrow_forward
                </span>
              </button>

              {/* Divider */}
              <div className="my-sm flex items-center gap-sm">
                <div className="h-px flex-1 bg-outline-variant" />
                <span className="text-label-md text-outline">或透過以下方式</span>
                <div className="h-px flex-1 bg-outline-variant" />
              </div>

              {/* Social Logins */}
              <div className="flex flex-col gap-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-sm rounded-lg border border-outline-variant bg-surface-container py-sm text-label-md text-on-surface transition-colors hover:bg-surface-container-highest"
                >
                  <span className="material-symbols-outlined text-on-surface-variant">school</span>
                  北科校園入口登入
                </button>

                <form action={loginWithGoogle}>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-sm rounded-lg border border-outline-variant bg-surface-container py-sm text-label-md text-on-surface transition-colors hover:bg-surface-container-highest"
                  >
                    <span className="font-bold text-on-surface-variant">G</span>
                    Google 帳號登入
                  </button>
                </form>

                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-sm rounded-lg border border-outline-variant bg-surface-container py-sm text-label-md text-on-surface transition-colors hover:bg-surface-container-highest"
                >
                  <span className="text-lg font-bold text-on-surface-variant"></span>
                  Apple 帳號登入
                </button>

                <p className="mt-xs text-[11px] leading-4 text-outline">
                  此頁已串接北科校園入口、Google、Apple 登入流程；正式驗證前請先在根目錄{" "}
                  <code>auth-config.js</code> 填入各平台核發的 Client ID / Service ID / SSO
                  授權網址。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background element right side */}
        <div className="pointer-events-none absolute bottom-0 right-0 -mb-32 -mr-32 h-64 w-64 rounded-full bg-primary-container opacity-20 blur-3xl" />
      </div>
    </div>
  );
}
