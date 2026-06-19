import { ImageResponse } from "next/og";

// 自動產生的 Open Graph 分享圖（1200×630）。用英文避免 CJK 字型載入問題。
export const runtime = "nodejs";
export const alt = "PetScholar — Gamified Campus Q&A × Virtual Pet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5a7c95 0%, #34506a 60%, #243a50 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "64px",
        }}
      >
        {/* 學位帽標誌 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 30,
            background: "rgba(255,255,255,0.12)",
            marginBottom: 36,
          }}
        >
          <svg width="84" height="84" viewBox="0 0 64 64">
            <path d="M32 17 L58 27.5 L32 38 L6 27.5 Z" fill="#ffffff" />
            <path
              d="M21 33 L21 41.5 C21 46 26.4 49 32 49 C37.6 49 43 46 43 41.5 L43 33 L32 37.4 Z"
              fill="#eaf1f6"
            />
            <circle cx="53" cy="45.5" r="3.4" fill="#f6c453" />
            <path d="M53 28 L53 42" stroke="#f6c453" strokeWidth="2.6" />
          </svg>
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -2 }}>PetScholar</div>
        <div style={{ fontSize: 34, marginTop: 18, color: "#dbe6ef", fontWeight: 600 }}>
          Gamified Campus Q&amp;A × Virtual Pet
        </div>
        <div style={{ fontSize: 26, marginTop: 10, color: "#aebfce" }}>
          Answer questions · earn coins · grow your study companion
        </div>
      </div>
    ),
    { ...size },
  );
}
