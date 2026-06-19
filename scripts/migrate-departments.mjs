import postgres from "postgres";
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

/**
 * 一次性遷移：把現有 users.department 的「手動文字值」對應到 department 清單。
 *
 * 規則：
 *   1. 完全相符清單內某系名 → 保留。
 *   2. 否則嘗試找「最接近者」：去除空白後雙向包含（例如「資工」⊆「資訊工程系」、
 *      或舊值「資訊工程學系」包含清單系名核心字）→ 對應為該系名。
 *   3. 仍無對應 → 設為 null（避免殘留任意自由文字，使下拉清單成為唯一真實來源）。
 *
 * 安全：只讀清單、只更新 users.department 文字欄位，不改 schema、不刪資料、可重複執行（idempotent）。
 *
 * 執行：
 *   DATABASE_URL=postgres://user:pass@host:5432/db node scripts/migrate-departments.mjs
 *   （或設好 .env.local 後直接 `node scripts/migrate-departments.mjs`）
 *   先預覽不寫入：在指令後加 --dry-run。
 */

const DRY_RUN = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL 未設定。請於 .env.local 設定或以環境變數帶入。");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// 正規化：去除所有空白並轉小寫，供寬鬆比對。
const norm = (s) => (s ?? "").replace(/\s+/g, "").toLowerCase();

// 取出官方清單（seed 後應已存在）。
const deptRows = await sql`SELECT name FROM "department" ORDER BY sort_order, name`;
const deptNames = deptRows.map((r) => r.name);

if (deptNames.length === 0) {
  console.error(
    "department 表為空。請先執行 `npm run db:seed`（或 node scripts/seed.mjs）灌入科系清單後再跑遷移。",
  );
  await sql.end();
  process.exit(1);
}

// 預先算好每個清單系名的正規化形式與「核心字」（去掉系/學系/班等後綴）以利寬鬆比對。
const stripSuffix = (s) =>
  s.replace(/(學系|學士班|系|班|組|所)$/u, "");
const deptMeta = deptNames.map((name) => ({
  name,
  n: norm(name),
  core: norm(stripSuffix(name)),
}));

/** 將任意輸入文字對應到清單系名，找不到回 null。 */
function mapDepartment(raw) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const v = norm(value);

  // 1. 完全相符（正規化後）
  const exact = deptMeta.find((d) => d.n === v);
  if (exact) return exact.name;

  // 2. 最接近：雙向包含（核心字層級），取核心字最長者作為最佳匹配
  const vCore = norm(stripSuffix(value));
  const candidates = deptMeta
    .filter(
      (d) =>
        (d.core && (v.includes(d.core) || vCore.includes(d.core))) ||
        (vCore && d.n.includes(vCore)),
    )
    .sort((a, b) => b.core.length - a.core.length);
  if (candidates.length > 0) return candidates[0].name;

  // 3. 找不到 → null
  return null;
}

// 逐一檢視目前所有非空 department 的使用者。
const users = await sql`
  SELECT id, department FROM "user"
  WHERE department IS NOT NULL AND btrim(department) <> ''
`;

let kept = 0;
let remapped = 0;
let cleared = 0;
const changes = [];

for (const u of users) {
  const target = mapDepartment(u.department);
  if (target === u.department) {
    kept++;
    continue;
  }
  if (target === null) {
    cleared++;
    changes.push({ id: u.id, from: u.department, to: null });
  } else {
    remapped++;
    changes.push({ id: u.id, from: u.department, to: target });
  }
  if (!DRY_RUN) {
    await sql`UPDATE "user" SET department = ${target} WHERE id = ${u.id}`;
  }
}

console.log(`${DRY_RUN ? "[dry-run] " : ""}科系遷移完成：`);
console.log(`  檢視 ${users.length} 位有填科系的使用者`);
console.log(`  保留（已相符）：${kept}`);
console.log(`  重新對應：${remapped}`);
console.log(`  清為 null（無對應）：${cleared}`);
if (changes.length > 0) {
  console.log("  變更明細：");
  for (const c of changes) {
    console.log(`    ${c.id}: 「${c.from}」 → ${c.to === null ? "null" : `「${c.to}」`}`);
  }
}

await sql.end();
