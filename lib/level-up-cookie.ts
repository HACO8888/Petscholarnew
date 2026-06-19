/**
 * 升級慶祝訊號的 cookie 名稱常數，獨立於 server-only 的 level-up-signal.ts，
 * 讓 client 元件（LevelUpToast）可安全引用而不會把 next/headers 拉進前端 bundle。
 */
export const LEVEL_UP_COOKIE = "petLevelUp";
