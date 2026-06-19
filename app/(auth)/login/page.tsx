import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginWithGoogle } from "@/app/actions/auth";

const UNAVAILABLE_TITLE = "目前僅支援 Google 登入";

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
            透過專業互助與循序漸進的累積，一起把學業成就再往上推一階。
          </p>
          <p className="text-body-lg text-secondary-fixed-dim">加入我們，開啟您的專屬學習旅程。</p>
        </div>
      </div>

      {/* Right Side: Login Form Area */}
      <div className="relative flex w-full items-center justify-center bg-surface p-margin-mobile lg:w-1/2 lg:p-margin-desktop">
        {/* 返回首頁（全尺寸可見） */}
        <Link
          href="/"
          className="absolute left-margin-mobile top-margin-mobile flex items-center gap-1 rounded-full px-3 py-1.5 text-label-md text-secondary hover:text-primary hover:bg-surface-container transition-colors no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          返回首頁
        </Link>

        <div className="w-full max-w-md rounded-xl border border-surface-variant bg-surface-container-lowest p-lg shadow-sm lg:p-xl">
          {/* Welcome Text */}
          <div className="mb-xl text-center">
            <h2 className="mb-xs text-headline-lg text-on-surface">歡迎回來</h2>
            <p className="text-body-md text-on-surface-variant">使用 Google 帳號登入即可開始</p>
          </div>

          {/* Tabs (登入 active; 註冊 disabled — Google 首次登入會自動建立帳號) */}
          <div className="relative mb-xl flex border-b border-outline-variant">
            <button
              type="button"
              className="flex-1 border-b-2 border-primary pb-sm text-center text-label-md uppercase tracking-wider text-primary transition-colors duration-200"
            >
              登入
            </button>
            <button
              type="button"
              disabled
              title="目前僅支援 Google 登入；首次登入會自動建立帳號"
              className="flex-1 cursor-not-allowed border-b-2 border-transparent pb-sm text-center text-label-md uppercase tracking-wider text-outline opacity-50"
            >
              註冊
            </button>
          </div>

          {/* Form Container */}
          <div className="relative">
            <div className="flex flex-col gap-md">
              {/* Email/Password are not a supported login path — shown for fidelity but disabled */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-md text-on-surface" htmlFor="login-email">
                  電子郵件
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">
                    mail
                  </span>
                  <input
                    className="w-full cursor-not-allowed rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-xl pr-sm text-body-md text-on-surface opacity-50 outline-none transition-all placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary"
                    id="login-email"
                    placeholder="name@university.edu"
                    type="email"
                    disabled
                    title={UNAVAILABLE_TITLE}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-xs">
                <label
                  className="flex justify-between text-label-md text-on-surface"
                  htmlFor="login-password"
                >
                  密碼
                  <span className="text-outline">忘記密碼？</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">
                    lock
                  </span>
                  <input
                    className="w-full cursor-not-allowed rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-xl pr-sm text-body-md text-on-surface opacity-50 outline-none transition-all placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary"
                    id="login-password"
                    placeholder="••••••••"
                    type="password"
                    disabled
                    title={UNAVAILABLE_TITLE}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled
                title={UNAVAILABLE_TITLE}
                className="mt-sm flex w-full cursor-not-allowed items-center justify-center gap-xs rounded-lg bg-primary py-sm text-label-md text-on-primary opacity-50 shadow-sm"
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
                {/* Google — the only real, working login path. Promoted as primary CTA. */}
                <form action={loginWithGoogle}>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-sm rounded-lg border border-primary bg-surface-container-lowest py-sm text-label-md font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill="#4285F4"
                        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                      />
                      <path
                        fill="#34A853"
                        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                      />
                      <path
                        fill="#EA4335"
                        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                      />
                    </svg>
                    使用 Google 帳號登入
                  </button>
                </form>

                <p className="mt-xs text-[11px] leading-4 text-outline">
                  目前僅支援 Google 登入。首次使用 Google 登入時會自動為您建立帳號。
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
