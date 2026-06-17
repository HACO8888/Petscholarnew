# PetScholar → Next.js 遷移：Phase 1 地基設計

日期：2026-06-18
狀態：設計待 review

## 背景與整體方向

PetScholar 原本是一個純前端靜態 demo（`index.html` + 212KB `script.js` + 14 個獨立的
`stitch_studypet_village 2/_N/code.html` 頁面），部署在 GitHub Pages。使用者決定把整個平台
**用最新版 Next.js 重構**，加上**真資料庫**，並**統一 header**，部署到 **Zeabur**。

由於平台包含多個獨立子系統（認證、個人檔案、看板論壇、自習室、寵物系統、商城、排行榜、
教授後台、管理後台），規模太大無法塞進單一份計畫。因此採**分階段**進行，每階段各自走
設計 → 計畫 → 實作。本文件只涵蓋 **Phase 1（地基）**。

### 階段規劃（總覽，僅 Phase 1 在本文件範圍內）

- **Phase 1（本文件）**：Next.js 專案骨架 + TypeScript + Tailwind + Drizzle/Postgres
  + 統一 Header + 全站路由殼。交付一個能跑、能切換路由、header 統一的地基。
- Phase 2：Google 登入（Auth.js 或手刻）+ session + 使用者資料表 + 個人檔案。
- Phase 3：看板/論壇 + 樹狀留言（核心資料結構功能）。
- Phase 4：寵物系統 + 商城 + 金幣。
- Phase 5：自習室、排行榜與成就、教授後台、系統管理後台。

## 已確認的關鍵決策

- 部署平台：**Zeabur**（支援完整 Next.js Node server，**不需要 basePath**）。
- 改寫策略：**保留外觀、重新重構邏輯**（不照搬舊 JS，用乾淨 React 重寫）。
- 資料層：**加真資料庫** → PostgreSQL（Zeabur 已提供連線）+ **Drizzle ORM**。
- 認證（Phase 2）：**只用 Google**，不做 Apple、不做北科 SSO。
- 舊檔：**保留但移到 `legacy/`** 資料夾當移植參考。
- Header：**保留所有元件**，包含 demo 用的「3分鐘簡報導覽」鈕與「身分切換」下拉。

## Phase 1 範圍

### 1. 技術棧與專案骨架

- **Next.js 16.2**（App Router、React 19）、**TypeScript（strict）**、ESLint。
- **Tailwind CSS v4**。
- **Drizzle ORM + drizzle-kit** + PostgreSQL（`pg` / `postgres` driver）。
- 套件管理：npm（與既有環境一致，無額外工具需求）。

### 2. Tailwind 設計 token 移植（忠實保留外觀的關鍵）

舊頁面用一套 Material Design 3 風格的設計 token（透過每頁內嵌的 `tailwind.config`）：
顏色如 `primary` / `on-background` / `surface` / `surface-container` / `outline-variant`、
字級如 `text-headline-md` / `text-body-md` / `text-label-md`、間距如 `px-margin-desktop`。

做法：把這些 token 統一移植進 Tailwind v4 的 `@theme`（`globals.css`）/設定檔，讓**舊 markup
的 class 幾乎能原樣沿用**。深色模式採 `class` 策略（`<html class="dark">`）。

### 3. 統一 Header（Phase 1 核心交付物）

單一 `components/Header.tsx`，放進 root `app/layout.tsx`，全站共用一份。內容（全部保留）：

- Brand「PetScholar」→ 連 `/`。
- 導覽 tabs：看板 / 自習室 / 討論版 / 寵物餵食 / 寵物商城 / 排行榜與成就 / 個人檔案。
  用 `next/link`，當前頁用 `usePathname()` 自動高亮（取代舊的 per-page 高亮邏輯）。
- 角色限定 tabs：課程管理（professor）、系統管理後台（admin），由「身分切換」下拉控制顯示。
- 深淺模式切換鈕（狀態存 localStorage，避免 hydration 閃爍）。
- 「3分鐘簡報導覽」鈕：**保留按鈕與位置**，Phase 1 接上骨架（點擊呼叫一個 stub），
  完整導覽流程後續階段再移植。
- 「身分切換」下拉（學生/助教/教授/管理員）：Phase 1 以本機 state 控制角色限定 tabs 的顯示，
  複製現有 demo 行為；Phase 2 接真認證後改由登入身分決定。
- 登入鈕 → `/login`。

Header 是 Client Component（需 `usePathname` + 深淺切換 + 角色 state）。

### 4. 路由殼（每頁先放標題佔位，內容由後續階段填）

| 路由 | 頁面 | 路由 | 頁面 |
|------|------|------|------|
| `/` | 首頁（導向 `/boards`） | `/shop` | 寵物商城 |
| `/boards` | 看板 | `/leaderboard` | 排行榜與成就 |
| `/study-rooms` | 自習室 | `/profile` | 個人檔案 |
| `/discussion` | 討論版 | `/login` | 登入 |
| `/pet/feed` | 寵物餵食 | | |

角色限定路由（`/professor`、`/admin`）於 Phase 2 之後加入。每個佔位頁為 Server Component，
顯示該區標題與一句說明，實際內容後續階段實作。

### 5. 資料庫（Phase 1 最小範圍）

- `db/index.ts`：Drizzle client，讀 `process.env.DATABASE_URL`。
- `db/schema.ts`：先放最小 `users` 表（id、email、display_name、role、created_at）以驗證連通性，
  schema 之後各階段再擴充。
- `drizzle.config.ts` + migration 流程（`drizzle-kit generate` / `migrate`）。
- 連線字串放 `.env.local`（列入 `.gitignore`，**不 commit**），Zeabur 後台設 `DATABASE_URL`。

### 6. 專案結構

```
app/
  layout.tsx          # root layout：Header + main 容器 + 深淺模式
  page.tsx            # 首頁 → 導向 /boards
  globals.css         # Tailwind v4 @theme：移植設計 token + 深色模式
  boards/page.tsx
  study-rooms/page.tsx
  discussion/page.tsx
  pet/feed/page.tsx
  shop/page.tsx
  leaderboard/page.tsx
  profile/page.tsx
  login/page.tsx
components/
  Header.tsx
  ThemeToggle.tsx
  nav-config.ts       # tabs 定義（label、href、角色）
db/
  index.ts
  schema.ts
drizzle.config.ts
legacy/               # 舊靜態檔（index.html、script.js、14 個 code.html、data/、auth/ 等）
.env.local            # DATABASE_URL（gitignored）
```

### 7. 資料流

- 頁面預設 Server Component；需要互動的（Header、ThemeToggle）為 Client Component。
- DB 僅在 server 端（Server Component / Route Handler）透過 Drizzle 存取。
- 深淺模式：Client 端切換，class 套在 `<html>`，狀態存 localStorage。

## 錯誤處理

- DB 連線失敗：`db/index.ts` 啟動時若缺 `DATABASE_URL` 給出明確錯誤訊息；Phase 1 頁面不直接依賴
  DB 內容，故 DB 故障不影響路由殼可瀏覽。
- 加 `app/not-found.tsx` 處理未知路由。

## 測試/驗收（Phase 1）

- `npm run build`、`npm run lint`、`tsc --noEmit`（typecheck）全過。
- `npm run dev` 後手動驗證：
  - 每個路由都能開啟，無 console error。
  - 統一 Header 在所有頁面顯示一致，當前 tab 正確高亮。
  - 深淺模式切換正常、重整後保留。
  - 身分切換下拉能正確顯示/隱藏角色限定 tabs。
- Drizzle 能成功連上 Zeabur Postgres（跑一次 migration 或簡單 select 驗證）。

## 不在 Phase 1 範圍（明確排除）

- 任何登入/認證實作（Phase 2）。
- 看板、留言、寵物、商城、排行榜等實際功能與資料（Phase 3+）。
- 完整簡報導覽流程邏輯（先留按鈕骨架）。
- 把舊 `script.js` 的功能搬進來（各功能於對應階段移植）。
