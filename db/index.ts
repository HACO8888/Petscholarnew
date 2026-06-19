import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. 請在 .env.local 設定 DATABASE_URL（或於 Zeabur 設環境變數）。",
  );
}

// postgres.js client。
// prepare:false 對連線池/serverless 較友善。
// 以下逾時/回收設定用來耐受遠端 DB 的閒置連線被中斷（避免偶發 SSR 因重用死連線而拋錯 → 整頁 500）：
// - idle_timeout：閒置 20s 後主動關連線（趕在遠端/pooler 關閉之前，避免重用到已死的連線）
// - max_lifetime：連線最長存活 30 分鐘後回收
// - connect_timeout：建立連線逾時 15s 即失敗，不要無限掛住
// - max：連線池上限
const client = postgres(connectionString, {
  prepare: false,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 15,
  max: 10,
});

export const db = drizzle(client, { schema });
