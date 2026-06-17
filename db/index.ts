import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. 請在 .env.local 設定 DATABASE_URL（或於 Zeabur 設環境變數）。",
  );
}

// postgres.js client；prepare:false 對連線池/serverless 較友善
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
