import postgres from "postgres";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// 從 legacy 的 boardsData.js 取出 BOARDS_DATA（檔案僅宣告一個 const）
const src = readFileSync("legacy/data/boardsData.js", "utf8");
const BOARDS_DATA = Function(src + "; return BOARDS_DATA;")();

function parseDate(s) {
  const d = s ? new Date(s) : null;
  return d && !Number.isNaN(d.getTime()) ? d : new Date();
}

await sql`TRUNCATE "comment", "post", "board" RESTART IDENTITY CASCADE`;

let order = 0;
let boardCount = 0;
let postCount = 0;
let commentCount = 0;

for (const key of Object.keys(BOARDS_DATA)) {
  const b = BOARDS_DATA[key];
  await sql`
    INSERT INTO "board" (id, name, icon, color, description, departments, sort_order)
    VALUES (${b.id}, ${b.name}, ${b.icon ?? null}, ${b.color ?? null}, ${b.description ?? null}, ${sql.json(b.departments ?? [])}, ${order++})
  `;
  boardCount++;

  for (const p of b.posts ?? []) {
    await sql`
      INSERT INTO "post" (id, board_id, author_id, author_name, title, content, department, tags, bounty, solved, created_at)
      VALUES (${p.id}, ${b.id}, ${null}, ${p.author ?? "匿名"}, ${p.title}, ${p.content ?? ""}, ${p.department ?? null}, ${sql.json(p.tags ?? [])}, ${p.bounty ?? 0}, ${p.solved ?? false}, ${parseDate(p.timestamp)})
    `;
    postCount++;

    const insertReplies = async (replies, parentId) => {
      for (const r of replies ?? []) {
        await sql`
          INSERT INTO "comment" (id, post_id, parent_id, author_id, author_name, content, is_adopted, created_at)
          VALUES (${r.id}, ${p.id}, ${parentId}, ${null}, ${r.author ?? "匿名"}, ${r.content ?? ""}, ${r.isAdopted ?? false}, ${parseDate(r.timestamp)})
        `;
        commentCount++;
        await insertReplies(r.replies, r.id);
      }
    };
    await insertReplies(p.replies, null);
  }
}

await sql.end();
console.log(`seeded: ${boardCount} boards, ${postCount} posts, ${commentCount} comments`);
