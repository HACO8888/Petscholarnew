/**
 * PetScholar custom server：Next.js + Socket.IO（自習室文字聊天即時）。
 *
 * 為何要 custom server：
 *   Next.js App Router 沒有內建的長連線 WebSocket 伺服器。自習室聊天要「即時廣播 +
 *   DB 持久化」，因此用 Next 的 programmatic API 起 app，並在同一個 http server 掛上
 *   Socket.IO；多實例部署時用 Redis adapter 跨實例同步房間廣播。
 *
 * 跑法：
 *   開發：  npm run dev      → NODE_ENV=development node server.mjs（Next dev + 即時）
 *   生產：  npm run build && npm run start → NODE_ENV=production node server.mjs
 *
 * 注意：
 *   - 本檔以「純 Node」執行，不經過 TS 編譯，故不 import 專案的 TS 模組；DB 存取改用
 *     postgres.js 直接下 SQL（schema 與 db/schema.ts 的 chat_message 一致）。
 *   - `next build` 完全不受本檔影響（custom server 只在 runtime 生效）。
 *   - 機密一律讀 process.env（DATABASE_URL / REDIS_URL）。
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import postgres from "postgres";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const dev = process.env.NODE_ENV !== "production";

// 在建立 DB 連線前先載入 .env.local / .env（Next 的 env 規則），確保
// 頂層就能讀到 DATABASE_URL / REDIS_URL（app.prepare() 之前）。
loadEnvConfig(process.cwd(), dev);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_LIMIT = 50;

// ---- DB（postgres.js，直接下 SQL；與 db/index.ts 同一個連線字串）----
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set（custom server 需要它連 DB）。");
}
const sql = postgres(connectionString, { prepare: false });

// ---- 由 Auth.js 資料庫 session cookie 解析使用者 ----
// 資料庫 session 策略下，cookie 值即為 session.session_token，可直接查表。
async function resolveSessionUser(sessionToken) {
  if (!sessionToken) return null;
  const rows = await sql`
    SELECT s.user_id AS "userId", s.expires AS "expires", u.name AS "name"
    FROM "session" s
    JOIN "user" u ON u.id = s.user_id
    WHERE s.session_token = ${sessionToken}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires).getTime() < Date.now()) return null;
  return { id: row.userId, name: row.name ?? "成員" };
}

async function isRoomMember(roomId, userId) {
  const rows = await sql`
    SELECT 1 FROM "study_room_member"
    WHERE room_id = ${roomId} AND user_id = ${userId}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * 判斷 userId 是否為該房的「房間管理員」：
 *   建立者（study_room.created_by）/ 被指定的管理員（is_moderator）/ 系統 admin（user.role）。
 * 任一成立即可進行禁麥/禁鏡/踢人等管理操作。
 */
async function canModerateRoom(roomId, userId) {
  const rows = await sql`
    SELECT
      (r.created_by = ${userId}) AS "isOwner",
      COALESCE(m.is_moderator, false) AS "isModerator",
      (u.role = 'admin') AS "isAdmin"
    FROM "study_room" r
    LEFT JOIN "study_room_member" m
      ON m.room_id = r.id AND m.user_id = ${userId}
    LEFT JOIN "user" u ON u.id = ${userId}
    WHERE r.id = ${roomId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return false;
  return Boolean(row.isOwner || row.isModerator || row.isAdmin);
}

/** 該房建立者 userId（用於避免踢出/降權建立者）。 */
async function roomOwnerId(roomId) {
  const rows = await sql`
    SELECT created_by AS "createdBy" FROM "study_room" WHERE id = ${roomId} LIMIT 1
  `;
  return rows[0]?.createdBy ?? null;
}

/** 從房間移除某成員（踢出）。 */
async function removeRoomMember(roomId, userId) {
  await sql`
    DELETE FROM "study_room_member"
    WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
}

async function roomExists(roomId) {
  const rows = await sql`
    SELECT 1 FROM "study_room" WHERE id = ${roomId} LIMIT 1
  `;
  return rows.length > 0;
}

async function loadRoomHistory(roomId, limit = HISTORY_LIMIT) {
  const rows = await sql`
    SELECT id, room_id AS "roomId", user_id AS "userId",
           author_name AS "authorName", content, created_at AS "createdAt"
    FROM "chat_message"
    WHERE room_id = ${roomId} AND hidden = false
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `;
  return rows
    .reverse()
    .map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }));
}

async function saveMessage({ roomId, userId, authorName, content }) {
  const trimmed = content.trim().slice(0, MAX_MESSAGE_LENGTH);
  // id 須由應用端產生：DB 欄位無 default（Drizzle $defaultFn 僅 JS 端生效，原生 SQL 不適用）
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO "chat_message" (id, room_id, user_id, author_name, content)
    VALUES (${id}, ${roomId}, ${userId}, ${(authorName || "成員").slice(0, 200)}, ${trimmed})
    RETURNING id, room_id AS "roomId", user_id AS "userId",
              author_name AS "authorName", content, created_at AS "createdAt"
  `;
  const r = rows[0];
  return { ...r, createdAt: new Date(r.createdAt).toISOString() };
}

// ---- cookie 解析（不依賴外部套件）----
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function getSessionTokenFromCookies(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  // dev：authjs.session-token；production（HTTPS）：__Secure-authjs.session-token
  return (
    cookies["__Secure-authjs.session-token"] ||
    cookies["authjs.session-token"] ||
    null
  );
}

// ---- 啟動 ----
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => handle(req, res));

const io = new SocketIOServer(httpServer, {
  path: "/socket.io",
  // 同源即可，不需特別開 CORS
});

// ---- Redis adapter（多實例同步）：有 REDIS_URL 才掛 ----
if (process.env.REDIS_URL) {
  try {
    const { createClient } = await import("redis");
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    pubClient.on("error", (e) => console.error("[redis pub] ", e?.message));
    subClient.on("error", (e) => console.error("[redis sub] ", e?.message));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[socket.io] Redis adapter enabled");
  } catch (e) {
    console.error(
      "[socket.io] Redis adapter 啟用失敗，退回單機模式：",
      e?.message,
    );
  }
} else {
  console.warn("[socket.io] 未設定 REDIS_URL，使用單機 in-memory adapter");
}

// ---- 連線驗證：以 session cookie 取得 userId/name ----
io.use(async (socket, nextFn) => {
  try {
    const token = getSessionTokenFromCookies(socket.request.headers.cookie);
    const user = await resolveSessionUser(token);
    if (!user) return nextFn(new Error("unauthorized"));
    socket.data.userId = user.id;
    socket.data.userName = user.name;
    nextFn();
  } catch (err) {
    console.error("[socket.io] auth error:", err?.message);
    nextFn(new Error("auth_failed"));
  }
});

const roomChannel = (roomId) => `study-room:${roomId}`;
const voiceChannel = (roomId) => `voice:${roomId}`;

io.on("connection", (socket) => {
  // client 連線時帶上 ?roomId=...（在 handshake query），加入該房
  const roomId = socket.handshake.query?.roomId;
  if (!roomId || typeof roomId !== "string") {
    socket.emit("chat:error", { message: "缺少 roomId" });
    socket.disconnect(true);
    return;
  }

  (async () => {
    try {
      // 必須是該房成員才可進聊天室（與 join/leave 一致）
      if (!(await roomExists(roomId))) {
        socket.emit("chat:error", { message: "自習室不存在" });
        socket.disconnect(true);
        return;
      }
      if (!(await isRoomMember(roomId, socket.data.userId))) {
        socket.emit("chat:error", { message: "請先加入此自習室" });
        socket.disconnect(true);
        return;
      }

      socket.join(roomChannel(roomId));
      socket.data.roomId = roomId;

      // 回傳近 N 則歷史（不含 hidden）
      const history = await loadRoomHistory(roomId);
      socket.emit("chat:history", history);
    } catch (err) {
      console.error("[socket.io] join error:", err?.message);
      socket.emit("chat:error", { message: "加入聊天室失敗" });
      socket.disconnect(true);
    }
  })();

  // 收到訊息 → 驗證 → 寫 DB → 廣播該房
  socket.on("chat:send", async (payload, ack) => {
    try {
      const content =
        typeof payload === "string"
          ? payload
          : typeof payload?.content === "string"
            ? payload.content
            : "";
      const text = content.trim();
      const rid = socket.data.roomId;
      if (!rid) {
        if (typeof ack === "function") ack({ ok: false, error: "尚未加入" });
        return;
      }
      if (!text) {
        if (typeof ack === "function") ack({ ok: false, error: "空訊息" });
        return;
      }
      // 重新確認成員資格（防止加入後被踢仍可發言）
      if (!(await isRoomMember(rid, socket.data.userId))) {
        if (typeof ack === "function")
          ack({ ok: false, error: "已不在此自習室" });
        return;
      }

      const saved = await saveMessage({
        roomId: rid,
        userId: socket.data.userId,
        authorName: socket.data.userName,
        content: text,
      });

      io.to(roomChannel(rid)).emit("chat:message", saved);
      if (typeof ack === "function") ack({ ok: true, id: saved.id });
    } catch (err) {
      console.error("[socket.io] send error:", err?.message);
      if (typeof ack === "function") ack({ ok: false, error: "送出失敗" });
    }
  });

  // ---- WebRTC 語音通話信令（mesh）：本 server 只轉送 SDP/ICE，不碰媒體 ----
  socket.on("voice:join", async (ack) => {
    try {
      const rid = socket.data.roomId;
      if (!rid || !(await isRoomMember(rid, socket.data.userId))) {
        if (typeof ack === "function") ack({ ok: false, error: "非自習室成員" });
        return;
      }
      const ch = voiceChannel(rid);
      // 目前已在語音中的 peers（排除自己）；新加入者會主動對每個既有 peer 發 offer
      const sockets = await io.in(ch).fetchSockets();
      const peers = sockets
        .filter((s) => s.id !== socket.id)
        .map((s) => ({
          id: s.id,
          name: s.data?.userName ?? "成員",
          userId: s.data?.userId ?? null,
        }));
      socket.join(ch);
      socket.data.inVoice = true;
      socket.to(ch).emit("voice:peer-joined", {
        id: socket.id,
        name: socket.data.userName,
        userId: socket.data.userId,
      });
      if (typeof ack === "function") ack({ ok: true, peers });
    } catch (err) {
      console.error("[voice] join error:", err?.message);
      if (typeof ack === "function") ack({ ok: false, error: "加入語音失敗" });
    }
  });

  // 點對點轉送 offer / answer / ICE candidate（targeted relay）
  socket.on("voice:signal", ({ to, data } = {}) => {
    if (!to || !socket.data.inVoice) return;
    io.to(to).emit("voice:signal", {
      from: socket.id,
      fromName: socket.data.userName,
      fromUserId: socket.data.userId ?? null,
      data,
    });
  });

  // ---- 房間管理：禁麥 / 禁鏡 / 踢人（僅建立者/管理員/系統 admin） ----
  // 取得某 userId 在本房（同 roomId）目前的所有 socket。
  const socketsOfUserInRoom = async (rid, targetUserId) => {
    const all = await io.in(roomChannel(rid)).fetchSockets();
    return all.filter((s) => s.data?.userId === targetUserId);
  };

  // 共用授權檢查：回傳 { rid, targetUserId } 或在失敗時呼叫 ack 並回傳 null。
  const authorizeModAction = async (payload, ack) => {
    const rid = socket.data.roomId;
    const targetUserId = payload?.userId;
    if (!rid || typeof targetUserId !== "string" || !targetUserId) {
      if (typeof ack === "function") ack({ ok: false, error: "缺少參數" });
      return null;
    }
    if (!(await canModerateRoom(rid, socket.data.userId))) {
      if (typeof ack === "function") ack({ ok: false, error: "沒有管理權限" });
      return null;
    }
    return { rid, targetUserId };
  };

  // 強制靜音：通知目標所有 socket 停用自己的 audio track。
  socket.on("voice:force-mute", async (payload, ack) => {
    try {
      const ctx = await authorizeModAction(payload, ack);
      if (!ctx) return;
      for (const s of await socketsOfUserInRoom(ctx.rid, ctx.targetUserId)) {
        s.emit("voice:force-mute", { by: socket.data.userName });
      }
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      console.error("[voice] force-mute error:", err?.message);
      if (typeof ack === "function") ack({ ok: false, error: "操作失敗" });
    }
  });

  // 強制關鏡頭：通知目標所有 socket 停用自己的 video track。
  socket.on("voice:force-camera-off", async (payload, ack) => {
    try {
      const ctx = await authorizeModAction(payload, ack);
      if (!ctx) return;
      for (const s of await socketsOfUserInRoom(ctx.rid, ctx.targetUserId)) {
        s.emit("voice:force-camera-off", { by: socket.data.userName });
      }
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      console.error("[voice] force-camera-off error:", err?.message);
      if (typeof ack === "function") ack({ ok: false, error: "操作失敗" });
    }
  });

  // 踢出：刪除成員 + 通知該 user 所有 socket 斷線。
  socket.on("voice:kick", async (payload, ack) => {
    try {
      const ctx = await authorizeModAction(payload, ack);
      if (!ctx) return;
      // 不可踢建立者；不可踢自己
      const ownerId = await roomOwnerId(ctx.rid);
      if (ctx.targetUserId === ownerId) {
        if (typeof ack === "function") ack({ ok: false, error: "無法踢出建立者" });
        return;
      }
      if (ctx.targetUserId === socket.data.userId) {
        if (typeof ack === "function") ack({ ok: false, error: "無法踢出自己" });
        return;
      }
      await removeRoomMember(ctx.rid, ctx.targetUserId);
      for (const s of await socketsOfUserInRoom(ctx.rid, ctx.targetUserId)) {
        // 先讓對方離開語音（廣播 peer-left），再通知被踢並斷線
        if (s.data?.inVoice) {
          s.to(voiceChannel(ctx.rid)).emit("voice:peer-left", { id: s.id });
          s.leave(voiceChannel(ctx.rid));
          s.data.inVoice = false;
        }
        s.emit("room:kicked", { by: socket.data.userName });
        s.disconnect(true);
      }
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      console.error("[voice] kick error:", err?.message);
      if (typeof ack === "function") ack({ ok: false, error: "操作失敗" });
    }
  });

  const leaveVoice = () => {
    const rid = socket.data.roomId;
    if (rid && socket.data.inVoice) {
      socket.to(voiceChannel(rid)).emit("voice:peer-left", { id: socket.id });
      socket.leave(voiceChannel(rid));
      socket.data.inVoice = false;
    }
  };
  socket.on("voice:leave", leaveVoice);
  socket.on("disconnect", leaveVoice);
});

httpServer.listen(port, hostname, () => {
  console.log(
    `> PetScholar ready on http://${hostname}:${port} (${dev ? "development" : "production"})`,
  );
});
