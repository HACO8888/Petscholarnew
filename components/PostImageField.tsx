"use client";

import { useRef, useState } from "react";

/**
 * 發問附圖欄位：選圖後立即上傳 /api/uploads，把回傳的本站 URL 寫入隱藏 input（name="image"），
 * 隨 createPost server action 一併送出。父表單為 server-action form，故本元件只負責上傳與預覽。
 */
export default function PostImageField() {
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("只接受圖片檔案");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("圖片過大（上限 5MB）");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        setError(json.error ?? "圖片上傳失敗");
        return;
      }
      setImage(json.url);
    } catch {
      setError("圖片上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="block">
      <span className="mb-1 block text-label-md font-medium text-on-surface-variant">附圖（選填）</span>
      <input type="hidden" name="image" value={image ?? ""} />
      {image ? (
        <div className="relative inline-block">
          <img
            src={image}
            alt="附圖預覽"
            className="max-h-40 rounded-lg border border-outline-variant/40 object-contain"
          />
          <button
            type="button"
            onClick={() => {
              setImage(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            aria-label="移除附圖"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-error text-on-error shadow"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface-variant transition-colors hover:border-primary disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            {uploading ? "hourglass_top" : "image"}
          </span>
          {uploading ? "上傳中…" : "選擇圖片"}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {error && <p className="mt-1 text-label-md text-error">{error}</p>}
    </div>
  );
}
