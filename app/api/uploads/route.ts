import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { putObject, imageExtForContentType } from "@/lib/s3";

/**
 * 上傳一張留言／發問附圖到 MinIO，回傳可顯示的本站服務 URL。
 * 前端以 multipart/form-data 送 image 檔（欄位名 image）。
 * 物件鍵：comments/{userId}/{uuid}.{ext}。回傳 URL 指向 /api/uploads/file?key=...。
 * 僅登入者可上傳。驗 content-type 為 image/* 與大小上限。
 */
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB 上限
const UPLOAD_FILE_PREFIX = "/api/uploads/file";

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

  const file = form.get("image");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "缺少圖片檔案" }, { status: 400 });
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

  const ext = imageExtForContentType(contentType);
  const key = `comments/${userId}/${crypto.randomUUID()}.${ext}`;

  try {
    await putObject(key, bytes, contentType);
  } catch {
    return NextResponse.json({ error: "上傳儲存失敗" }, { status: 502 });
  }

  const url = `${UPLOAD_FILE_PREFIX}?key=${encodeURIComponent(key)}`;
  return NextResponse.json({ ok: true, url, key });
}
