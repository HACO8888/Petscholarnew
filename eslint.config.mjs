import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 舊靜態站存檔，僅供移植參考，不納入 lint
    "legacy/**",
    // 並行 agent 的 git worktree 副本（含各自的 .next/legacy），不納入 lint
    ".claude/**",
    // 第三方 RNNoise worklet/wasm 編譯產物（@sapphi-red/web-noise-suppressor），不納入 lint
    "public/rnnoise/**",
  ]),
  {
    rules: {
      // 忠實移植原版面會用到外部圖片的 <img>，不強制改用 next/image
      "@next/next/no-img-element": "off",
      // App Router 在 layout <head> 以 <link> 載入字型/Material Symbols 是刻意做法
      // （display=block 正是讓圖示字型不顯示成文字的修正），關閉這兩條誤報
      "@next/next/no-page-custom-font": "off",
      "@next/next/google-font-display": "off",
    },
  },
]);

export default eslintConfig;
