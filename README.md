# 北科遊戲化學業交流區 (PetScholar)

結合**論壇討論**、**虛擬寵物養成**與**即時共讀（聊天 / 語音 / 視訊）**的遊戲化校園學業 Q&A 平台。
使用者解答同學的課業問題賺取金幣，用金幣在商城購買食物餵食虛擬寵物、養成等級，讓學習互助
形成遊戲化回饋。自習室提供番茄鐘、目標、即時文字/語音/視訊共讀。

> 本專案原為純前端靜態 Demo，現已遷移並擴充為 **Next.js 全端應用 + 自訂 Socket.IO 伺服器**
> （真實資料庫、Google 登入、即時通訊、物件儲存、WebRTC），部署於 **Zeabur**。
> 舊靜態站保留在 `legacy/` 僅供參考。

---

## 🧱 技術棧
- **Next.js 16**（App Router、React 19）、**TypeScript**、**Tailwind CSS v4**（Material 3 設計 token + 深淺模式）
- **PostgreSQL + Drizzle ORM**
- **Auth.js v5（next-auth）+ Google 登入**、資料庫 session
- **自訂 Node 伺服器（`server.mjs`）+ Socket.IO**：即時聊天、留言即時化、WebRTC 信令
- **Redis**：Socket.IO 跨實例 pub/sub adapter（未設定時退回單機）
- **MinIO / S3 相容物件儲存**：自訂頭像、留言/發問附圖、語音/視訊錄製檔
- **WebRTC（mesh）+ Cloudflare TURN**：自習室即時語音/視訊通話。強制錄製、RNNoise AI 降噪
- **KaTeX**（數學式渲染）

---

## 🌟 核心功能
1. **跨學院看板論壇**：6 學院看板、提問列表、發問、標籤與懸賞。發問可附圖。
2. **即時樹狀留言**：自我參照樹狀巢狀回覆、採納解答、留言樹 SVG 視覺化、**Socket.IO 即時更新**、附圖 + emoji、Enter 送出 / Shift+Enter 換行、KaTeX 數學式。
3. **虛擬寵物 + 金幣經濟 + 等級制度**：採納（含基礎獎勵）、每日簽到、升級獎勵。經驗曲線、等級頭銜、等級解鎖商品。商城購買、餵食恢復愛心並升級。
4. **自習室即時共讀**：番茄鐘、讀書目標、**即時文字聊天**、**WebRTC 語音/視訊通話**（強制錄製 + 隱私提示、Discord 風 speaking 綠光環、RNNoise 降噪）。房主可編輯房間、指定管理員、禁麥/禁鏡/踢人、設密碼。列表整卡可點、顯示創建者。
5. **科系系統**：北科 6 學院全科系清單，由管理員維護。所有「選科系」處皆下拉限清單。
6. **公開個人檔案 `/u/[id]`**：點頭像即可查看他人公開資料（系所/寵物/等級/統計）。
7. **自訂頭像上傳**（MinIO）。
8. **排行榜與成就**：探索榜（留言）、學科榜（貼文）、自習參與榜。個人成就徽章、福利社券。
9. **教授後台 / 系統管理後台**：依角色控管。後台可管理看板/貼文/留言/自習室/商城/**使用者(全資訊)**/檢舉/**聊天訊息**/**語音錄影**/**科系**。

---

## 🚀 本機開發

### 1. 安裝
```bash
npm install
```

### 2. 設定環境變數
複製 `.env.example` 為 `.env`（或 `.env.local`）並填入實際值。需要：
- 必要：`DATABASE_URL`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`AUTH_SECRET`（`openssl rand -base64 33`）、`AUTH_TRUST_HOST=true`
- 即時/媒體：`REDIS_URL`（選填，未設退回單機）、`S3_ENDPOINT/S3_REGION/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET`（頭像/附圖/錄製）、`TURN_KEY_ID/TURN_API_TOKEN`（Cloudflare TURN，語音/視訊 NAT 穿透。未設退回公共 STUN）
- 選填：`NEXT_PUBLIC_SITE_URL`（SEO/OG 絕對網址）、`ADMIN_BOOTSTRAP_EMAIL`（第一位管理員自助升級）

Google Cloud Console 的 **Authorized redirect URIs** 需加入 `http://localhost:3000/api/auth/callback/google`（本機）與 `https://你的網域/api/auth/callback/google`（正式）。

### 3. 初始化資料庫
```bash
npm run db:push    # 套用 schema 建表
npm run db:seed    # 匯入看板/科系/商城/自習室等結構資料（不含任何假貼文/留言）
```

### 4. 啟動（即時功能需自訂伺服器）
```bash
npm run dev        # node server.mjs（Next dev + Socket.IO 即時）→ http://localhost:3000
# npm run dev:next # 純 next dev（無即時聊天/語音）
```

> 即時聊天、語音/視訊、留言即時化都跑在 `server.mjs`。用 `npm run dev:next` 啟動時這些功能不會運作。
> 語音/視訊需 **HTTPS 或 localhost**（瀏覽器才給麥克風/鏡頭）。

> 測試教授/管理後台：把該使用者 `user.role` 改為 `professor`/`admin`，或設 `ADMIN_BOOTSTRAP_EMAIL` 自助升級（`auth.ts` 內 `ADMIN_EMAILS` 也會強制升級）。

---

## 📦 部署到 Zeabur
1. 連結 GitHub repo。**啟動指令必須設為 `npm start`**（= `NODE_ENV=production node server.mjs`，即時功能才運作）。建置指令 `npm run build`。
2. 在 Zeabur 設定上述所有環境變數（含 `REDIS_URL / S3_* / TURN_*`）。
3. 另需可用的 **PostgreSQL、Redis、MinIO(S3)**。語音/視訊用 **Cloudflare TURN**（免自架）。
4. 部署後於 Google Cloud Console 補上正式網域的 redirect URI。

```bash
npm run build && npm start   # 生產（自訂伺服器）
```

---

## 📁 專案結構
詳見 [AGENTS.md](AGENTS.md)。重點：`app/`（路由、頁面、`api/` 路由）、`components/`（共用元件）、
`db/`（schema、Drizzle client）、`lib/`（渲染/樹/寵物/S3/聊天工具）、`server.mjs`（自訂 Socket.IO 伺服器）、
`auth.ts`（登入）、`scripts/`（seed、科系遷移）、`public/rnnoise/`（降噪 worklet/wasm）、`legacy/`（舊站存檔）。

---

## 📊 資料結構（期末報告答詢）
- **Tree（樹）**：留言以 `comment.parentId` 自我參照構成樹。`lib/comment-tree.ts` 用 DFS 還原巢狀結構，
  `CommentTreeSvg` 計算座標畫成 Node-Link 樹狀圖，HTML 留言 ↔ SVG 節點雙向對應。
- **Object / Map**：看板/科系以 id 為鍵查找（O(1)）。前端用 `Map` 做庫存、已加入自習室、語音 peer 對照。
- **Array**：文章、留言、商品、排行榜、聊天訊息等線性集合的遍歷與渲染。
