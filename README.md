# 北科遊戲化學業交流區 (PetScholar)

結合**論壇討論**與**虛擬寵物養成**的遊戲化校園學業 Q&A 平台。使用者解答同學的課業問題賺取
金幣，用金幣在商城購買食物餵食虛擬寵物「北科科」，恢復其生命值（愛心），讓學習互助形成
遊戲化回饋。

> 本專案原為純前端靜態 Demo，現已遷移為 **Next.js 全端應用**（真實資料庫 + Google 登入），
> 部署於 **Zeabur**。舊靜態站保留在 `legacy/` 僅供參考。

---

## 🧱 技術棧
- **Next.js 16**（App Router、React 19）、**TypeScript**
- **Tailwind CSS v4**（Material 3 設計 token + 深淺模式）
- **PostgreSQL + Drizzle ORM**
- **Auth.js v5（next-auth）+ Google 登入**、資料庫 session
- **KaTeX**（數學式渲染）

---

## 🌟 核心功能
1. **跨學院看板論壇**：6 學院看板、提問列表、發問、標籤與懸賞。
2. **多層級樹狀留言**：以自我參照結構儲存巢狀回覆，支援採納解答。
3. **留言樹 SVG 視覺化**：將留言樹即時繪成 Node-Link 圖，點節點跳至對應留言。
4. **數學式渲染**：提問與留言內容支援 `$LaTeX$` 數學式（KaTeX）。
5. **虛擬寵物 + 金幣經濟**：採納得懸賞金幣、每日簽到，商城購買、餵食恢復愛心並升級。
6. **全站一致的寵物狀態**：HP/金幣存於單一資料來源，Header 在每頁顯示且永遠一致。
7. **自習室**：加入/離開讀書房間。
8. **排行榜與成就**：依被採納解答數計分；個人成就徽章。
9. **教授後台 / 系統管理後台**：依登入角色控管；管理後台含分類篩選與檢舉處理。

---

## 🚀 本機開發

### 1. 安裝
```bash
npm install
```

### 2. 設定環境變數
複製 `.env.example` 為 `.env.local` 並填入實際值：
```bash
cp .env.example .env.local
```
需要：`DATABASE_URL`（PostgreSQL）、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、
`AUTH_SECRET`（`openssl rand -base64 33`）、`AUTH_TRUST_HOST=true`。

Google Cloud Console 的 **Authorized redirect URIs** 需加入：
- `http://localhost:3000/api/auth/callback/google`（本機）
- `https://你的網域/api/auth/callback/google`（正式）

### 3. 初始化資料庫
```bash
npm run db:push    # 建立資料表
npm run db:seed    # 匯入看板/文章/樹狀留言/商城/自習室/檢舉範例資料
```

### 4. 啟動
```bash
npm run dev        # http://localhost:3000
```

> 想測試教授/管理後台：登入後到資料庫把該使用者的 `user.role` 改為 `professor` 或 `admin`。

---

## 📦 部署到 Zeabur
1. 連結 GitHub repo，Zeabur 會自動偵測 Next.js 並建置。
2. 在 Zeabur 專案設定與 `.env.example` 相同的環境變數。
3. 部署後於 Google Cloud Console 補上正式網域的 redirect URI。

---

## 📁 專案結構
詳見 [AGENTS.md](AGENTS.md)。重點：`app/`（路由與頁面）、`components/`（共用元件）、
`db/`（schema 與 Drizzle client）、`lib/`（渲染/樹/寵物工具）、`auth.ts`（登入設定）、
`scripts/seed.mjs`（資料匯入）、`legacy/`（舊站存檔）。

---

## 📊 資料結構（期末報告答詢）
- **Tree（樹）**：留言以 `comment.parentId` 自我參照構成樹；`lib/comment-tree.ts` 用 DFS 還原成
  巢狀結構渲染，`CommentTreeSvg` 計算各節點座標畫成 Node-Link 樹狀圖，點 HTML 留言 ↔ SVG 節點
  雙向對應。
- **Object / Map**：看板以 id 為鍵查找（O(1)）；前端用 `Map` 做庫存、已加入自習室等對照。
- **Array**：文章、留言、商品、排行榜等線性集合的遍歷與渲染。
