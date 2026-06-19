"use client";
/* eslint-disable react-hooks/set-state-in-effect -- 本元件於 mount 時由 localStorage 同步初始狀態，屬合理用法 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  deleteRoom,
  joinRoom,
  kickMember,
  leaveRoom,
  setRoomModerator,
} from "@/app/(app)/study-rooms/actions";
import StudyRoomEditDialog from "@/components/StudyRoomEditDialog";
import EmojiPicker, { insertAtCursor } from "@/components/EmojiPicker";
import PomodoroRing from "@/components/study-room/PomodoroRing";
import { useVoiceCall } from "@/components/voice/VoiceCallProvider";
import {
  BACKGROUND_IMAGES,
  type VirtualBgMode,
} from "@/components/voice/videoProcessing";

interface RoomInfo {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  capacity: number;
  /** 是否設有密碼（不回傳明碼，只給布林旗標） */
  hasPassword: boolean;
}

interface Member {
  id: string;
  name: string;
  image: string | null;
  isSelf: boolean;
  isModerator: boolean;
  isOwner: boolean;
}

interface Goal {
  id: string;
  text: string;
  completed: boolean;
}

/** 從 server (Socket.IO) 收到的訊息形狀 */
interface ChatMessage {
  id: string;
  roomId: string;
  userId: string | null;
  authorName: string;
  content: string;
  createdAt: string; // ISO 字串
}

interface StudyRoomDetailProps {
  room: RoomInfo;
  members: Member[];
  memberCount: number;
  /** 目前登入者的 user id，用於標記自己的訊息 */
  meId: string;
  /** 是否可解散此自習室（建立者或系統管理員） */
  canManage: boolean;
  /** 是否可編輯房間資訊（建立者或系統管理員） */
  canEdit: boolean;
  /** 是否可對成員做禁麥/禁鏡/踢人（建立者/房間管理員/系統 admin） */
  canModerate: boolean;
  /** 目前使用者是否已是成員 */
  isMember: boolean;
  /** 自習室是否已滿 */
  isFull: boolean;
  /** 建立者顯示名稱（null = 系統房間） */
  creatorName: string | null;
}

const POMO_SECONDS = 25 * 60;
const AVATARS = ["👩‍🎓", "👨‍🎓", "🐱", "🐶", "🤖"];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * 視訊舞台 grid 類別：依參與者視訊格數做響應式排版。
 * 1 人大畫面、2 人並排、3–4 人 2×2、5+ 自動填列（可捲）。
 */
function videoGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
}

export default function StudyRoomDetail({
  room,
  members,
  memberCount,
  meId,
  canManage,
  canEdit,
  canModerate,
  isMember,
  isFull,
  creatorName,
}: StudyRoomDetailProps) {
  // ---- 番茄鐘（localStorage 持久化：切走再回來不重置）----
  const pomoKey = `study-pomo:${room.id}`;
  const [timeLeft, setTimeLeft] = useState(POMO_SECONDS);
  const [running, setRunning] = useState(false);
  const [pomoLoaded, setPomoLoaded] = useState(false);
  // 完成輪數（純顯示用；計時邏輯不變，僅在自然完成那一刻 +1）
  const [pomoRound, setPomoRound] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 載入：還原計時狀態（執行中則扣掉離開期間經過的秒數）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(pomoKey);
      if (raw) {
        const s = JSON.parse(raw) as {
          timeLeft: number;
          running: boolean;
          savedAt: number;
          round?: number;
        };
        if (typeof s.round === "number") setPomoRound(s.round);
        if (s.running) {
          const elapsed = Math.floor((Date.now() - s.savedAt) / 1000);
          const remain = Math.max(0, (s.timeLeft ?? POMO_SECONDS) - elapsed);
          if (remain > 0) {
            setTimeLeft(remain);
            setRunning(true);
          } else {
            setTimeLeft(POMO_SECONDS);
          }
        } else {
          setTimeLeft(Math.max(0, s.timeLeft ?? POMO_SECONDS));
        }
      }
    } catch {
      /* ignore */
    }
    setPomoLoaded(true);
  }, [pomoKey]);

  // 存檔：狀態變動就寫入（含時間戳，供下次還原計算經過秒數）
  useEffect(() => {
    if (!pomoLoaded) return;
    try {
      localStorage.setItem(
        pomoKey,
        JSON.stringify({
          timeLeft,
          running,
          savedAt: Date.now(),
          round: pomoRound,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [timeLeft, running, pomoLoaded, pomoKey, pomoRound]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setPomoRound((r) => r + 1);
          return POMO_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function toggleTimer() {
    setRunning((r) => !r);
  }
  function resetTimer() {
    setRunning(false);
    setTimeLeft(POMO_SECONDS);
  }

  const mins = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");
  // 番茄鐘進度 0→1（已過去的比例），供「專注光環」填滿。
  const pomoProgress = (POMO_SECONDS - timeLeft) / POMO_SECONDS;

  // ---- 讀書目標清單（localStorage） ----
  const goalsKey = `study-goals:${room.id}`;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(goalsKey);
      if (raw) setGoals(JSON.parse(raw) as Goal[]);
    } catch {
      /* ignore */
    }
    setGoalsLoaded(true);
  }, [goalsKey]);

  useEffect(() => {
    if (!goalsLoaded) return;
    try {
      localStorage.setItem(goalsKey, JSON.stringify(goals));
    } catch {
      /* ignore */
    }
  }, [goals, goalsKey, goalsLoaded]);

  // 防連點/連按 Enter 重複送出：上鎖直到下一個動畫影格才釋放，
  // 攔住同一輸入值在 state 清空前被第二個 Enter 事件再次送出。
  const goalLockRef = useRef(false);

  function toggleGoal(id: string) {
    setGoals((gs) =>
      gs.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
    );
  }
  function removeGoal(id: string) {
    setGoals((gs) => gs.filter((g) => g.id !== id));
  }
  function addGoal() {
    const text = newGoal.trim();
    if (!text || goalLockRef.current) return;
    goalLockRef.current = true;
    setGoals((gs) => [
      ...gs,
      { id: `goal-${Date.now()}`, text, completed: false },
    ]);
    setNewGoal("");
    requestAnimationFrame(() => {
      goalLockRef.current = false;
    });
  }

  // ---- 聊天室（Socket.IO 即時 + DB 歷史） ----
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  // 連線狀態：connecting | connected | error
  const [chatStatus, setChatStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // IME（中文／日文等組字）期間不送出
  const composingRef = useRef(false);
  // 防連點重複送出
  const sendingRef = useRef(false);

  // ---- 語音 / 視訊通話：狀態與邏輯住在全域 VoiceCallProvider（跨頁不中斷）----
  // 本元件不再自己擁有語音狀態，改用 context 消費；導航離開時 Provider 仍掛在 layout，
  // 通話續存且右下角浮動視窗接手顯示。
  const voice = useVoiceCall();
  // 此房是否正在語音中（語音可能在「其他房」進行 → activeRoomId 不同）。
  const inVoice = voice.inVoice && voice.activeRoomId === room.id;
  // 是否正在「其他房」語音中（單一通話限制：不可同時加入此房）。
  const inOtherRoomVoice = voice.inVoice && voice.activeRoomId !== room.id;
  const voiceMuted = voice.muted;
  const cameraOn = inVoice && voice.cameraOn;
  const recording = inVoice && voice.recording;
  const recordingVideo = voice.recordingVideo;
  const rnnoiseActive = voice.rnnoiseActive;
  // 對端清單（僅本房通話時才呈現）。
  const voicePeers = inVoice ? voice.participants : [];
  // 錯誤/通知：本房通話中，或本房正嘗試加入（activeRoomId 已指向本房），
  // 或目前根本不在任何語音（join 失敗會清掉 activeRoomId）→ 都顯示給本房。
  const voiceForThisRoom =
    voice.activeRoomId === room.id || voice.activeRoomId === null;
  const voiceError = voiceForThisRoom ? voice.error : null;
  const voiceNotice = inVoice ? voice.notice : null;
  const speakingKeys = inVoice ? voice.speakingKeys : new Set<string>();
  const localStreamState = inVoice ? voice.localStream : null;
  // 加入語音前的隱私同意提示是否顯示。
  const [showConsent, setShowConsent] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // 本地預覽：把本地 stream 接到 <video>
  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStreamState && el.srcObject !== localStreamState) {
      el.srcObject = localStreamState;
    }
  }, [localStreamState, cameraOn, inVoice]);

  useEffect(() => {
    // 連到 custom server 的 Socket.IO；session 由同源 cookie 驗證
    const socket = io({
      path: "/socket.io",
      query: { roomId: room.id },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setChatStatus("connected");
      setChatError(null);
    });
    socket.on("disconnect", () => {
      setChatStatus("connecting");
    });
    socket.on("connect_error", () => {
      setChatStatus("error");
      setChatError("即時聊天連線失敗（請確認已登入並使用 custom server 啟動）");
    });

    // 加入時回傳近 N 則歷史
    socket.on("chat:history", (history: ChatMessage[]) => {
      setChat(Array.isArray(history) ? history : []);
    });

    // 新訊息廣播（含自己送出的）→ 以 id 去重後 append
    socket.on("chat:message", (msg: ChatMessage) => {
      setChat((c) => (c.some((m) => m.id === msg.id) ? c : [...c, msg]));
    });

    socket.on("chat:error", (e: { message?: string }) => {
      setChatStatus("error");
      setChatError(e?.message ?? "聊天室發生錯誤");
    });

    // 被房間管理員踢出
    socket.on("room:kicked", (e: { by?: string }) => {
      setChatError(`你已被${e?.by ? ` ${e.by} ` : "管理員"}移出此自習室。`);
      // 重新整理讓伺服端權限/成員狀態同步
      setTimeout(() => {
        window.location.href = "/study-rooms";
      }, 1200);
    });

    // 注意：語音/視訊/錄製/moderation 已搬到全域 VoiceCallProvider，
    // 本 socket 僅負責即時文字聊天，導航離開時與本頁一起卸載。
    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [room.id]);

  // 收到新訊息時捲到底
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat]);

  function sendMessage() {
    const text = newMsg.trim();
    if (!text || sendingRef.current) return;
    const socket = socketRef.current;
    if (!socket || chatStatus !== "connected") return;
    sendingRef.current = true;
    socket.emit("chat:send", { content: text }, () => {
      sendingRef.current = false;
    });
    setTimeout(() => {
      sendingRef.current = false;
    }, 800);
    setNewMsg("");
  }

  // 複製邀請連結
  const [copied, setCopied] = useState(false);
  function copyInviteLink() {
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/study-rooms/${room.id}`
          : "";
      navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  // userId → member（給語音格顯示頭像/姓名、管理操作）
  const memberByUserId = new Map(members.map((m) => [m.id, m]));
  // 有視訊的 peer（含本地若開鏡頭）→ 顯示視訊格
  const videoPeers = voicePeers.filter((p) => p.hasVideo);
  // 視訊舞台模式：只要有人開鏡頭（自己或任一 peer 有 video）即進入。
  const showVideoStage = inVoice && (cameraOn || videoPeers.length > 0);
  // 視訊格總數（本地若開鏡頭算 1）→ 決定 grid 排版。
  const videoTileCount = (cameraOn ? 1 : 0) + videoPeers.length;

  // 語音成員清單（含自己）：給「誰在語音中」區塊渲染。
  const selfMember = members.find((m) => m.isSelf);
  const voiceParticipants = [
    ...(inVoice
      ? [
          {
            key: "self",
            name: selfMember?.name ?? "你",
            image: selfMember?.image ?? null,
            isSelf: true,
            hasVideo: cameraOn,
          },
        ]
      : []),
    ...voicePeers.map((p) => {
      const mem = p.userId ? memberByUserId.get(p.userId) : null;
      return {
        key: p.id,
        name: mem?.name ?? p.name,
        image: mem?.image ?? null,
        isSelf: false,
        hasVideo: p.hasVideo,
      };
    }),
  ];

  const subjectEyebrow = room.subject ?? "自習室";
  const roomName = room.name;

  // 紅點指示文字：開鏡頭時是「錄音錄影中」，否則「錄音中」。
  const recordingLabel = recordingVideo ? "錄音錄影中" : "錄音中";

  return (
    // 桌機：貼齊視窗高度（扣掉 layout 的 md:py-8 上下各 2rem），整頁不長出捲動；
    // 各面板於內部捲動。手機（< lg）維持自然堆疊可捲動。
    <section
      id="sect-study-detail"
      className="pb-6 lg:pb-0 lg:h-[calc(100dvh-4rem)] lg:flex lg:flex-col lg:overflow-hidden"
    >
      {/* ===== Header：科目 eyebrow + 房名 + 在線/建立者/私密/錄製 + 動作群組 ===== */}
      <header className="flex flex-col gap-4 mb-lg lg:flex-row lg:justify-between lg:items-end lg:shrink-0">
        <div className="min-w-0">
          <p className="text-label-md font-bold uppercase tracking-[0.16em] text-primary mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">
              menu_book
            </span>
            {subjectEyebrow}
          </p>
          <h1 className="font-bold text-headline-lg text-on-background truncate">
            {roomName}
          </h1>
          <p className="text-secondary text-body-md mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 font-bold text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">
                group
              </span>
              {memberCount}/{room.capacity} 在線
            </span>
            <span className="text-outline-variant/60" aria-hidden>
              ·
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">
                person
              </span>
              {creatorName ?? "系統房間"}
            </span>
            {room.hasPassword && (
              <>
                <span className="text-outline-variant/60" aria-hidden>
                  ·
                </span>
                <span className="flex items-center gap-1 text-tertiary">
                  <span className="material-symbols-outlined text-[18px]">
                    lock
                  </span>
                  私密房
                </span>
              </>
            )}
            {recording && (
              <span className="flex items-center gap-1.5 font-bold text-on-error-container bg-error-container px-2 py-0.5 rounded-full">
                <span className="inline-block w-2 h-2 rounded-full bg-error animate-pulse motion-reduce:animate-none" />
                {recordingLabel}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap lg:justify-end">
          {!isMember &&
            (isFull ? (
              <button
                type="button"
                disabled
                className="bg-surface-variant text-on-surface-variant/60 font-bold text-body-md px-4 py-2 rounded-full cursor-not-allowed flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">
                  group_off
                </span>
                已滿
              </button>
            ) : (
              <form action={joinRoom} className="flex items-center gap-2">
                <input type="hidden" name="roomId" value={room.id} />
                {room.hasPassword && (
                  <input
                    type="password"
                    name="password"
                    required
                    maxLength={64}
                    placeholder="房間密碼"
                    className="w-32 bg-surface-container-low dark:bg-surface border border-outline-variant rounded-full py-2 px-4 text-xs outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
                <button
                  type="submit"
                  className="bg-primary hover:bg-surface-tint text-on-primary font-bold text-body-md px-5 py-2 rounded-full shadow-sm transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    group_add
                  </span>
                  加入自習室
                </button>
              </form>
            ))}

          {/* 次要動作：收斂成一致的灰底圓角群組 */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-surface-container-high border border-outline-variant/30">
            <button
              type="button"
              onClick={copyInviteLink}
              title="複製邀請連結"
              className="text-on-surface-variant font-bold text-body-md px-3 py-1.5 rounded-full hover:bg-surface-container-highest transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied ? "check" : "link"}
              </span>
              <span className="hidden sm:inline">
                {copied ? "已複製" : "邀請"}
              </span>
            </button>
            {canEdit && (
              <StudyRoomEditDialog
                room={{
                  id: room.id,
                  name: room.name,
                  subject: room.subject,
                  description: room.description,
                  capacity: room.capacity,
                  hasPassword: room.hasPassword,
                }}
                memberCount={memberCount}
              />
            )}
            {isMember && (
              <form action={leaveRoom}>
                <input type="hidden" name="roomId" value={room.id} />
                <button
                  type="submit"
                  className="text-error font-bold text-body-md px-3 py-1.5 rounded-full hover:bg-error-container/50 transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    logout
                  </span>
                  <span className="hidden sm:inline">離開</span>
                </button>
              </form>
            )}
            {canManage && (
              <form action={deleteRoom}>
                <input type="hidden" name="roomId" value={room.id} />
                <button
                  type="submit"
                  className="text-error font-bold text-body-md px-3 py-1.5 rounded-full hover:bg-error-container/50 transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    delete
                  </span>
                  <span className="hidden sm:inline">解散</span>
                </button>
              </form>
            )}
            <Link
              href="/study-rooms"
              title="返回列表"
              className="text-on-surface-variant font-bold text-body-md px-3 py-1.5 rounded-full hover:bg-surface-container-highest transition-all flex items-center gap-1.5 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                arrow_back
              </span>
              <span className="hidden sm:inline">返回</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ===== 主版面：左=專注工作室（番茄鐘/視訊+夥伴+語音）｜右=目標+討論 =====
          桌機：撐滿剩餘高度，左右兩欄各自內部捲動，整頁不捲。手機：自然堆疊。 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md items-start lg:flex-1 lg:min-h-0 lg:items-stretch">
        {/* ========== 專注工作室 ========== */}
        <div className="lg:col-span-8 flex flex-col gap-md lg:min-h-0 lg:overflow-y-auto lg:pr-1 hide-scrollbar">
          {/* ---- Hero：模式切換 ----
              沒有任何人開鏡頭 → 中央大「專注光環」（focus 模式）。
              只要有人開鏡頭（自己或任一 peer 有 video）→ 中央變「視訊舞台」，
              番茄鐘縮成頂部一條精簡計時 pill（仍可開始/暫停）。離開鏡頭再切回光環。 */}
          {showVideoStage ? (
            /* ===== 視訊舞台模式 ===== */
            <div
              key="video-stage"
              className="stage-fade relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container-high shadow-sm"
            >
              {/* 頂部精簡計時 pill：時間 + 開始/暫停 + 重置 + 輪數，不跟視訊搶位 */}
              <div className="flex items-center gap-2 flex-wrap px-md pt-md pb-2.5 border-b border-outline-variant/20">
                <div
                  className={`flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1 border transition-colors ${
                    running
                      ? "border-tertiary/40 bg-tertiary-container/30"
                      : "border-outline-variant/30 bg-surface-container-high"
                  }`}
                >
                  <PomodoroRing
                    mins={mins}
                    secs={secs}
                    progress={pomoProgress}
                    running={running}
                    size={40}
                    stroke={4}
                    compact
                  />
                  <button
                    type="button"
                    onClick={toggleTimer}
                    aria-label={running ? "暫停番茄鐘" : "開始番茄鐘"}
                    className="w-8 h-8 grid place-items-center rounded-full bg-primary text-on-primary hover:bg-surface-tint transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {running ? "pause" : "play_arrow"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={resetTimer}
                    aria-label="重置番茄鐘"
                    title="重置"
                    className="w-8 h-8 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      refresh
                    </span>
                  </button>
                </div>
                <span className="text-label-md font-bold uppercase tracking-[0.12em] text-secondary">
                  {running ? "專注中" : "已就緒"}
                  <span className="mx-1.5 text-outline-variant/60" aria-hidden>
                    ·
                  </span>
                  {pomoRound > 0
                    ? `第 ${pomoRound + 1} 輪 · 已完成 ${pomoRound}`
                    : "第 1 輪"}
                </span>
                {recording && (
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-on-error-container bg-error-container px-2.5 py-1 rounded-full">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse motion-reduce:animate-none" />
                    {recordingLabel}
                  </span>
                )}
              </div>

              {/* 視訊格：響應式 grid，1 人大畫面、2 並排、3–4 為 2×2、更多可捲 */}
              <div className="p-md">
                <div
                  className={`grid gap-2.5 ${videoGridClass(videoTileCount)} ${
                    videoTileCount > 4
                      ? "max-h-[60vh] lg:max-h-[calc(100dvh-22rem)] overflow-y-auto pr-1 hide-scrollbar"
                      : ""
                  }`}
                >
                  {/* 本地預覽（套虛擬背景後的畫面） */}
                  {cameraOn && (
                    <div
                      className={`relative aspect-video rounded-xl overflow-hidden bg-black border-2 transition-all ${
                        speakingKeys.has("self")
                          ? "border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.35)]"
                          : "border-outline-variant/30"
                      }`}
                    >
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover -scale-x-100"
                      />
                      <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1">
                        {voiceMuted && (
                          <span className="material-symbols-outlined text-[13px]">
                            mic_off
                          </span>
                        )}
                        你
                      </span>
                    </div>
                  )}
                  {videoPeers.map((p) => {
                    const mem = p.userId
                      ? memberByUserId.get(p.userId)
                      : null;
                    const isSpeaking = speakingKeys.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`relative aspect-video rounded-xl overflow-hidden bg-black border-2 transition-all ${
                          isSpeaking
                            ? "border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.35)]"
                            : "border-outline-variant/30"
                        }`}
                      >
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && el.srcObject !== p.stream)
                              el.srcObject = p.stream;
                          }}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[11px] px-1.5 py-0.5 rounded">
                          {mem?.name ?? p.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ===== 專注光環模式（無人開鏡頭）===== */
            <div
              key="focus-ring"
              className={`stage-fade relative overflow-hidden rounded-2xl border shadow-sm transition-colors duration-700 ${
                running
                  ? "border-tertiary/40 bg-gradient-to-b from-tertiary-container/30 to-surface-container-lowest dark:to-surface-container-high"
                  : "border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container-high"
              }`}
            >
              {/* 環境暈光：運作中暖色脈動，閒置沉穩 */}
              <div
                aria-hidden
                className={`pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl transition-opacity duration-700 ${
                  running
                    ? "bg-tertiary/25 focus-pulse"
                    : "bg-primary-container/20 opacity-40"
                }`}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-28 -left-28 w-72 h-72 rounded-full bg-primary-container/15 blur-3xl opacity-40"
              />

              <div className="relative p-lg sm:p-xl flex flex-col items-center">
                {/* 簽名元件：圓形進度環包住時間 */}
                <PomodoroRing
                  mins={mins}
                  secs={secs}
                  progress={pomoProgress}
                  running={running}
                  size={256}
                  stroke={14}
                />

                {/* 控制：開始/暫停、重置、第幾輪 */}
                <div className="mt-lg flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleTimer}
                    className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-7 py-2.5 rounded-full shadow flex items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {running ? "pause" : "play_arrow"}
                    </span>
                    {running ? "暫停" : "開始"}
                  </button>
                  <button
                    type="button"
                    onClick={resetTimer}
                    className="bg-surface-container text-on-surface-variant hover:bg-surface-container-highest font-bold text-body-md w-11 h-11 rounded-full border border-outline-variant/30 transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="重置番茄鐘"
                    title="重置"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      refresh
                    </span>
                  </button>
                </div>
                <p className="mt-3 text-label-md font-bold uppercase tracking-[0.14em] text-secondary">
                  {pomoRound > 0
                    ? `第 ${pomoRound + 1} 輪 · 已完成 ${pomoRound}`
                    : "第 1 輪"}
                </p>
              </div>
            </div>
          )}

          {/* ---- 專注夥伴：頭像叢集（present 成員，語音中顯示綠光環） ---- */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-2xl border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-body-md text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  diversity_3
                </span>
                專注夥伴
                <span className="ml-1 text-label-md font-bold text-secondary bg-surface-container-high px-2 py-0.5 rounded-full">
                  {members.length}/{room.capacity} 在線
                </span>
              </h2>
              <button
                type="button"
                onClick={copyInviteLink}
                className="text-primary hover:bg-primary-container/40 font-bold text-label-md px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? "check" : "person_add"}
                </span>
                {copied ? "已複製連結" : "邀請夥伴"}
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {members.map((m, i) => {
                const peerInVoice = voicePeers.find((p) => p.userId === m.id);
                const targetInVoice = peerInVoice;
                // 語音中（自己或對方）且正在說話 → 綠色光環
                const speakKey = m.isSelf ? "self" : peerInVoice?.id;
                const isSpeaking = Boolean(
                  speakKey && speakingKeys.has(speakKey),
                );
                const isInVoice = m.isSelf ? inVoice : Boolean(peerInVoice);
                return (
                  <div
                    key={m.id}
                    className="group relative flex flex-col items-center gap-1 w-16"
                  >
                    <Link
                      href={`/u/${m.id}`}
                      title={`查看 ${m.name} 的個人檔案`}
                      className="no-underline flex flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                    >
                      <div
                        className={`relative w-14 h-14 rounded-full grid place-items-center transition-all ${
                          isSpeaking
                            ? "ring-2 ring-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.30)]"
                            : isInVoice
                              ? "ring-2 ring-primary/50"
                              : "ring-1 ring-outline-variant/40"
                        }`}
                      >
                        {m.image ? (
                          <img
                            alt=""
                            src={m.image}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-full h-full rounded-full bg-surface-container-high grid place-items-center text-2xl">
                            {AVATARS[i % AVATARS.length]}
                          </span>
                        )}
                        {/* 角色徽章（左上）：加 ring-offset 與 z 讓徽章不被光環吃掉、不互相壓 */}
                        {m.isOwner ? (
                          <span className="absolute -top-1 -left-1 z-10 bg-tertiary-container text-on-tertiary-container w-4 h-4 rounded-full grid place-items-center ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                            <span className="material-symbols-outlined text-[11px] leading-none">
                              star
                            </span>
                          </span>
                        ) : m.isModerator ? (
                          <span className="absolute -top-1 -left-1 z-10 bg-secondary-container text-on-secondary-container w-4 h-4 rounded-full grid place-items-center ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                            <span className="material-symbols-outlined text-[11px] leading-none">
                              shield_person
                            </span>
                          </span>
                        ) : null}
                        {/* 在語音中 → 麥克風指示（右下） */}
                        {isInVoice && (
                          <span className="absolute -bottom-1 -right-1 z-10 bg-primary text-on-primary w-4 h-4 rounded-full grid place-items-center ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                            <span className="material-symbols-outlined text-[11px] leading-none">
                              mic
                            </span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-on-surface truncate w-full text-center group-hover:text-primary transition-colors">
                        {m.isSelf ? "你" : m.name}
                      </span>
                    </Link>

                    {/* 管理控制：建立者可指派/取消管理員；管理員可禁麥/禁鏡/踢人 */}
                    {!m.isSelf && (canModerate || canEdit) && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full bg-surface-container-highest rounded-full shadow-md border border-outline-variant/30 px-1 py-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
                        {canEdit && !m.isOwner && (
                          <button
                            type="button"
                            title={m.isModerator ? "取消管理員" : "設為管理員"}
                            onClick={() =>
                              setRoomModerator(room.id, m.id, !m.isModerator)
                            }
                            className="p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary-container/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {m.isModerator
                                ? "remove_moderator"
                                : "add_moderator"}
                            </span>
                          </button>
                        )}
                        {canModerate && !m.isOwner && (
                          <>
                            <button
                              type="button"
                              title="強制靜音"
                              disabled={!targetInVoice}
                              onClick={() => voice.forceMute(m.id)}
                              className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/40 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                mic_off
                              </span>
                            </button>
                            <button
                              type="button"
                              title="強制關鏡頭"
                              disabled={!targetInVoice}
                              onClick={() => voice.forceCameraOff(m.id)}
                              className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/40 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                videocam_off
                              </span>
                            </button>
                            <button
                              type="button"
                              title="踢出"
                              onClick={() => kickMember(room.id, m.id)}
                              className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                person_remove
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- 語音 / 視訊通話：整合控制 ---- */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <h2 className="font-bold text-body-md text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  graphic_eq
                </span>
                語音通話
                {inVoice && (
                  <span className="ml-1 text-label-md font-bold text-secondary bg-surface-container-high px-2 py-0.5 rounded-full">
                    {voiceParticipants.length} 人通話中
                  </span>
                )}
              </h2>
              {recording && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-on-error-container bg-error-container px-2.5 py-1 rounded-full">
                  <span className="inline-block w-2 h-2 rounded-full bg-error animate-pulse motion-reduce:animate-none" />
                  {recordingLabel}
                </span>
              )}
            </div>

            {voiceError && (
              <p className="text-[11px] text-error mb-2">{voiceError}</p>
            )}
            {voiceNotice && (
              <p className="text-[11px] text-tertiary mb-2">{voiceNotice}</p>
            )}

            {/* 通話中成員（speaking 綠光環） */}
            {inVoice && (
              <div className="mb-3 flex flex-wrap gap-3">
                {voiceParticipants.map((p) => {
                  const isSpeaking = speakingKeys.has(p.key);
                  // 本地是否靜音（僅自己這格顯示靜音徽章）。
                  const showMuted = p.isSelf && voiceMuted;
                  return (
                    <div
                      key={p.key}
                      className="flex flex-col items-center gap-1.5 w-12"
                      title={`${p.name}${isSpeaking ? "（說話中）" : ""}`}
                    >
                      <div
                        className={`relative w-10 h-10 rounded-full grid place-items-center transition-all ${
                          isSpeaking
                            ? "ring-2 ring-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.35)]"
                            : "ring-1 ring-outline-variant/40"
                        }`}
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-surface-container-high grid place-items-center text-base">
                            {p.isSelf ? "🙂" : "🧑‍🎓"}
                          </div>
                        )}
                        {showMuted ? (
                          <span className="absolute -bottom-1 -right-1 z-10 bg-error text-on-error rounded-full w-4 h-4 grid place-items-center ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                            <span className="material-symbols-outlined text-[11px] leading-none">
                              mic_off
                            </span>
                          </span>
                        ) : p.hasVideo ? (
                          <span className="absolute -bottom-1 -right-1 z-10 bg-primary text-on-primary rounded-full w-4 h-4 grid place-items-center ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                            <span className="material-symbols-outlined text-[11px] leading-none">
                              videocam
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-on-surface truncate w-full text-center">
                        {p.isSelf ? "你" : p.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {!isMember ? (
              <p className="text-[12px] text-secondary">
                加入此自習室後即可使用語音/視訊通話。
              </p>
            ) : inOtherRoomVoice ? (
              // 單一通話限制：已在其他房語音中，不可同時加入本房。
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-high border border-outline-variant/30 px-3 py-2.5">
                <span className="material-symbols-outlined text-tertiary text-[20px]">
                  info
                </span>
                <span className="text-[12px] text-on-surface-variant">
                  你正在其他房間語音中。請先離開後再加入此房語音。
                </span>
                {voice.activeRoomId && (
                  <Link
                    href={`/study-rooms/${voice.activeRoomId}`}
                    className="ml-auto text-label-md font-bold text-primary hover:bg-primary-container/40 px-2.5 py-1 rounded-full no-underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    返回語音中的房間
                  </Link>
                )}
              </div>
            ) : !inVoice ? (
              <button
                type="button"
                onClick={() => setShowConsent(true)}
                className="self-start bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-5 py-2.5 rounded-full shadow-sm transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="material-symbols-outlined text-[20px]">
                  call
                </span>
                加入語音
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => voice.toggleMute()}
                  className={`font-bold text-body-md px-4 py-2 rounded-full border flex items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    voiceMuted
                      ? "bg-error-container text-on-error-container border-error/30"
                      : "bg-surface-container hover:bg-surface-container-highest text-on-surface-variant border-outline-variant/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {voiceMuted ? "mic_off" : "mic"}
                  </span>
                  {voiceMuted ? "已靜音" : "靜音"}
                </button>
                <button
                  type="button"
                  onClick={() => voice.toggleCamera()}
                  className={`font-bold text-body-md px-4 py-2 rounded-full border flex items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    cameraOn
                      ? "bg-primary-container text-on-primary-container border-primary/30"
                      : "bg-surface-container hover:bg-surface-container-highest text-on-surface-variant border-outline-variant/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {cameraOn ? "videocam" : "videocam_off"}
                  </span>
                  {cameraOn ? "關鏡頭" : "開鏡頭"}
                </button>
                <button
                  type="button"
                  onClick={() => voice.leave()}
                  className="bg-error-container text-on-error-container hover:opacity-90 font-bold text-body-md px-4 py-2 rounded-full border border-error/20 flex items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    call_end
                  </span>
                  離開
                </button>
                <span className="ml-auto text-[11px] text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    {rnnoiseActive ? "graphic_eq" : "noise_control_off"}
                  </span>
                  {rnnoiseActive ? "AI 降噪（RNNoise）" : "瀏覽器內建降噪"}
                </span>
              </div>
            )}

            {/* 虛擬背景選擇：開鏡頭時顯示。切換不需重開鏡頭，即時套到送 peer / 錄製的畫面。 */}
            {inVoice && cameraOn && (
              <div className="mt-3 flex items-center gap-2 flex-wrap rounded-xl bg-surface-container-high/60 border border-outline-variant/30 px-3 py-2">
                <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    wallpaper
                  </span>
                  虛擬背景
                </span>
                {/* 無 / 模糊 模式按鈕 */}
                {([
                  { mode: "none", label: "無", icon: "block" },
                  { mode: "blur", label: "模糊", icon: "blur_on" },
                ] as { mode: VirtualBgMode; label: string; icon: string }[]).map(
                  (opt) => {
                    const active = voice.virtualBg.mode === opt.mode;
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() =>
                          voice.setVirtualBg({
                            ...voice.virtualBg,
                            mode: opt.mode,
                          })
                        }
                        aria-pressed={active}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          active
                            ? "bg-primary-container text-on-primary-container border-primary/30"
                            : "bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-highest"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {opt.icon}
                        </span>
                        {opt.label}
                      </button>
                    );
                  },
                )}
                {/* 背景圖片：點任一張即進入 image 模式並選定 */}
                <span className="mx-0.5 text-outline-variant/50" aria-hidden>
                  |
                </span>
                {BACKGROUND_IMAGES.map((bg) => {
                  const active =
                    voice.virtualBg.mode === "image" &&
                    voice.virtualBg.imageId === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() =>
                        voice.setVirtualBg({ mode: "image", imageId: bg.id })
                      }
                      aria-pressed={active}
                      title={`背景圖片：${bg.label}`}
                      className={`relative w-9 h-7 rounded-md overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? "border-primary shadow-[0_0_0_2px_rgba(59,130,246,0.25)]"
                          : "border-outline-variant/40 hover:border-outline-variant"
                      }`}
                    >
                      <img
                        src={bg.src}
                        alt={bg.label}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* 遠端音訊（隱藏播放） */}
            {voicePeers.map((p) => (
              <audio
                key={p.id}
                autoPlay
                ref={(el) => {
                  if (el && el.srcObject !== p.stream) el.srcObject = p.stream;
                }}
              />
            ))}
          </div>
        </div>

        {/* ---------- 右欄：今日目標 + 即時討論（桌機內部捲動，不撐長整頁） ---------- */}
        <div className="lg:col-span-4 flex flex-col gap-md lg:min-h-0">
          {/* 今日小組目標 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col lg:shrink-0">
            <h3 className="font-bold text-body-md text-on-surface mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-tertiary text-[20px]">
                playlist_add_check
              </span>
              今日小組目標
            </h3>

            <div className="relative flex-grow">
              <div
                className="space-y-1.5 overflow-y-auto max-h-[160px] pr-1.5 [scrollbar-width:thin] [scrollbar-color:rgb(var(--md-sys-color-outline-variant-rgb,148_148_148)/0.6)_transparent]"
                style={{ scrollbarGutter: "stable" }}
              >
                {goals.length === 0 ? (
                  <p className="text-xs text-secondary p-1.5">尚無目標，新增一個吧！</p>
                ) : (
                  goals.map((goal) => (
                    <div
                      key={goal.id}
                      className={`flex items-center gap-1 p-1.5 hover:bg-surface-container-low dark:hover:bg-surface rounded-lg transition-colors group ${
                        goal.completed ? "opacity-50" : ""
                      }`}
                    >
                      <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={goal.completed}
                          onChange={() => toggleGoal(goal.id)}
                          className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary h-3.5 w-3.5 shrink-0"
                        />
                        <span
                          className={`text-xs text-on-background group-hover:text-primary transition-all break-words ${
                            goal.completed ? "line-through" : ""
                          }`}
                        >
                          {goal.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeGoal(goal.id)}
                        aria-label="刪除目標"
                        className="shrink-0 p-1 rounded text-secondary hover:text-error hover:bg-error-container/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
              {goals.length > 4 && (
                <div className="pointer-events-none absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-surface-container-lowest dark:from-surface-container-high to-transparent rounded-b-xl" />
              )}
            </div>

            <div className="mt-2.5 relative">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !e.repeat) {
                    e.preventDefault();
                    addGoal();
                  }
                }}
                placeholder="新增目標..."
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant/40 rounded-lg py-1.5 pl-3 pr-8 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              <button
                type="button"
                onClick={addGoal}
                aria-label="新增目標"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary hover:opacity-85"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_circle
                </span>
              </button>
            </div>
          </div>

          {/* 即時文字討論區（桌機填滿剩餘高度並內部捲動） */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col min-h-[420px] flex-grow lg:min-h-0">
            <h3 className="font-bold text-body-md text-on-surface mb-2.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                forum
              </span>
              即時討論
              <span
                className={`ml-auto flex items-center gap-1 text-[10px] font-normal ${
                  chatStatus === "connected"
                    ? "text-primary"
                    : chatStatus === "error"
                      ? "text-error"
                      : "text-secondary"
                }`}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    chatStatus === "connected"
                      ? "bg-primary"
                      : chatStatus === "error"
                        ? "bg-error"
                        : "bg-secondary animate-pulse motion-reduce:animate-none"
                  }`}
                />
                {chatStatus === "connected"
                  ? "即時連線中"
                  : chatStatus === "error"
                    ? "未連線"
                    : "連線中…"}
              </span>
            </h3>
            <div className="flex-grow overflow-y-auto text-xs space-y-2 max-h-[380px] lg:max-h-none lg:min-h-0 pr-1 flex flex-col">
              {chatError && (
                <div className="text-center text-[10px] text-error my-1.5">
                  {chatError}
                </div>
              )}
              {chat.length === 0 && !chatError && (
                <div className="flex-grow flex items-center justify-center text-center text-[10px] text-secondary py-4">
                  還沒有訊息，發出第一則討論吧！
                </div>
              )}
              {chat.map((msg) => {
                const isSelf = msg.userId === meId;
                return isSelf ? (
                  <div
                    key={msg.id}
                    className="flex flex-col items-end max-w-[85%] self-end ml-auto mb-2"
                  >
                    <span className="text-[9px] text-secondary mb-0.5 mr-1">
                      {msg.authorName} · {formatTime(msg.createdAt)}
                    </span>
                    <div className="bg-primary text-on-primary px-2.5 py-1.5 rounded-lg rounded-tr-none text-xs leading-normal break-words">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className="flex flex-col items-start max-w-[85%] mb-2"
                  >
                    <span className="text-[9px] text-secondary mb-0.5 ml-1">
                      {msg.authorName} · {formatTime(msg.createdAt)}
                    </span>
                    <div className="bg-surface-container-low dark:bg-surface text-on-surface px-2.5 py-1.5 rounded-lg rounded-tl-none text-xs leading-normal border border-outline-variant/20 break-words">
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-end gap-1.5 mt-2">
              <EmojiPicker
                className="pb-1.5"
                onSelect={(emoji) =>
                  setNewMsg((c) => insertAtCursor(chatInputRef.current, c, emoji))
                }
              />
              <textarea
                ref={chatInputRef}
                value={newMsg}
                rows={1}
                onChange={(e) => setNewMsg(e.target.value)}
                onCompositionStart={() => {
                  composingRef.current = true;
                }}
                onCompositionEnd={() => {
                  composingRef.current = false;
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !composingRef.current &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={chatStatus !== "connected"}
                placeholder={chatStatus === "connected" ? "輸入訊息…" : "連線中…"}
                aria-label="輸入訊息。Enter 送出、Shift+Enter 換行。"
                aria-describedby="chat-input-hint"
                className="flex-grow resize-none bg-surface-container-low dark:bg-surface border border-outline-variant/40 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none disabled:opacity-60 max-h-24"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={chatStatus !== "connected"}
                aria-label="送出訊息"
                className="bg-primary text-on-primary px-3 py-1.5 rounded-lg hover:bg-surface-tint transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  send
                </span>
              </button>
            </div>
            <p
              id="chat-input-hint"
              className="mt-1 text-[9px] text-secondary/70 select-none"
            >
              Enter 送出 · Shift+Enter 換行
            </p>
          </div>
        </div>
      </div>

      {/* ===== 加入語音前的隱私同意提示（務必：強制錄音/錄影告知） ===== */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-surface-container-lowest dark:bg-surface-container-high rounded-2xl border border-outline-variant/30 shadow-xl p-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-error text-[28px]">
                radio_button_checked
              </span>
              <h3 className="font-bold text-body-lg text-on-surface">
                通話將被全程錄製
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-2">
              為維護自習室秩序與內容審核，<strong className="text-error">本通話將被全程錄音；若你開啟鏡頭，影像也會一併錄影</strong>。錄製內容僅供管理員審核之用。
            </p>
            <ul className="text-xs text-secondary leading-relaxed mb-4 list-disc pl-5 space-y-0.5">
              <li>加入語音後即自動開始錄製，無法關閉。</li>
              <li>通話中畫面會持續顯示明顯的紅點「● {recordingLabel}」指示。</li>
              <li>麥克風會經 AI 降噪（RNNoise）處理後再傳送。</li>
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConsent(false)}
                className="bg-surface-container hover:bg-surface-container-highest text-on-surface-variant font-bold text-xs px-4 py-2 rounded-lg border border-outline-variant/30"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConsent(false);
                  voice.join(room.id, room.name);
                }}
                className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-4 py-2 rounded-lg shadow-sm flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                我了解，加入語音
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
