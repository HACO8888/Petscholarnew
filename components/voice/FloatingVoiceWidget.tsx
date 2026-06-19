"use client";

/**
 * FloatingVoiceWidget：右下角懸浮語音小視窗。
 * 當 inVoice 且「目前不在該房頁面」時顯示，讓使用者導航到別頁仍能看見/控制通話。
 * 在房頁時隱藏（房頁由 StudyRoomDetail 顯示完整語音 UI）。
 *
 * 顯示：房名、通話中成員頭像（speaking 綠光環）、麥克風/鏡頭/離開鈕、●錄製指示、返回房間連結。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVoiceCall } from "@/components/voice/VoiceCallProvider";

export default function FloatingVoiceWidget() {
  const {
    activeRoomId,
    activeRoomName,
    inVoice,
    participants,
    speakingKeys,
    muted,
    cameraOn,
    recording,
    recordingVideo,
    leave,
    toggleMute,
    toggleCamera,
  } = useVoiceCall();
  const pathname = usePathname();

  // 不在語音中、或正位於該房頁面 → 不顯示浮動視窗。
  if (!inVoice || !activeRoomId) return null;
  if (pathname === `/study-rooms/${activeRoomId}`) return null;

  const recordingLabel = recordingVideo ? "錄音錄影中" : "錄音中";
  // 通話頭像：本地 + 對端（最多顯示前 4 個，其餘以 +N 表示）。
  const selfSpeaking = speakingKeys.has("self");
  const peerAvatars = participants.slice(0, 4);
  const overflow = participants.length - peerAvatars.length;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(20rem,calc(100vw-2rem))] animate-fade-in-up">
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest dark:bg-surface-container-high shadow-xl p-3">
        {/* 標頭：房名 + 錄製指示 */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">
              graphic_eq
            </span>
            <span className="font-bold text-body-md text-on-surface truncate">
              {activeRoomName ?? "語音通話"}
            </span>
          </div>
          {recording && (
            <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-on-error-container bg-error-container px-2 py-0.5 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse motion-reduce:animate-none" />
              {recordingLabel}
            </span>
          )}
        </div>

        {/* 通話中成員頭像（speaking 綠光環） */}
        <div className="flex items-center gap-2 mb-3 px-0.5">
          {/* 本地（你） */}
          <div
            title={`你${selfSpeaking ? "（說話中）" : ""}`}
            className={`relative w-9 h-9 rounded-full grid place-items-center bg-surface-container-high transition-all ${
              selfSpeaking
                ? "ring-2 ring-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.35)]"
                : "ring-1 ring-outline-variant/40"
            }`}
          >
            <span className="text-base leading-none">🙂</span>
            {muted && (
              <span className="absolute -bottom-1 -right-1 bg-error text-on-error w-4 h-4 rounded-full grid place-items-center ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                <span className="material-symbols-outlined text-[11px] leading-none">
                  mic_off
                </span>
              </span>
            )}
          </div>
          {peerAvatars.map((p) => {
            const speaking = speakingKeys.has(p.id);
            return (
              <div
                key={p.id}
                title={`${p.name}${speaking ? "（說話中）" : ""}`}
                className={`relative w-9 h-9 rounded-full grid place-items-center bg-surface-container-high transition-all ${
                  speaking
                    ? "ring-2 ring-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.35)]"
                    : "ring-1 ring-outline-variant/40"
                }`}
              >
                <span className="text-base leading-none">🧑‍🎓</span>
                {p.hasVideo && (
                  <span className="absolute -bottom-1 -right-1 bg-primary text-on-primary w-4 h-4 rounded-full grid place-items-center ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                    <span className="material-symbols-outlined text-[11px] leading-none">
                      videocam
                    </span>
                  </span>
                )}
              </div>
            );
          })}
          {overflow > 0 && (
            <span className="text-label-md font-bold text-secondary">
              +{overflow}
            </span>
          )}
        </div>

        {/* 控制列：靜音 / 鏡頭 / 離開 / 返回房間 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "取消靜音" : "靜音"}
            className={`w-9 h-9 grid place-items-center rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              muted
                ? "bg-error-container text-on-error-container border-error/30"
                : "bg-surface-container hover:bg-surface-container-highest text-on-surface-variant border-outline-variant/30"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {muted ? "mic_off" : "mic"}
            </span>
          </button>
          <button
            type="button"
            onClick={toggleCamera}
            aria-label={cameraOn ? "關鏡頭" : "開鏡頭"}
            className={`w-9 h-9 grid place-items-center rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              cameraOn
                ? "bg-primary-container text-on-primary-container border-primary/30"
                : "bg-surface-container hover:bg-surface-container-highest text-on-surface-variant border-outline-variant/30"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {cameraOn ? "videocam" : "videocam_off"}
            </span>
          </button>
          <button
            type="button"
            onClick={leave}
            aria-label="離開語音"
            className="w-9 h-9 grid place-items-center rounded-full border border-error/20 bg-error-container text-on-error-container hover:opacity-90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
          >
            <span className="material-symbols-outlined text-[18px]">
              call_end
            </span>
          </button>
          <Link
            href={`/study-rooms/${activeRoomId}`}
            className="ml-auto flex items-center gap-1 text-label-md font-bold text-primary hover:bg-primary-container/40 px-3 py-1.5 rounded-full no-underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[16px]">
              meeting_room
            </span>
            返回房間
          </Link>
        </div>
      </div>
    </div>
  );
}
