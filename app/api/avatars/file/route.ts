import { NextResponse } from "next/server";
import { getObjectStream } from "@/lib/s3";

/**
 * 從 MinIO 串流回傳自訂頭像物件。
 * GET ?key=avatars/...。頭像是公開的個人圖片，故本路由「不需登入」即可讀取
 * （訪客在公開檔案 /u/[id]、排行榜、貼文作者處都要能看到頭貼）。
 * 安全靠：key 必須以 avatars/ 開頭且不含 ".."（防讀取其他前綴），加 nosniff/CSP 防 svg XSS。
 * users.image 指向本路由，故全站 <img src={user.image}> 都能直接顯示。
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  // 必須以 avatars/ 開頭，且不得含 ".." 以杜絕路徑穿越讀取其他前綴的物件
  if (!key || !key.startsWith("avatars/") || key.includes("..")) {
    return NextResponse.json({ error: "key 不合法" }, { status: 400 });
  }

  let obj;
  try {
    obj = await getObjectStream(key);
  } catch {
    return NextResponse.json({ error: "找不到頭像" }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": obj.contentType,
    // 頭像為公開圖片、以 uuid 命名且內容不可變，允許 CDN/瀏覽器公開快取
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
