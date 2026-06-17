# AGENTS.md

## Project Overview
本專案是「北科遊戲化學業交流區 (PetScholar)」—— 一個結合**論壇討論**與**虛擬寵物養成**的
遊戲化校園學業 Q&A 平台。使用者解答同學的課業問題賺取金幣，用金幣在商城購買食物餵食虛擬
寵物、恢復生命值（愛心），形成學習互助的遊戲化回饋。

> 原本是純前端靜態 Demo，已遷移為 **Next.js 全端應用**（含真實資料庫與登入）。
> 舊的靜態站存放在 `legacy/` 僅供參考，請勿在新功能中引用。

## Tech Stack
- **Next.js 16**（App Router、React 19、Turbopack）
- **TypeScript**（strict）
- **Tailwind CSS v4**（設計 token 移植自舊站的 Material 3 主題，定義於 `app/globals.css`）
- **PostgreSQL + Drizzle ORM**（schema 於 `db/schema.ts`，部署於 Zeabur）
- **Auth.js v5（next-auth beta）+ @auth/drizzle-adapter**，Google 登入、資料庫 session
- **KaTeX**（數學式渲染）
- 部署平台：**Zeabur**（完整 Node server，不需 basePath / 不做靜態匯出）

## File Structure
```text
app/
  layout.tsx              # root layout：載 Header、深淺模式、抓 session/寵物
  page.tsx                # 首頁 → 導向 /boards
  globals.css             # Tailwind v4 @theme：設計 token + 深色模式
  boards/                 # 看板總覽 / [board] 看板內提問列表
  posts/[id]/             # 文章內容 + 樹狀留言 + SVG；posts/new 發問；actions.ts
  discussion/             # 全站提問列表 + 狀態篩選
  pet/feed/               # 寵物餵食、簽到、配件；pet/actions.ts
  shop/                   # 寵物商城（購買）
  study-rooms/            # 自習室（加入/離開）；actions.ts
  leaderboard/            # 排行榜 + 成就
  professor/  admin/      # 教授後台 / 系統管理後台（role-gated）；admin/actions.ts
  profile/                # 個人檔案（編輯）；actions.ts
  login/                  # Google 登入
  api/auth/[...nextauth]/ # Auth.js route handler
  actions/auth.ts         # 登入/登出 server actions
components/               # Header、CommentThread、CommentTreeSvg、PetMascot...
db/                       # index.ts（Drizzle client）、schema.ts
lib/                      # rich-content（KaTeX 渲染）、comment-tree、pet、format
auth.ts                   # NextAuth 設定
scripts/seed.mjs          # 從 legacy 資料 seed DB
legacy/                   # 舊靜態站（參考用，勿引用）
```

## Conventions
- 預設使用 **Server Component**；需互動（usePathname、表單 toggle、SVG 點擊）才用 `"use client"`。
- 資料異動一律走 **Server Action**（`actions.ts`），server 端驗證身分與權限後再寫 DB。
- DB 只在 server 端透過 `db`（Drizzle）存取；schema 變更後跑 `npm run db:push`。
- 沿用 `globals.css` 既有的設計 token（如 `bg-surface`、`text-on-background`、`text-headline-md`、
  `px-margin-desktop`），不要硬寫色碼，以維持外觀一致與深淺模式。
- 機密放 `.env.local`（見 `.env.example`），**絕不 commit**。

## Commands
```bash
npm run dev         # 本機開發
npm run build       # 生產建置
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run db:push     # 套用 schema 到資料庫
npm run db:seed     # 從 legacy 資料匯入看板/文章/留言/商城/自習室/檢舉
```

## Must Have（核心功能）
- 跨學院看板、文章總覽與發問
- 文章內樹狀（巢狀）留言、採納解答
- 虛擬寵物狀態（生命值/經驗/等級）、商城購買、餵食、金幣經濟
- 排行榜與成就、自習室
- 教授後台與系統管理後台（依角色控管）

## Do Not Do
- 不要引用或修改 `legacy/`（除非是要繼續移植其內容）。
- 不要把機密寫進程式碼或 commit `.env.local`。
- 不要在 client component 直接連 DB；改用 server action / server component。
- 不要硬寫顏色；用設計 token。

## 完成定義
- `npm run lint`、`npm run typecheck`、`npm run build` 皆通過。
- 主要流程可操作且有明確輸入/處理/輸出。
- 變更涉及的查詢正確排除被封鎖（hidden）內容、權限正確把關。

## 資料結構（期末報告答詢）
雖然資料已存入 PostgreSQL，核心資料結構觀念仍適用：
- **Tree（樹）**：留言以自我參照的 `comment.parentId` 構成樹；`lib/comment-tree.ts` 以
  DFS 還原成巢狀結構渲染，並在 `CommentTreeSvg` 畫成 Node-Link 樹狀圖（點節點跳至留言）。
- **Object / Map**：看板以 id 為鍵查找；前端用 `Map` 做 O(1) 對照（如商城庫存、已加入自習室）。
- **Array**：文章、留言、商品、排行榜等線性集合。
