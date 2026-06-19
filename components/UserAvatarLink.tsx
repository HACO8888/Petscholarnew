import Link from "next/link";

/**
 * 可點擊的使用者頭像（＋可選顯示名稱），連到公開個人檔案 /u/[userId]。
 *
 * - 有 image 顯示圓形大頭照；無則顯示名稱字首的字母圓圈。
 * - userId 為 null（理論上現在留言/貼文都有真實 authorId，僅保留防呆）時不連結，
 *   純文字 / 純頭像顯示，避免連到無效路由。
 *
 * Server Component（不需互動），可在 server / client 元件中使用。
 */
export default function UserAvatarLink({
  userId,
  name,
  image,
  showName = false,
  size = "sm",
  className = "",
  nameClassName = "",
}: {
  userId: string | null;
  name: string;
  image: string | null;
  /** 是否在頭像旁顯示名稱（同樣套用連結） */
  showName?: boolean;
  /** 頭像尺寸 */
  size?: "sm" | "md";
  /** 外層容器額外 class */
  className?: string;
  /** 名稱文字額外 class（覆寫預設字體） */
  nameClassName?: string;
}) {
  const displayName = name?.trim() || "未命名同學";
  const initial = displayName.charAt(0).toUpperCase() || "?";

  const dim = size === "md" ? "h-9 w-9 text-body-md" : "h-6 w-6 text-[11px]";

  const avatar = image ? (
    <img
      src={image}
      alt={displayName}
      referrerPolicy="no-referrer"
      className={`${dim} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-secondary-container font-bold text-on-secondary-container`}
    >
      {initial}
    </span>
  );

  const nameNode = showName ? (
    <span className={nameClassName || "text-body-md font-semibold text-on-background break-words"}>
      {displayName}
    </span>
  ) : null;

  // authorId 為 null：不連結，純文字 / 純頭像顯示
  if (!userId) {
    return (
      <span className={`inline-flex items-center gap-x-2 ${className}`}>
        {avatar}
        {nameNode}
      </span>
    );
  }

  return (
    <Link
      href={`/u/${userId}`}
      className={`inline-flex items-center gap-x-2 rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {avatar}
      {showName ? (
        <span className={`${nameClassName || "text-body-md font-semibold text-on-background break-words"} hover:underline`}>
          {displayName}
        </span>
      ) : null}
    </Link>
  );
}
