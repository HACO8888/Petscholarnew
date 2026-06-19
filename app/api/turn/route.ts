import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * 動態產生 WebRTC ICE servers（STUN/TURN）。
 * 用 Cloudflare TURN 的 API token 向 CF 產生短效 ICE 憑證後回傳給前端，
 * 前端用它建立 RTCPeerConnection。憑證短效、且此端點需登入。
 */
export const runtime = "nodejs";

const STUN_FALLBACK = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const keyId = process.env.TURN_KEY_ID;
  const token = process.env.TURN_API_TOKEN;
  // 未設定 CF TURN 時退回只給公共 STUN（多數網路可用，對稱 NAT 可能失敗）
  if (!keyId || !token) {
    return NextResponse.json(STUN_FALLBACK, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }),
        cache: "no-store",
      },
    );
    if (!res.ok) return NextResponse.json(STUN_FALLBACK, { headers: { "Cache-Control": "no-store" } });
    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(STUN_FALLBACK, { headers: { "Cache-Control": "no-store" } });
  }
}
