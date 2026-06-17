export type Role = "student" | "ta" | "professor" | "admin";

export interface NavItem {
  label: string;
  href: string;
  /** 若設定，僅當目前身分屬於此清單時才顯示該 tab */
  roles?: Role[];
  /** 角色限定 tab 的強調色 */
  accent?: "professor" | "admin";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "看板", href: "/boards" },
  { label: "自習室", href: "/study-rooms" },
  { label: "討論版", href: "/discussion" },
  { label: "寵物餵食", href: "/pet/feed" },
  { label: "寵物商城", href: "/shop" },
  { label: "排行榜與成就", href: "/leaderboard" },
  { label: "個人檔案", href: "/profile" },
  { label: "課程管理", href: "/professor", roles: ["professor", "admin"], accent: "professor" },
  { label: "系統管理後台", href: "/admin", roles: ["admin"], accent: "admin" },
];

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "student", label: "一般學生" },
  { value: "ta", label: "課程助教" },
  { value: "professor", label: "課程教授" },
  { value: "admin", label: "系統管理員" },
];
