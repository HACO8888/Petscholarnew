/**
 * 以 Asia/Taipei（UTC+8）固定時區格式化為 "YYYY-MM-DD HH:MM"。
 * 部署環境（Zeabur）的 server 時區為 UTC，直接用 getHours 等會比台灣慢 8 小時。
 */
export function formatDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
