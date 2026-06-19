"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB，需與 /api/avatars 後端一致

/**
 * 自訂頭像上傳：選檔 → 預覽 → 上傳。
 * 成功後 router.refresh() 讓 server component 重抓新的 users.image。
 */
export default function AvatarUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 釋放舊的預覽 URL，避免記憶體洩漏
  function setPreview(next: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    const url = next ? URL.createObjectURL(next) : null;
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(next);
  }

  // 卸載時釋放最後一個預覽 URL
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const picked = e.target.files?.[0] ?? null;
    if (!picked) {
      setPreview(null);
      return;
    }
    if (!picked.type.startsWith("image/")) {
      setError("只接受圖片檔案");
      setPreview(null);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("檔案過大（上限 5MB）");
      setPreview(null);
      return;
    }
    setPreview(picked);
  }

  async function onUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const res = await fetch("/api/avatars", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "上傳失敗");
      }
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-sm">
      {previewUrl ? (

        <img
          alt="頭像預覽"
          src={previewUrl}
          className="w-16 h-16 rounded-full border-2 border-outline-variant object-cover shadow-sm"
        />
      ) : null}

      <label className="cursor-pointer inline-flex items-center gap-xs font-label-md text-label-md text-primary bg-primary-container/40 hover:bg-primary-container px-md py-xs rounded-full transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary">
        <span className="material-symbols-outlined text-sm">photo_camera</span>
        {file ? "重新選擇" : "選擇頭像"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="sr-only"
        />
      </label>

      <button
        type="button"
        onClick={onUpload}
        disabled={!file || uploading}
        className="inline-flex items-center gap-xs bg-primary text-on-primary hover:bg-surface-tint font-bold text-label-md py-xs px-md rounded-full shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {uploading ? "上傳中…" : "上傳頭像"}
      </button>

      {error ? (
        <p role="alert" className="font-label-md text-label-md text-error text-center">
          {error}
        </p>
      ) : null}
    </div>
  );
}
