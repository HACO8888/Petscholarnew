import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit CLI 不會自動載入 .env.local，這裡手動載入
config({ path: ".env.local" });

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
