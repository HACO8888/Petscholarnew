import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * MinIO（S3 相容）物件儲存。用於自習室語音通話的錄音檔。
 * 連線資訊放在 .env：S3_ENDPOINT / S3_REGION / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET。
 * MinIO 需要 path-style（forcePathStyle: true）。
 */

export const S3_BUCKET = process.env.S3_BUCKET ?? "petscholarnew";

let _client: S3Client | null = null;

export function getS3(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("缺少 S3 連線環境變數（S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY）");
  }
  _client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

/** 上傳一個物件到 bucket。 */
export async function putObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** 取得物件的短效簽名 GET URL（供 <audio> 播放，預設 1 小時）。 */
export async function presignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    getS3(),
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn },
  );
}

/**
 * 取得物件的串流 body 與其 metadata（供 route 直接串流回傳，例如自訂頭像）。
 * 回傳的 body 是 web ReadableStream，可直接放進 Response。
 */
export async function getObjectStream(key: string): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
}> {
  const out = await getS3().send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );
  const body = out.Body as
    | { transformToWebStream: () => ReadableStream<Uint8Array> }
    | undefined;
  if (!body || typeof body.transformToWebStream !== "function") {
    throw new Error("物件無內容");
  }
  return {
    body: body.transformToWebStream(),
    contentType: out.ContentType ?? "application/octet-stream",
    contentLength: out.ContentLength,
  };
}

/** 刪除物件。 */
export async function deleteObject(key: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}
