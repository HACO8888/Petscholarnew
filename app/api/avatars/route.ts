import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { putObject, deleteObject } from "@/lib/s3";

/**
 * 上傳自訂頭像到 MinIO，並把 users.image 更新為本站服務 URL。
 * 前端以 multipart/form-data 送 avatar 檔。
 * users.image 格式：/api/avatars/file?key={encodeURIComponent(key)}
 * 若舊頭像也是本站 avatar（同前綴），順手刪除舊物件避免孤兒檔。
 */
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB 上限
const AVATAR_FILE_PREFIX = "/api/avatars/file";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/** 從舊的本站 avatar image URL 取回 object key（非本站 avatar 則回 null）。 */
function extractOwnAvatarKey(image: string | null | undefined): string | null {
  if (!image || !image.startsWith(AVATAR_FILE_PREFIX)) return null;
  const q = image.indexOf("?");
  if (q < 0) return null;
  const key = new URLSearchParams(image.slice(q + 1)).get("key");
  return key && key.startsWith("avatars/") ? key : null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const file = form.get("avatar");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "缺少頭像檔案" }, { status: 400 });
  }

  const contentType = file.type || "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "只接受圖片檔案" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "檔案內容為空" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "檔案過大（上限 5MB）" }, { status: 400 });
  }

  const ext = EXT_BY_TYPE[contentType.toLowerCase()] ?? "bin";
  const key = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;

  try {
    await putObject(key, bytes, contentType);
  } catch {
    return NextResponse.json({ error: "上傳儲存失敗" }, { status: 502 });
  }

  // 讀舊 image，更新成本站服務 URL
  const [prev] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const imageUrl = `${AVATAR_FILE_PREFIX}?key=${encodeURIComponent(key)}`;
  await db.update(users).set({ image: imageUrl }).where(eq(users.id, userId));

  // 舊頭像若是本站 avatar 物件，順手刪除（失敗不影響本次上傳結果）
  const oldKey = extractOwnAvatarKey(prev?.image);
  if (oldKey && oldKey !== key) {
    try {
      await deleteObject(oldKey);
    } catch {
      // 忽略舊物件刪除失敗
    }
  }

  return NextResponse.json({ ok: true, image: imageUrl });
}
