import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { voiceRecordings, studyRoomMembers } from "@/db/schema";
import { putObject } from "@/lib/s3";

/**
 * 上傳一段自習室語音通話錄音到 MinIO 並在 DB 留 metadata。
 * 僅該自習室成員可上傳。前端以 multipart/form-data 送 audio blob + roomId。
 */
export const runtime = "nodejs";

// 強制錄製：含影像的錄影檔可能較大（每段 2–3 分鐘分段上傳），上限放寬到 100MB。
const MAX_BYTES = 100 * 1024 * 1024; // 100MB 上限

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const userId = session.user.id;

  const form = await req.formData();
  const roomId = String(form.get("roomId") ?? "");
  const durationMs = Number(form.get("durationMs") ?? 0) || null;
  const file = form.get("audio");
  if (!roomId || !(file instanceof Blob)) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }

  // 僅該房成員可上傳錄音（server 端把關）
  const [member] = await db
    .select({ roomId: studyRoomMembers.roomId })
    .from(studyRoomMembers)
    .where(and(eq(studyRoomMembers.roomId, roomId), eq(studyRoomMembers.userId, userId)))
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: "非自習室成員" }, { status: 403 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "檔案大小不符（需 1B–100MB）" }, { status: 400 });
  }

  // 含影像的錄影 contentType 會是 video/webm。純語音為 audio/webm。
  const contentType = file.type || "audio/webm";
  const ext = contentType.includes("ogg")
    ? "ogg"
    : contentType.includes("mp4")
      ? "mp4"
      : "webm";
  const id = crypto.randomUUID();
  const key = `voice/${roomId}/${id}.${ext}`;

  try {
    await putObject(key, bytes, contentType);
  } catch {
    return NextResponse.json({ error: "上傳儲存失敗" }, { status: 502 });
  }

  await db.insert(voiceRecordings).values({
    id,
    roomId,
    userId,
    authorName: session.user.name ?? "使用者",
    objectKey: key,
    contentType,
    durationMs,
    sizeBytes: bytes.byteLength,
  });

  return NextResponse.json({ ok: true, id });
}
