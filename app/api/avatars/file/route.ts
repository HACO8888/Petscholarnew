import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getObjectStream } from "@/lib/s3";

/**
 * 從 MinIO 串流回傳自訂頭像物件。
 * GET ?key=avatars/...；驗登入且 key 必須以 avatars/ 開頭（防任意讀取）。
 * users.image 指向本路由，故全站 <img src={user.image}> 都能直接顯示。
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const key = new URL(req.url).searchParams.get("key");
  if (!key || !key.startsWith("avatars/")) {
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
    // 頭像物件以 uuid 命名、內容不可變；私有快取一天即可
    "Cache-Control": "private, max-age=86400",
  });
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }

  return new NextResponse(obj.body, { status: 200, headers });
}
