"use client";
/* eslint-disable react-hooks/set-state-in-effect -- 本元件於 mount 時由 localStorage 同步初始狀態，屬合理用法 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { deleteRoom, joinRoom, leaveRoom } from "@/app/(app)/study-rooms/actions";

interface RoomInfo {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  capacity: number;
}

interface Member {
  id: string;
  name: string;
  image: string | null;
  isSelf: boolean;
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
  /** 目前使用者是否已是成員 */
  isMember: boolean;
  /** 自習室是否已滿 */
  isFull: boolean;
}

const POMO_SECONDS = 25 * 60;
const AVATARS = ["👩‍🎓", "👨‍🎓", "🐱", "🐶", "🤖"];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StudyRoomDetail({
  room,
  members,
  memberCount,
  meId,
  canManage,
  isMember,
  isFull,
}: StudyRoomDetailProps) {
  // ---- 番茄鐘（localStorage 持久化：切走再回來不重置）----
  const pomoKey = `study-pomo:${room.id}`;
  const [timeLeft, setTimeLeft] = useState(POMO_SECONDS);
  const [running, setRunning] = useState(false);
  const [pomoLoaded, setPomoLoaded] = useState(false);
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
        };
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
        JSON.stringify({ timeLeft, running, savedAt: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }, [timeLeft, running, pomoLoaded, pomoKey]);

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
  const socketRef = useRef<Socket | null>(null);
  // IME（中文／日文等組字）期間不送出
  const composingRef = useRef(false);
  // 防連點重複送出
  const sendingRef = useRef(false);

  // ---- 語音通話（WebRTC mesh + Cloudflare TURN）----
  const [inVoice, setInVoice] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voicePeers, setVoicePeers] = useState<
    { id: string; name: string; stream: MediaStream }[]
  >([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // 由 socket effect 注入的語音操作 API（給按鈕呼叫，避免 socket 監聽重複註冊）
  const voiceApiRef = useRef<{
    join: () => void;
    leave: () => void;
    toggleMute: () => void;
    startRec: () => void;
    stopRec: () => void;
  } | null>(null);

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

    // ----- 語音通話：WebRTC mesh 信令 + 本地媒體/錄音 -----
    const pcs = new Map<string, RTCPeerConnection>();
    let localStream: MediaStream | null = null;
    let iceServers: RTCIceServer[] = [];
    let recorder: MediaRecorder | null = null;
    let recChunks: Blob[] = [];
    let recStart = 0;

    const closePeer = (id: string) => {
      const pc = pcs.get(id);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
        pcs.delete(id);
      }
      setVoicePeers((ps) => ps.filter((p) => p.id !== id));
    };

    const makePeer = async (peerId: string, peerName: string, initiator: boolean) => {
      let pc = pcs.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers });
      pcs.set(peerId, pc);
      if (localStream) {
        for (const t of localStream.getTracks()) pc.addTrack(t, localStream);
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("voice:signal", { to: peerId, data: { candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        setVoicePeers((ps) => [
          ...ps.filter((p) => p.id !== peerId),
          { id: peerId, name: peerName, stream },
        ]);
      };
      pc.onconnectionstatechange = () => {
        if (
          pc &&
          (pc.connectionState === "failed" ||
            pc.connectionState === "closed" ||
            pc.connectionState === "disconnected")
        ) {
          closePeer(peerId);
        }
      };
      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("voice:signal", { to: peerId, data: { sdp: pc.localDescription } });
      }
      return pc;
    };

    socket.on(
      "voice:signal",
      async ({
        from,
        fromName,
        data,
      }: {
        from: string;
        fromName: string;
        data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      }) => {
        try {
          if (data?.sdp) {
            if (data.sdp.type === "offer") {
              const pc = await makePeer(from, fromName, false);
              await pc.setRemoteDescription(data.sdp);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("voice:signal", { to: from, data: { sdp: pc.localDescription } });
            } else if (data.sdp.type === "answer") {
              await pcs.get(from)?.setRemoteDescription(data.sdp);
            }
          } else if (data?.candidate) {
            await pcs.get(from)?.addIceCandidate(data.candidate);
          }
        } catch {
          /* 忽略個別信令錯誤，不影響其他 peer */
        }
      },
    );

    socket.on("voice:peer-left", ({ id }: { id: string }) => closePeer(id));

    const join = async () => {
      try {
        setVoiceError(null);
        // 瀏覽器只在安全來源（HTTPS 或 localhost）才允許麥克風
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          setVoiceError("需在 HTTPS（安全來源）下才能使用語音，請改用正式網域。");
          return;
        }
        const res = await fetch("/api/turn");
        const json = (await res.json()) as { iceServers?: RTCIceServer[] };
        iceServers = json.iceServers ?? [];
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setVoiceMuted(false);
        socket.emit(
          "voice:join",
          (ack: { ok: boolean; peers?: { id: string; name: string }[]; error?: string }) => {
            if (!ack?.ok) {
              setVoiceError(ack?.error ?? "加入語音失敗");
              localStream?.getTracks().forEach((t) => t.stop());
              localStream = null;
              return;
            }
            setInVoice(true);
            for (const p of ack.peers ?? []) makePeer(p.id, p.name, true);
          },
        );
      } catch {
        setVoiceError("無法取得麥克風權限");
      }
    };

    const leave = () => {
      socket.emit("voice:leave");
      for (const id of [...pcs.keys()]) closePeer(id);
      if (recorder && recorder.state !== "inactive") recorder.stop();
      localStream?.getTracks().forEach((t) => t.stop());
      localStream = null;
      setInVoice(false);
      setRecording(false);
      setVoicePeers([]);
    };

    const toggleMute = () => {
      if (!localStream) return;
      const enabled = localStream.getAudioTracks().every((t) => t.enabled);
      localStream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
      setVoiceMuted(enabled);
    };

    const startRec = () => {
      if (!localStream) return;
      try {
        recChunks = [];
        recorder = new MediaRecorder(localStream);
        recStart = performance.now();
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recChunks.push(e.data);
        };
        recorder.onstop = async () => {
          const blob = new Blob(recChunks, { type: recorder?.mimeType || "audio/webm" });
          recChunks = [];
          if (blob.size === 0) return;
          const fd = new FormData();
          fd.append("audio", blob, "recording.webm");
          fd.append("roomId", room.id);
          fd.append("durationMs", String(Math.round(performance.now() - recStart)));
          try {
            await fetch("/api/recordings", { method: "POST", body: fd });
          } catch {
            /* 上傳失敗忽略 */
          }
        };
        recorder.start();
        setRecording(true);
      } catch {
        setVoiceError("此瀏覽器不支援錄音");
      }
    };

    const stopRec = () => {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      setRecording(false);
    };

    voiceApiRef.current = { join, leave, toggleMute, startRec, stopRec };

    return () => {
      // 清理語音
      socket.emit("voice:leave");
      for (const pc of pcs.values()) pc.close();
      pcs.clear();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      localStream?.getTracks().forEach((t) => t.stop());
      voiceApiRef.current = null;
      // 清理聊天 socket
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
    // 廣播會把訊息回送（含 id），不在本地樂觀插入以避免重複；清空輸入框即可
    socket.emit("chat:send", { content: text }, () => {
      sendingRef.current = false;
    });
    // 保險：若 ack 未回，800ms 後解鎖
    setTimeout(() => {
      sendingRef.current = false;
    }, 800);
    setNewMsg("");
  }

  const title = room.subject || room.name;
  const remainingSlots = Math.max(0, room.capacity - members.length);

  return (
    <section id="sect-study-detail">
      <div className="flex justify-between items-start mb-md gap-4">
        <div>
          <h1 className="font-bold text-headline-lg text-on-background">
            {title}
          </h1>
          <p className="text-secondary text-body-md mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">group</span>{" "}
{memberCount} 位成員
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isMember ? (
            <form action={leaveRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <button
                type="submit"
                className="bg-surface-container-high hover:bg-surface-container-highest text-error font-bold text-body-md px-4 py-2 rounded-lg border border-outline-variant/30 shadow-sm transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span> 離開
              </button>
            </form>
          ) : isFull ? (
            <button
              type="button"
              disabled
              className="bg-surface-variant text-on-surface-variant/60 font-bold text-body-md px-4 py-2 rounded-lg border border-outline-variant/30 cursor-not-allowed flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">group_off</span> 已滿
            </button>
          ) : (
            <form action={joinRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <button
                type="submit"
                className="bg-primary hover:bg-surface-tint text-on-primary font-bold text-body-md px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">group_add</span> 加入自習室
              </button>
            </form>
          )}
          {canManage && (
            <form action={deleteRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <button
                type="submit"
                className="bg-error-container hover:opacity-90 text-on-error-container font-bold text-body-md px-4 py-2 rounded-lg border border-error/20 shadow-sm transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span> 解散
              </button>
            </form>
          )}
          <Link
            href="/study-rooms"
            className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-body-md px-4 py-2 rounded-lg border border-outline-variant/30 shadow-sm transition-all flex items-center gap-1 no-underline"
          >
            <span className="material-symbols-outlined">arrow_back</span> 返回列表
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Left: 專注夥伴 */}
        <div className="lg:col-span-3 bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col">
          <h3 className="font-bold text-body-md text-on-surface mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-primary">
              grid_view
            </span>{" "}
            專注夥伴
          </h3>
          <div className="grid grid-cols-2 gap-sm">
            {members.map((m, i) => (
              <div
                key={m.id}
                className="aspect-square bg-surface-container-low dark:bg-surface rounded-lg border border-outline-variant/30 flex flex-col items-center justify-center p-2 relative overflow-hidden group"
              >
                {m.image ? (
                  // 有 Google 頭像就顯示真實照片，沒有才退回 emoji 頭像
                  <img
                    alt=""
                    src={m.image}
                    className="w-10 h-10 mb-1 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl mb-1">
                    {AVATARS[i % AVATARS.length]}
                  </span>
                )}
                <span className="text-[10px] font-bold text-on-surface truncate w-full text-center">
                  {m.name}
                </span>
                {m.isSelf && (
                  <span className="absolute top-1 right-1 bg-primary text-on-primary text-[8px] font-bold px-1 rounded-full">你</span>
                )}
              </div>
            ))}
            {Array.from({ length: remainingSlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square bg-surface-container-lowest border border-dashed border-outline-variant/40 rounded-lg flex items-center justify-center text-outline/50"
              >
                <span className="material-symbols-outlined">add</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: 番茄鐘 */}
        <div className="lg:col-span-6 bg-surface-container-lowest dark:bg-surface-container-high p-xl rounded-xl border border-outline-variant/30 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl opacity-40" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary-container/20 rounded-full blur-3xl opacity-40" />

          <div className="text-center z-10">
            <h2 className="font-bold text-body-lg text-primary dark:text-primary-fixed mb-1">
              專注鐘 (Pomodoro)
            </h2>
            <p className="text-secondary text-xs mb-6">
              {running ? "番茄鐘運作中" : "準備開始一個番茄鐘"}
            </p>

            <div className="text-[72px] font-bold tracking-tight text-on-background leading-none mb-8 tabular-nums">
              {mins}:{secs}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={toggleTimer}
                className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-6 py-2.5 rounded-lg shadow flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined">
                  {running ? "pause" : "play_arrow"}
                </span>
                <span>{running ? "暫停" : "開始"}</span>
              </button>
              <button
                type="button"
                onClick={resetTimer}
                className="bg-surface-container text-on-surface-variant font-bold text-body-md px-5 py-2.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-highest transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined">refresh</span> 重置
              </button>
            </div>
          </div>
        </div>

        {/* Right: 語音 + 目標清單 + 聊天 */}
        <div className="lg:col-span-3 flex flex-col gap-md h-full">
          {/* 語音通話（WebRTC + Cloudflare TURN） */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col">
            <h3 className="font-bold text-body-md text-on-surface mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-primary">mic</span>
              語音通話
              {inVoice && (
                <span className="ml-1 text-[10px] font-normal text-green-600 dark:text-green-400">
                  ● 通話中（{voicePeers.length + 1} 人）
                </span>
              )}
            </h3>
            {voiceError && (
              <p className="text-[10px] text-error mb-1.5">{voiceError}</p>
            )}
            {!isMember ? (
              <p className="text-[11px] text-secondary">加入此自習室後即可使用語音通話。</p>
            ) : !inVoice ? (
              <button
                type="button"
                onClick={() => voiceApiRef.current?.join()}
                className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                加入語音
              </button>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => voiceApiRef.current?.toggleMute()}
                  className="bg-surface-container hover:bg-surface-container-highest text-on-surface-variant font-bold text-[11px] px-2.5 py-1.5 rounded-lg border border-outline-variant/30 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {voiceMuted ? "mic_off" : "mic"}
                  </span>
                  {voiceMuted ? "已靜音" : "靜音"}
                </button>
                {recording ? (
                  <button
                    type="button"
                    onClick={() => voiceApiRef.current?.stopRec()}
                    className="bg-error text-on-error font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 animate-pulse"
                  >
                    <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                    停止錄音
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => voiceApiRef.current?.startRec()}
                    className="bg-surface-container hover:bg-surface-container-highest text-on-surface-variant font-bold text-[11px] px-2.5 py-1.5 rounded-lg border border-outline-variant/30 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">fiber_manual_record</span>
                    錄音
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => voiceApiRef.current?.leave()}
                  className="bg-error-container text-on-error-container hover:opacity-90 font-bold text-[11px] px-2.5 py-1.5 rounded-lg border border-error/20 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">call_end</span>
                  離開
                </button>
              </div>
            )}
            {inVoice && voicePeers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {voicePeers.map((p) => (
                  <span
                    key={p.id}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-primary-container/40 text-on-primary-container flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[12px]">graphic_eq</span>
                    {p.name}
                  </span>
                ))}
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

          {/* 今日小組目標 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col min-h-[220px]">
            <h3 className="font-bold text-body-md text-on-surface mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-tertiary">
                playlist_add_check
              </span>{" "}
              今日小組目標
            </h3>

            <div className="space-y-1.5 flex-grow overflow-y-auto max-h-[160px] pr-1">
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

            <div className="mt-2.5 relative">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => {
                  // 中文 IME 用 Enter 選字時不送出；連按(repeat)也擋掉
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

          {/* 即時文字討論區 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col min-h-[280px]">
            <h3 className="font-bold text-body-md text-on-surface mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-secondary">
                forum
              </span>{" "}
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
                        : "bg-secondary animate-pulse"
                  }`}
                />
                {chatStatus === "connected"
                  ? "即時連線中"
                  : chatStatus === "error"
                    ? "未連線"
                    : "連線中…"}
              </span>
            </h3>
            <div className="flex-grow overflow-y-auto text-xs space-y-2 max-h-[200px] pr-1 flex flex-col">
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
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onCompositionStart={() => {
                  composingRef.current = true;
                }}
                onCompositionEnd={() => {
                  composingRef.current = false;
                }}
                onKeyDown={(e) => {
                  // IME 組字中的 Enter 不送出（避免吃掉選字）
                  if (e.key === "Enter" && !composingRef.current && !e.nativeEvent.isComposing) {
                    sendMessage();
                  }
                }}
                disabled={chatStatus !== "connected"}
                placeholder={
                  chatStatus === "connected" ? "輸入訊息…" : "連線中…"
                }
                className="flex-grow bg-surface-container-low dark:bg-surface border border-outline-variant/40 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none disabled:opacity-60"
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
          </div>
        </div>
      </div>
    </section>
  );
}
