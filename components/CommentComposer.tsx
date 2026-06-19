"use client";

import { useRef, useState } from "react";
import EmojiPicker, { insertAtCursor } from "@/components/EmojiPicker";

/**
 * 留言輸入器（文章留言與回覆共用）：
 * - <textarea>：Enter 送出、Shift+Enter 換行、IME 組字中的 Enter 不送出
 * - emoji 選擇器（插入游標處）
 * - 附一張圖（上傳 /api/uploads → 取得本站 URL → 隨留言送出）
 * 實際送出走父層提供的 onSubmit（透過 socket emit），回傳 Promise<boolean> 表成功與否。
 */
export default function CommentComposer({
  onSubmit,
  placeholder,
  submitLabel,
  rows = 3,
  autoFocus = false,
  onCancel,
  compact = false,
  disabled = false,
}: {
  onSubmit: (content: string, image: string | null) => Promise<boolean>;
  placeholder?: string;
  submitLabel?: string;
  rows?: number;
  autoFocus?: boolean;
  onCancel?: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const composingRef = useRef(false);
  const sendingRef = useRef(false);

  async function doSend() {
    const text = content.trim();
    if ((!text && !image) || sendingRef.current || disabled) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const ok = await onSubmit(text, image);
      if (ok) {
        setContent("");
        setImage(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setError("送出失敗，請稍後再試");
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

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
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="relative">
        <textarea
          ref={taRef}
          value={content}
          autoFocus={autoFocus}
          rows={rows}
          disabled={disabled}
          onChange={(e) => setContent(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(e) => {
            // Enter 送出；Shift+Enter 換行；IME 組字中的 Enter 不送出
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !composingRef.current &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void doSend();
            }
          }}
          placeholder={placeholder ?? "輸入內容（Enter 送出、Shift+Enter 換行，支援 $LaTeX$）"}
          className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
        />
      </div>

      {image && (
        <div className="relative inline-block">
          {/* 預覽縮圖 */}
          <img
            src={image}
            alt="附圖預覽"
            className="max-h-32 rounded-lg border border-outline-variant/40 object-contain"
          />
          <button
            type="button"
            onClick={() => {
              setImage(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            aria-label="移除附圖"
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error text-on-error shadow"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {error && <p className="text-label-md text-error">{error}</p>}

      <div className="flex items-center gap-2">
        <EmojiPicker
          onSelect={(emoji) =>
            setContent((c) => insertAtCursor(taRef.current, c, emoji))
          }
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="附加圖片"
          disabled={uploading || disabled}
          className="flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            {uploading ? "hourglass_top" : "image"}
          </span>
        </button>
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

        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-outline-variant px-4 py-1.5 text-label-md text-on-surface-variant hover:bg-surface-container"
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={() => void doSend()}
            disabled={sending || uploading || disabled || (!content.trim() && !image)}
            className="rounded-full bg-primary px-4 py-1.5 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint disabled:opacity-50"
          >
            {submitLabel ?? "送出"}
          </button>
        </div>
      </div>
    </div>
  );
}
