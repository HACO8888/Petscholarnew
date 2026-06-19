"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 輕量 emoji 選擇器：一顆按鈕展開常用 emoji 面板，點擊把該 emoji 透過 onSelect 回傳。
 * 不引入任何外部套件，只用內建常用清單。插入游標處的邏輯由呼叫端負責。
 */

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
  "🙂", "😉", "😊", "😍", "😘", "😜", "🤔", "🤩",
  "😎", "😭", "😅", "😤", "😱", "🥳", "🥺", "😴",
  "👍", "👎", "👏", "🙏", "💪", "🤝", "✌️", "👌",
  "❤️", "🔥", "✨", "🎉", "💯", "⭐", "✅", "❌",
  "🤯", "🥲", "😇", "🤓", "📚", "✏️", "💡", "❓",
];

export default function EmojiPicker({
  onSelect,
  className,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 點外面 / 按 Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="插入表情符號"
        aria-expanded={open}
        className="flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          mood
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1 w-56 max-w-[80vw] rounded-xl border border-outline-variant/40 bg-surface-container-high p-2 shadow-lg"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((e, i) => (
              <button
                key={`${e}-${i}`}
                type="button"
                onClick={() => {
                  onSelect(e);
                  setOpen(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-[18px] hover:bg-surface-container-highest"
                aria-label={`插入 ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 把 emoji 插入 textarea 目前游標處（或末端），回傳新值並把游標移到插入後。
 * 呼叫端負責用回傳值 setState。focus/selection 需要 ref 指到該 textarea。
 */
export function insertAtCursor(
  el: HTMLTextAreaElement | null,
  current: string,
  insert: string,
): string {
  if (!el) return current + insert;
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + insert + current.slice(end);
  // 還原游標到插入字串之後（下一個 tick，等 React 重渲染完）
  const caret = start + insert.length;
  requestAnimationFrame(() => {
    try {
      el.focus();
      el.setSelectionRange(caret, caret);
    } catch {
      /* ignore */
    }
  });
  return next;
}
