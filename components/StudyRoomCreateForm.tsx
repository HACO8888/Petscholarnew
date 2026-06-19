"use client";

import { useId, useRef, useState } from "react";
import { createRoom } from "@/app/(app)/study-rooms/actions";

/**
 * 「發起課業共讀邀約」建立房間表單。
 * - 點按鈕展開浮層表單；送出成功後清空欄位並收合表單。
 * - 支援設定房間密碼（選填；有值即為私密房）。
 */
export default function StudyRoomCreateForm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const baseId = useId();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await createRoom(formData);
      // 成功：清空欄位並收合
      formRef.current?.reset();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立失敗，請稍後再試");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="px-md py-xs bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant transition-colors shadow-sm flex items-center gap-xs"
      >
        <span className="material-symbols-outlined text-[16px]">
          {open ? "close" : "add"}
        </span>{" "}
        {open ? "收合" : "建立房間"}
      </button>

      {open && (
        <form
          ref={formRef}
          action={handleSubmit}
          className="absolute right-0 z-20 mt-sm w-[min(20rem,calc(100vw-2rem))] bg-surface-container-lowest dark:bg-surface-container-high rounded-2xl border border-outline-variant/40 shadow-xl p-md space-y-md"
        >
          <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1">
            <span>📡</span> 發起課業共讀邀約
          </h3>

          {error && (
            <p className="text-xs text-error bg-error-container/40 rounded-lg px-2.5 py-1.5">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor={`${baseId}-name`}
              className="block text-xs font-bold text-secondary mb-1"
            >
              自習室名稱
            </label>
            <input
              id={`${baseId}-name`}
              name="name"
              type="text"
              required
              maxLength={80}
              placeholder="例：微積分期末衝刺營"
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor={`${baseId}-subject`}
              className="block text-xs font-bold text-secondary mb-1"
            >
              科目 / 主題（選填）
            </label>
            <input
              id={`${baseId}-subject`}
              name="subject"
              type="text"
              maxLength={40}
              placeholder="例：微積分"
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor={`${baseId}-description`}
              className="block text-xs font-bold text-secondary mb-1"
            >
              說明（選填）
            </label>
            <input
              id={`${baseId}-description`}
              name="description"
              type="text"
              maxLength={120}
              placeholder="例：專注模式，請勿開麥。"
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor={`${baseId}-capacity`}
              className="block text-xs font-bold text-secondary mb-1"
            >
              人數上限
            </label>
            <input
              id={`${baseId}-capacity`}
              name="capacity"
              type="number"
              min={2}
              max={12}
              defaultValue={8}
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor={`${baseId}-password`}
              className="block text-xs font-bold text-secondary mb-1"
            >
              房間密碼（選填）
            </label>
            <input
              id={`${baseId}-password`}
              name="password"
              type="password"
              maxLength={64}
              autoComplete="new-password"
              placeholder="留空 = 公開房"
              className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-0.5 transition-all shadow-sm disabled:opacity-60"
          >
            {pending ? "建立中…" : "建立並加入"}
          </button>
        </form>
      )}
    </div>
  );
}
