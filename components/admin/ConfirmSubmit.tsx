"use client";

/**
 * 破壞性操作（永久刪除、解散等）用的提交按鈕：
 * 送出前以瀏覽器原生 confirm 二次確認，避免誤觸。
 * 仍在 server action 端再次驗權與驗存在，前端確認僅作為 UX 防呆。
 */
export default function ConfirmSubmit({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
