import { NextResponse } from "next/server";
import { getObjectStream } from "@/lib/s3";

/**
 * 從 MinIO 串流回傳留言／發問附圖物件。
 * GET ?key=comments/...。附圖顯示在公開的貼文/留言中，故「不需登入」即可讀取。
 * 安全靠：key 必須以 comments/ 開頭且不含 ".."，加 nosniff/CSP 防 svg XSS。
 * comments.image / posts.image 指向本路由，故 <img src={...}> 可直接顯示。
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  // 必須以 comments/ 開頭，且不得含 ".." 以杜絕路徑穿越讀取其他前綴的物件
  if (!key || !key.startsWith("comments/") || key.includes("..")) {
    return NextResponse.json({ error: "key 不合法" }, { status: 400 });
  }

  let obj;
  try {
    obj = await getObjectStream(key);
  } catch {
    return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": obj.contentType,
    // 公開圖片、以 uuid 命名且內容不可變，允許 CDN/瀏覽器公開快取
    "Cache-Control": "public, max-age=86400",
    // 防止 svg/HTML 內嵌腳本在本網域執行（XSS 緩解）
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
    "X-Content-Type-Options": "nosniff",
  });
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }

  return new NextResponse(obj.body, { status: 200, headers });
}
