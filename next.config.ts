import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 不外露 X-Powered-By: Next.js
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // 基本安全標頭（CSP 因含 inline theme script / Google Fonts / KaTeX 暫不啟用，避免誤擋）
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // 允許本站使用鏡頭/麥克風（自習室語音/視訊通話需要）。定位仍停用
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
