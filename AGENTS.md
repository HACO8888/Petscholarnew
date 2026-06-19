# AGENTS.md

## Project Overview
「北科遊戲化學業交流區 (PetScholar)」—— 結合**論壇討論**、**虛擬寵物養成**與**即時共讀
（聊天 / 語音 / 視訊）**的遊戲化校園學業 Q&A 平台。使用者解答同學課業問題賺金幣，用金幣在
商城購買食物餵食虛擬寵物、養成等級，形成學習互助的遊戲化回饋。自習室提供番茄鐘、目標與
即時文字/語音/視訊共讀。

> 原本是純前端靜態 Demo，已遷移並擴充為 **Next.js 全端應用 + 自訂 Socket.IO 伺服器**
> （真實資料庫、登入、即時通訊、物件儲存、WebRTC）。
> 舊靜態站存放在 `legacy/` 僅供參考，請勿在新功能中引用（除非是繼續移植其內容）。

## Tech Stack
- **Next.js 16**（App Router、React 19）。**TypeScript**（strict）
- **Tailwind CSS v4**（設計 token 移植自舊站 Material 3 主題，定義於 `app/globals.css`）
- **PostgreSQL + Drizzle ORM**（schema 於 `db/schema.ts`）
- **Auth.js v5（next-auth beta）+ @auth/drizzle-adapter**，Google 登入、資料庫 session
- **自訂 Node 伺服器 `server.mjs` + Socket.IO**：即時文字聊天、留言即時化、WebRTC 語音/視訊信令。多實例用 **Redis** adapter
- **MinIO / S3 相容物件儲存**（`lib/s3.ts`）：自訂頭像、留言/發問附圖、語音/視訊錄製
- **WebRTC（mesh）+ Cloudflare TURN**：自習室即時語音/視訊。強制錄製、`@sapphi-red/web-noise-suppressor`（RNNoise）AI 降噪
- **KaTeX**（數學式）
- 部署平台：**Zeabur**（完整 Node server。啟動指令需為 `npm start` = 自訂伺服器）

## File Structure
```text
server.mjs                # 自訂伺服器：Next + Socket.IO（聊天 chat:* / 留言 comment:* / 語音 voice:*）+ Redis adapter
app/
  layout.tsx              # root layout：theme init script、字型、metadata(SEO/OG)
  opengraph-image.tsx     # 自動產生的 OG 分享圖
  icon.svg                # favicon
  (app)/                  # 主應用（左側 Sidebar 殼層）。layout 抓 sidebar 寵物資料 + 掛 GuidedTour
    page.tsx              # 首頁（看板儀表板，單欄）
    boards/ discussion/   # 看板總覽 / 全站提問列表
    posts/[id]/ posts/new # 文章+即時樹狀留言（附圖/emoji）。發問。actions.ts
    pet/feed/             # 寵物餵食、簽到、配件。pet/actions.ts
    shop/                 # 寵物商城（購買、等級解鎖）
    study-rooms/          # 自習室列表 / [id] 詳情（番茄鐘/目標/即時聊天/語音視訊/管理）。actions.ts、chat-actions.ts
    leaderboard/          # 排行榜 + 成就 + 福利社。actions.ts、welfare-data.ts
    u/[userId]/           # 公開個人檔案（點頭像進入）
    professor/ admin/     # 教授後台 / 系統管理後台（role-gated）。admin/actions.ts
    profile/              # 個人檔案（編輯）。actions.ts
  (auth)/login/           # Google 登入（獨立 layout，無側欄）
  api/
    auth/[...nextauth]/   # Auth.js route handler
    turn/                 # 動態產生 Cloudflare TURN ICE servers（登入限定）
    recordings/           # 自習室語音/視訊錄製上傳 → MinIO + DB
    avatars/ avatars/file # 頭像上傳 / 串流服務
    uploads/ uploads/file # 留言/發問附圖上傳 / 串流服務
  actions/auth.ts         # 登入/登出 server actions
components/               # Sidebar/SidebarShell/SidebarNav、ThemeToggle、GuidedTour、CommentThread、CommentComposer、EmojiPicker、CommentTreeSvg、UserAvatarLink、LevelUpToast、PetMascot、StudyRoomDetail、StudyRoomCreateForm、StudyRoomEditDialog、study-room/audioProcessing.ts、admin/...
db/                       # index.ts（Drizzle client）、schema.ts
lib/                      # rich-content(KaTeX)、comment-tree、pet、format、s3、chat、level-up-*
auth.ts                  # NextAuth 設定（含 ADMIN_EMAILS 強制 admin）
scripts/                 # seed.mjs（從 legacy 資料 + 內建科系/自習室 seed）、migrate-departments.mjs
public/rnnoise/           # 第三方 RNNoise worklet/wasm（不納入 lint）
legacy/                   # 舊靜態站（參考用，勿引用）
```

## Conventions
- 預設 **Server Component**。需互動（usePathname、表單 toggle、SVG/即時/媒體）才用 `"use client"`。
- 資料異動一律走 **Server Action**（`actions.ts`），server 端驗身分與權限後再寫 DB。**絕不信任前端**。
- DB 只在 server 端透過 `db`（Drizzle）存取。schema 變更後跑 `npm run db:push`。
- **`server.mjs` 是純 Node**（不經 TS 編譯）：用 `postgres.js` 原生 SQL 存取，**id 要用 `randomUUID()` 自行產生**（Drizzle `$defaultFn` 只在 JS 端生效，DB 欄位無 default）。
- 沿用 `globals.css` 既有設計 token（`bg-surface`、`text-on-background`、`text-headline-md`、`px-margin-desktop`…），不硬寫色碼，維持外觀一致與深淺模式。
- 物件儲存統一走 `lib/s3.ts`。對外服務的 file route 需驗 key 前綴且拒絕 `..`，並回 `nosniff`/CSP。
- 機密放 `.env`（見 `.env.example`），**絕不 commit**。

## Commands
```bash
npm run dev         # node server.mjs（Next dev + Socket.IO 即時）
npm run dev:next    # 純 next dev（無即時功能）
npm run build       # 生產建置
npm run start       # 生產：node server.mjs（Zeabur 啟動指令）
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run db:push     # 套用 schema 到資料庫
npm run db:seed     # 匯入看板/科系/商城/自習室等結構資料（不含假貼文/留言）
node scripts/migrate-departments.mjs   # 把現有 users.department 對應到科系清單
```

## Must Have（核心功能）
- 跨學院看板、文章總覽與發問（可附圖）
- 文章內樹狀留言、採納解答、**即時更新 + 附圖/emoji**
- 虛擬寵物狀態（HP/EXP/等級/頭銜）、商城購買、餵食、**金幣經濟與等級解鎖**
- 自習室：番茄鐘/目標、**即時聊天/語音/視訊**、強制錄製+隱私提示、房間管理（編輯/管理員/禁麥禁鏡/踢人/密碼）
- 科系系統（管理員維護、選科系限清單）、公開個人檔案、自訂頭像
- 排行榜與成就、教授後台、系統管理後台（依角色控管、可管理所有可管理資料）

## Do Not Do
- 不要引用或修改 `legacy/`（除非繼續移植其內容）。
- 不要把機密寫進程式或 commit `.env`。
- 不要在 client component 直接連 DB。改用 server action / server component。
- 不要硬寫顏色。用設計 token。
- `server.mjs` 原生 SQL INSERT 不可漏掉 `id`（用 `randomUUID()`）。

## 完成定義
- `npm run lint`、`npm run typecheck`、`npm run build` 皆通過。
- 主要流程可操作且有明確輸入/處理/輸出。即時功能於 `npm run dev`（自訂伺服器）下實測。
- 查詢正確排除被封鎖（hidden）內容、權限正確把關。使用者資料變更會 revalidate 受影響頁（含 `/u/[id]`、`/leaderboard`）。

## 資料結構（期末報告答詢）
- **Tree（樹）**：留言以自我參照 `comment.parentId` 構成樹。`lib/comment-tree.ts` 以 DFS 還原巢狀結構渲染，`CommentTreeSvg` 畫成 Node-Link 樹狀圖（點節點跳至留言）。
- **Object / Map**：看板/科系以 id 為鍵查找。前端用 `Map` 做 O(1) 對照（商城庫存、已加入自習室、語音 peer）。
- **Array**：文章、留言、商品、排行榜、聊天訊息等線性集合。
