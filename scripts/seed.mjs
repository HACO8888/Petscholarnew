import postgres from "postgres";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// 從 legacy 的 boardsData.js 取出 BOARDS_DATA（檔案僅宣告一個 const）
const src = readFileSync("legacy/data/boardsData.js", "utf8");
const BOARDS_DATA = Function(src + "; return BOARDS_DATA;")();

// 從 legacy 的 userData.js 取出 SHOP_ITEMS（商城商品目錄。不再匯入任何假檢舉資料）
const userSrc = readFileSync("legacy/data/userData.js", "utf8");
const SHOP_ITEMS = Function(userSrc + "; return SHOP_ITEMS;")();

// 國立臺北科技大學（NTUT / Taipei Tech）大學部所有科系，依 6 學院分組。
// college 對應 board.id（cmee/ceecs/coe/com/cod/chss）。id 採英數 slug，作為 department PK。
// 來源核對：boardsData.js 既有清單 + NTUT 官方招生網站（六學院 25 系/學士班）。
const DEPARTMENTS = [
  // 機電學院 cmee
  { id: "mechanical-eng", name: "機械工程系", college: "cmee" },
  { id: "vehicle-eng", name: "車輛工程系", college: "cmee" },
  { id: "energy-refrigerating-ac-eng", name: "能源與冷凍空調工程系", college: "cmee" },
  { id: "cmee-bachelor", name: "機電學士班", college: "cmee" },
  // 電資學院 ceecs
  { id: "electrical-eng", name: "電機工程系", college: "ceecs" },
  { id: "electronic-eng", name: "電子工程系", college: "ceecs" },
  { id: "computer-science-info-eng", name: "資訊工程系", college: "ceecs" },
  { id: "electro-optical-eng", name: "光電工程系", college: "ceecs" },
  { id: "ceecs-bachelor", name: "電資學士班", college: "ceecs" },
  // 工程學院 coe
  { id: "civil-eng", name: "土木工程系", college: "coe" },
  { id: "chemical-eng-biotech", name: "化學工程與生物科技系", college: "coe" },
  { id: "molecular-science-eng", name: "分子科學與工程系", college: "coe" },
  { id: "materials-resources-eng", name: "材料及資源工程系", college: "coe" },
  { id: "coe-bachelor", name: "工程科技學士班", college: "coe" },
  // 管理學院 com
  { id: "industrial-eng-management", name: "工業工程與管理系", college: "com" },
  { id: "business-management", name: "經營管理系", college: "com" },
  { id: "info-finance-management", name: "資訊與財金管理系", college: "com" },
  // 設計學院 cod
  { id: "architecture", name: "建築系", college: "cod" },
  { id: "industrial-design", name: "工業設計系", college: "cod" },
  { id: "interaction-design", name: "互動設計系", college: "cod" },
  { id: "cod-bachelor", name: "創意設計學士班", college: "cod" },
  // 人文與社會科學學院 chss
  { id: "applied-english", name: "應用英文系", college: "chss" },
  { id: "cultural-industry-development", name: "文化事業發展系", college: "chss" },
];

const STUDY_ROOMS = [
  { id: "room-calculus", name: "微積分衝刺房", subject: "微積分", description: "一起攻克期末微積分，互相督促進度！", capacity: 8 },
  { id: "room-circuit", name: "電路學讀書會", subject: "電路學", description: "電機電子人集合，討論電路與訊號。", capacity: 6 },
  { id: "room-thermo", name: "熱力學自習室", subject: "熱力學", description: "機械系熱流組共讀空間。", capacity: 6 },
  { id: "room-program", name: "程式設計實戰房", subject: "程式設計", description: "資工/資管 coding 馬拉松。", capacity: 10 },
  { id: "room-english", name: "學術英文寫作房", subject: "學術英文", description: "論文與簡報英文寫作互助。", capacity: 5 },
];

await sql`TRUNCATE "comment", "post", "board" RESTART IDENTITY CASCADE`;
// shop_item 重置（會連帶清空 inventory FK）
await sql`TRUNCATE "shop_item" RESTART IDENTITY CASCADE`;

let itemOrder = 0;
let itemCount = 0;
for (const it of SHOP_ITEMS) {
  await sql`
    INSERT INTO "shop_item" (id, name, grade, price, hp_restore, exp_gain, icon, image, description, type, accessory_type, min_level, sort_order)
    VALUES (${it.id}, ${it.name}, ${it.grade ?? null}, ${it.price ?? 0}, ${it.hpRestore ?? 0}, ${it.expGain ?? 0}, ${it.icon ?? null}, ${it.image ?? null}, ${it.description ?? null}, ${it.type === "accessory" ? "accessory" : "food"}, ${it.accessoryType ?? null}, ${it.minLevel ?? 0}, ${itemOrder++})
  `;
  itemCount++;
}

let order = 0;
let boardCount = 0;

// 只灌入「結構性」看板定義。不灌任何假貼文／假留言，避免假使用者活動污染
// 討論版、看板提問數、排行榜、教授/管理後台。真實內容由使用者實際發問/回覆產生。
for (const key of Object.keys(BOARDS_DATA)) {
  const b = BOARDS_DATA[key];
  await sql`
    INSERT INTO "board" (id, name, icon, color, description, departments, sort_order)
    VALUES (${b.id}, ${b.name}, ${b.icon ?? null}, ${b.color ?? null}, ${b.description ?? null}, ${sql.json(b.departments ?? [])}, ${order++})
  `;
  boardCount++;
}

// 自習室
await sql`TRUNCATE "study_room" RESTART IDENTITY CASCADE`;
let roomOrder = 0;
for (const r of STUDY_ROOMS) {
  await sql`
    INSERT INTO "study_room" (id, name, subject, description, capacity, sort_order)
    VALUES (${r.id}, ${r.name}, ${r.subject}, ${r.description}, ${r.capacity}, ${roomOrder++})
  `;
}

// 科系清單（由管理員維護。所有「選科系」處只能從此清單選）
await sql`TRUNCATE "department" RESTART IDENTITY CASCADE`;
let deptOrder = 0;
for (const d of DEPARTMENTS) {
  await sql`
    INSERT INTO "department" (id, name, college, sort_order)
    VALUES (${d.id}, ${d.name}, ${d.college ?? null}, ${deptOrder++})
  `;
}

// 檢舉案件：清空既有假檢舉，不再灌入任何示範資料（真實檢舉由使用者操作產生）
await sql`TRUNCATE "report" RESTART IDENTITY CASCADE`;

await sql.end();
console.log(
  `seeded: ${boardCount} boards, ${itemCount} shop items, ${STUDY_ROOMS.length} rooms, ${DEPARTMENTS.length} departments（無假貼文/留言/檢舉）`,
);
