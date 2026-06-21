import postgres from "postgres";
import { randomUUID } from "crypto";
import { config } from "dotenv";

// 一次性補資料：為每位現有寵物錢包補一筆「期初餘額」金幣紀錄，
// 讓新上線的「金幣紀錄」清單從正確的累計餘額起算。
// 冪等：只處理「目前完全沒有任何金幣紀錄」的使用者，可安全重跑。
// 用法：npm run db:push 後執行 `node scripts/backfill-coin-opening.mjs`

config({ path: [".env.local", ".env"] });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL 未設定（請確認 .env.local 或環境變數）。");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function main() {
  const targets = await sql`
    SELECT p.user_id, p.coins
    FROM pet p
    WHERE NOT EXISTS (
      SELECT 1 FROM coin_transaction ct WHERE ct.user_id = p.user_id
    )
  `;

  if (targets.length === 0) {
    console.log("沒有需要補期初餘額的使用者（全部已有金幣紀錄）。");
    return;
  }

  for (const p of targets) {
    await sql`
      INSERT INTO coin_transaction
        (id, user_id, amount, balance_after, reason, description, ref_id, created_at)
      VALUES
        (${randomUUID()}, ${p.user_id}, ${p.coins}, ${p.coins}, 'opening', '期初餘額', NULL, now())
    `;
  }

  console.log(`已為 ${targets.length} 位使用者補上「期初餘額」紀錄。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
