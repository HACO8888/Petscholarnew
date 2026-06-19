import { type Instrumentation } from "next";

/**
 * 全域伺服器端錯誤記錄。
 * Next.js 在任何 SSR / Server Component / Route Handler 拋錯時呼叫本 hook，
 * 我們把完整錯誤與堆疊印到 console（Zeabur 執行日誌可見），方便定位偶發 500。
 */
export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  const e = err as Error & { digest?: string };
  console.error(
    `[SSR ERROR] ${request.method ?? ""} ${request.path}` +
      ` | route=${context.routePath} type=${context.routeType}` +
      ` source=${context.renderSource ?? "-"} revalidate=${context.revalidateReason ?? "-"}` +
      (e?.digest ? ` digest=${e.digest}` : ""),
  );
  console.error(e?.stack ?? e?.message ?? String(err));
};
