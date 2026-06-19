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
import {
  createNoiseSuppressedTrack,
  SpeakingDetector,
  type NoiseSuppressionHandle,
} from "@/components/study-room/audioProcessing";

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

/** 語音 peer：socket id → 使用者 id/名稱 + 媒體串流 + 是否有視訊 */
interface VoicePeer {
  id: string;
  userId: string | null;
  name: string;
  stream: MediaStream;
  hasVideo: boolean;
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
// 強制錄製：每段最長時長，到點先上傳再續錄（避免單檔過大 / 失聯時整段遺失）。
const REC_SEGMENT_MS = 150_000; // 2.5 分鐘

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
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // IME（中文／日文等組字）期間不送出
  const composingRef = useRef(false);
  // 防連點重複送出
  const sendingRef = useRef(false);

  // ---- 語音 / 視訊通話（WebRTC mesh + Cloudflare TURN）----
  const [inVoice, setInVoice] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  // 強制錄製：加入語音即自動開始，使用者無法關閉；此旗標只用於顯示紅點指示。
  const [recording, setRecording] = useState(false);
  // 錄影中是否含影像（鏡頭開啟時為 true），決定紅點文字「錄音中／錄音錄影中」。
  const [recordingVideo, setRecordingVideo] = useState(false);
  // 降噪是否成功套用 RNNoise（false = 退回瀏覽器內建降噪）。
  const [rnnoiseActive, setRnnoiseActive] = useState(false);
  const [voicePeers, setVoicePeers] = useState<VoicePeer[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  // 說話者偵測：正在說話的 key 集合（"self" 或 peer socket id）。
  const [speakingKeys, setSpeakingKeys] = useState<Set<string>>(new Set());
  // 加入語音前的隱私同意提示是否顯示。
  const [showConsent, setShowConsent] = useState(false);
  const [localStreamState, setLocalStreamState] = useState<MediaStream | null>(
    null,
  );
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // 由 socket effect 注入的語音操作 API（給按鈕呼叫，避免 socket 監聽重複註冊）
  const voiceApiRef = useRef<{
    join: () => void;
    leave: () => void;
    toggleMute: () => void;
    toggleCamera: () => void;
    forceMute: (userId: string) => void;
    forceCameraOff: (userId: string) => void;
  } | null>(null);

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

    // ----- 語音/視訊通話：WebRTC mesh 信令 + 本地媒體/錄音 -----
    const pcs = new Map<string, RTCPeerConnection>();
    // socket id → { userId, name }；用於把 peer 對應回成員（管理操作要 userId）
    const peerInfo = new Map<string, { userId: string | null; name: string }>();
    // localStream：送給 peer 的串流（降噪後的音訊 track + 可選 video track）。
    let localStream: MediaStream | null = null;
    // 原始麥克風 track（RNNoise 的輸入）；靜音時停用這條讓音訊不再流入降噪鏈。
    let rawMicTrack: MediaStreamTrack | null = null;
    // RNNoise 處理控制代碼（離開時釋放）。
    let noiseHandle: NoiseSuppressionHandle | null = null;
    let iceServers: RTCIceServer[] = [];
    // 強制錄製：分段錄音器 + 計時器；每段 onstop 立即上傳。
    let recorder: MediaRecorder | null = null;
    let recChunks: Blob[] = [];
    let recStart = 0;
    let recSegmentTimer: ReturnType<typeof setTimeout> | null = null;
    // 是否仍在通話中（控制分段錄音是否續錄）。
    let voiceActive = false;
    // 說話偵測器（離開時 destroy）。
    let speaking: SpeakingDetector | null = null;
    // ---- Perfect negotiation 狀態（支援開/關鏡頭時雙向重新協商且不卡 glare）----
    const makingOffer = new Map<string, boolean>();
    const politeMap = new Map<string, boolean>();
    const ignoreOffer = new Map<string, boolean>();

    const closePeer = (id: string) => {
      const pc = pcs.get(id);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onnegotiationneeded = null;
        pc.close();
        pcs.delete(id);
      }
      peerInfo.delete(id);
      makingOffer.delete(id);
      politeMap.delete(id);
      ignoreOffer.delete(id);
      speaking?.remove(id);
      setVoicePeers((ps) => ps.filter((p) => p.id !== id));
    };

    const makePeer = async (
      peerId: string,
      peerName: string,
      peerUserId: string | null,
      initiator: boolean,
    ) => {
      let pc = pcs.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers });
      pcs.set(peerId, pc);
      peerInfo.set(peerId, { userId: peerUserId, name: peerName });
      politeMap.set(peerId, (socket.id ?? "") < peerId);
      makingOffer.set(peerId, false);
      ignoreOffer.set(peerId, false);
      if (localStream) {
        for (const t of localStream.getTracks()) pc.addTrack(t, localStream);
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("voice:signal", {
            to: peerId,
            data: { candidate: e.candidate },
          });
        }
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        const hasVideo = stream.getVideoTracks().length > 0;
        const info = peerInfo.get(peerId);
        // 註冊到說話偵測器（同一 stream 多次呼叫會自動忽略）
        speaking?.add(peerId, stream);
        setVoicePeers((ps) => [
          ...ps.filter((p) => p.id !== peerId),
          {
            id: peerId,
            userId: info?.userId ?? peerUserId,
            name: info?.name ?? peerName,
            stream,
            hasVideo,
          },
        ]);
        // 視訊 track 增刪會觸發 mute/unmute；用它更新 hasVideo
        for (const track of stream.getVideoTracks()) {
          const refresh = () => {
            const stillHasVideo = stream
              .getVideoTracks()
              .some((t) => t.readyState === "live" && !t.muted);
            setVoicePeers((ps) =>
              ps.map((p) =>
                p.id === peerId ? { ...p, hasVideo: stillHasVideo } : p,
              ),
            );
          };
          track.onmute = refresh;
          track.onunmute = refresh;
          track.onended = refresh;
        }
      };
      pc.onnegotiationneeded = async () => {
        try {
          makingOffer.set(peerId, true);
          await pc.setLocalDescription();
          socket.emit("voice:signal", {
            to: peerId,
            data: { sdp: pc.localDescription },
          });
        } catch {
          /* ignore */
        } finally {
          makingOffer.set(peerId, false);
        }
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
      if (initiator && localStream) {
        try {
          makingOffer.set(peerId, true);
          await pc.setLocalDescription();
          socket.emit("voice:signal", {
            to: peerId,
            data: { sdp: pc.localDescription },
          });
        } catch {
          /* ignore */
        } finally {
          makingOffer.set(peerId, false);
        }
      }
      return pc;
    };

    socket.on(
      "voice:signal",
      async ({
        from,
        fromName,
        fromUserId,
        data,
      }: {
        from: string;
        fromName: string;
        fromUserId?: string | null;
        data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      }) => {
        try {
          const pc =
            pcs.get(from) ??
            (await makePeer(from, fromName, fromUserId ?? null, false));

          if (data?.sdp) {
            const polite = politeMap.get(from) ?? true;
            const offerCollision =
              data.sdp.type === "offer" &&
              (makingOffer.get(from) || pc.signalingState !== "stable");
            const ignore = !polite && offerCollision;
            ignoreOffer.set(from, ignore);
            if (ignore) return;

            await pc.setRemoteDescription(data.sdp);
            if (data.sdp.type === "offer") {
              await pc.setLocalDescription();
              socket.emit("voice:signal", {
                to: from,
                data: { sdp: pc.localDescription },
              });
            }
          } else if (data?.candidate) {
            try {
              await pc.addIceCandidate(data.candidate);
            } catch (err) {
              if (!ignoreOffer.get(from)) throw err;
            }
          }
        } catch {
          /* 忽略個別信令錯誤，不影響其他 peer */
        }
      },
    );

    socket.on("voice:peer-left", ({ id }: { id: string }) => closePeer(id));

    // 被管理員強制靜音：停用本地原始麥克風 track
    socket.on("voice:force-mute", ({ by }: { by?: string }) => {
      if (rawMicTrack) rawMicTrack.enabled = false;
      setVoiceMuted(true);
      setVoiceNotice(`${by ? by : "管理員"}已將你靜音`);
      window.setTimeout(() => setVoiceNotice(null), 3500);
    });

    // 被管理員強制關鏡頭：停用並移除本地視訊 track，重新協商
    socket.on("voice:force-camera-off", ({ by }: { by?: string }) => {
      void disableCamera();
      setVoiceNotice(`${by ? by : "管理員"}已關閉你的鏡頭`);
      window.setTimeout(() => setVoiceNotice(null), 3500);
    });

    // ---- 強制錄製：以目前 localStream 啟動一段分段錄音 ----
    const startSegment = () => {
      if (!localStream || !voiceActive) return;
      try {
        recChunks = [];
        recorder = new MediaRecorder(localStream);
        recStart = performance.now();
        const hasVideo = localStream.getVideoTracks().length > 0;
        setRecording(true);
        setRecordingVideo(hasVideo);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recChunks.push(e.data);
        };
        recorder.onstop = async () => {
          const chunks = recChunks;
          recChunks = [];
          const durMs = Math.round(performance.now() - recStart);
          // 續錄：只要還在通話中就立即開下一段（以最新 localStream）
          if (voiceActive) startSegment();
          else {
            setRecording(false);
            setRecordingVideo(false);
          }
          if (chunks.length === 0) return;
          const type = recorder?.mimeType || "audio/webm";
          const blob = new Blob(chunks, { type });
          if (blob.size === 0) return;
          const fd = new FormData();
          // 檔名副檔名僅作辨識；contentType 才是 server 端判斷影片/語音的依據
          fd.append("audio", blob, "recording.webm");
          fd.append("roomId", room.id);
          fd.append("durationMs", String(durMs));
          try {
            await fetch("/api/recordings", { method: "POST", body: fd });
          } catch {
            /* 上傳失敗忽略，不阻斷通話 */
          }
        };
        recorder.start();
        // 到時間先 stop（onstop 會上傳並自動續錄下一段）
        recSegmentTimer = setTimeout(() => {
          if (recorder && recorder.state !== "inactive") recorder.stop();
        }, REC_SEGMENT_MS);
      } catch {
        // 瀏覽器不支援錄音：仍可通話，但提示無法錄製（隱私上應極少發生）
        setVoiceError("此瀏覽器不支援錄製，無法符合錄音規範");
        setRecording(false);
      }
    };

    // 重啟錄製：鏡頭開/關後 track 變動，需用新的 localStream 重新錄一段。
    const restartRecording = () => {
      if (recSegmentTimer) {
        clearTimeout(recSegmentTimer);
        recSegmentTimer = null;
      }
      if (recorder && recorder.state !== "inactive") {
        recorder.stop(); // onstop 會上傳本段並（因 voiceActive）自動以新串流續錄
      } else {
        startSegment();
      }
    };

    const join = async () => {
      try {
        setVoiceError(null);
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          setVoiceError("需在 HTTPS（安全來源）下才能使用語音，請改用正式網域。");
          return;
        }
        const res = await fetch("/api/turn");
        const json = (await res.json()) as { iceServers?: RTCIceServer[] };
        iceServers = json.iceServers ?? [];
        // 瀏覽器內建降噪約束（echo / agc / noise suppression）
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
          },
          video: false,
        });
        rawMicTrack = micStream.getAudioTracks()[0] ?? null;
        // RNNoise（AI 降噪）：在送出前處理麥克風；失敗時優雅退回原始 track
        let audioTrack = rawMicTrack;
        if (rawMicTrack) {
          noiseHandle = await createNoiseSuppressedTrack(rawMicTrack);
          audioTrack = noiseHandle.track;
          setRnnoiseActive(noiseHandle.active);
        }
        // 送給 peer / 錄音的本地串流：降噪後音訊 track（之後可加 video）
        localStream = new MediaStream();
        if (audioTrack) localStream.addTrack(audioTrack);
        setLocalStreamState(localStream);
        setVoiceMuted(false);
        setCameraOn(false);

        // 說話偵測：本地用原始麥克風串流（降噪後 RMS 較弱，原始更靈敏）
        speaking = new SpeakingDetector((set) => setSpeakingKeys(set));
        speaking.add("self", micStream);

        socket.emit(
          "voice:join",
          (ack: {
            ok: boolean;
            peers?: { id: string; name: string; userId?: string | null }[];
            error?: string;
          }) => {
            if (!ack?.ok) {
              setVoiceError(ack?.error ?? "加入語音失敗");
              micStream.getTracks().forEach((t) => t.stop());
              noiseHandle?.destroy();
              noiseHandle = null;
              localStream = null;
              rawMicTrack = null;
              speaking?.destroy();
              speaking = null;
              setLocalStreamState(null);
              return;
            }
            setInVoice(true);
            voiceActive = true;
            // 強制錄製：加入即自動開始（含影像時連 video 一起錄）
            startSegment();
            for (const p of ack.peers ?? [])
              makePeer(p.id, p.name, p.userId ?? null, true);
          },
        );
      } catch {
        setVoiceError("無法取得麥克風權限");
      }
    };

    // 開啟鏡頭：取得 video track，加到本地 stream 與所有 peer，重新協商並重啟錄製
    const enableCamera = async () => {
      if (!localStream) return;
      if (localStream.getVideoTracks().length > 0) {
        setCameraOn(true);
        return;
      }
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const videoTrack = camStream.getVideoTracks()[0];
        if (!videoTrack) return;
        localStream.addTrack(videoTrack);
        setLocalStreamState(localStream);
        setCameraOn(true);
        for (const [, pc] of pcs) pc.addTrack(videoTrack, localStream);
        // 鏡頭開啟後，後續錄製要連影像一起錄 → 重啟錄製段
        restartRecording();
      } catch {
        setVoiceError("無法取得相機權限");
      }
    };

    // 關閉鏡頭：停止並移除 video track，從 peer 移除 sender 後重新協商並重啟錄製
    const disableCamera = async () => {
      if (!localStream) {
        setCameraOn(false);
        return;
      }
      const videoTracks = localStream.getVideoTracks();
      const hadVideo = videoTracks.length > 0;
      for (const [, pc] of pcs) {
        for (const sender of pc.getSenders()) {
          if (sender.track && sender.track.kind === "video") {
            pc.removeTrack(sender);
          }
        }
      }
      for (const t of videoTracks) {
        t.stop();
        localStream.removeTrack(t);
      }
      setLocalStreamState(localStream);
      setCameraOn(false);
      if (hadVideo) restartRecording();
    };

    const toggleCamera = () => {
      const hasVideo = (localStream?.getVideoTracks().length ?? 0) > 0;
      if (hasVideo) void disableCamera();
      else void enableCamera();
    };

    const leave = () => {
      voiceActive = false;
      socket.emit("voice:leave");
      for (const id of [...pcs.keys()]) closePeer(id);
      if (recSegmentTimer) {
        clearTimeout(recSegmentTimer);
        recSegmentTimer = null;
      }
      // 停止錄製：最後一段會在 onstop 上傳（voiceActive 已為 false，不再續錄）
      if (recorder && recorder.state !== "inactive") recorder.stop();
      // 釋放降噪鏈與原始麥克風
      noiseHandle?.destroy();
      noiseHandle = null;
      rawMicTrack?.stop();
      rawMicTrack = null;
      localStream?.getTracks().forEach((t) => t.stop());
      localStream = null;
      speaking?.destroy();
      speaking = null;
      setSpeakingKeys(new Set());
      setLocalStreamState(null);
      setInVoice(false);
      setRecording(false);
      setRecordingVideo(false);
      setRnnoiseActive(false);
      setCameraOn(false);
      setVoicePeers([]);
    };

    const toggleMute = () => {
      if (!rawMicTrack) return;
      const next = !rawMicTrack.enabled;
      rawMicTrack.enabled = next;
      setVoiceMuted(!next);
    };

    const forceMute = (userId: string) => {
      socket.emit(
        "voice:force-mute",
        { userId },
        (ack: { ok: boolean; error?: string }) => {
          if (!ack?.ok) setVoiceError(ack?.error ?? "操作失敗");
        },
      );
    };
    const forceCameraOff = (userId: string) => {
      socket.emit(
        "voice:force-camera-off",
        { userId },
        (ack: { ok: boolean; error?: string }) => {
          if (!ack?.ok) setVoiceError(ack?.error ?? "操作失敗");
        },
      );
    };

    voiceApiRef.current = {
      join,
      leave,
      toggleMute,
      toggleCamera,
      forceMute,
      forceCameraOff,
    };

    return () => {
      // 清理語音
      voiceActive = false;
      socket.emit("voice:leave");
      for (const pc of pcs.values()) pc.close();
      pcs.clear();
      peerInfo.clear();
      if (recSegmentTimer) clearTimeout(recSegmentTimer);
      if (recorder && recorder.state !== "inactive") recorder.stop();
      noiseHandle?.destroy();
      rawMicTrack?.stop();
      localStream?.getTracks().forEach((t) => t.stop());
      speaking?.destroy();
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
  const showVideoGrid = inVoice && (cameraOn || videoPeers.length > 0);

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

  const title = room.subject || room.name;
  const remainingSlots = Math.max(0, room.capacity - members.length);

  // 紅點指示文字：開鏡頭時是「錄音錄影中」，否則「錄音中」。
  const recordingLabel = recordingVideo ? "錄音錄影中" : "錄音中";

  return (
    <section id="sect-study-detail" className="pb-6">
      {/* ===== 標題列 ===== */}
      <div className="flex flex-col gap-3 mb-lg sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="font-bold text-headline-lg text-on-background">
            {title}
          </h1>
          <p className="text-secondary text-body-md mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">group</span>{" "}
              {memberCount} 位成員
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">person</span>{" "}
              建立者：{creatorName ?? "系統房間"}
            </span>
            {room.hasPassword && (
              <span className="flex items-center gap-1 text-tertiary">
                <span className="material-symbols-outlined text-sm">lock</span>{" "}
                私密房
              </span>
            )}
            {recording && (
              <span className="flex items-center gap-1 font-bold text-error">
                <span className="inline-block w-2 h-2 rounded-full bg-error animate-pulse" />
                {recordingLabel}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={copyInviteLink}
            className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-body-md px-4 py-2 rounded-lg border border-outline-variant/30 shadow-sm transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? "check" : "link"}
            </span>{" "}
            {copied ? "已複製" : "邀請連結"}
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
            <form action={joinRoom} className="flex items-center gap-2">
              <input type="hidden" name="roomId" value={room.id} />
              {room.hasPassword && (
                <input
                  type="password"
                  name="password"
                  required
                  maxLength={64}
                  placeholder="房間密碼"
                  className="w-32 bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              )}
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

      {/* ===== 主版面：左欄(夥伴+語音) / 中央(視訊或番茄鐘) / 右欄(目標+聊天) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md items-start">
        {/* ---------- 左欄：專注夥伴 + 語音成員 + 語音控制 ---------- */}
        <div className="lg:col-span-3 flex flex-col gap-md">
          {/* 專注夥伴 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-body-md text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-primary">
                  grid_view
                </span>{" "}
                專注夥伴
              </h3>
              <span className="text-[10px] font-bold text-secondary bg-surface-container-high px-2 py-0.5 rounded-full">
                {members.length}/{room.capacity}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-sm">
              {members.map((m, i) => {
                const targetInVoice = voicePeers.find((p) => p.userId === m.id);
                return (
                  <div
                    key={m.id}
                    className="aspect-square bg-surface-container-low dark:bg-surface rounded-lg border border-outline-variant/30 flex flex-col items-center justify-center p-1.5 relative overflow-hidden group"
                  >
                    <Link
                      href={`/u/${m.id}`}
                      className="flex flex-col items-center justify-center no-underline min-w-0 w-full"
                      title={`查看 ${m.name} 的個人檔案`}
                    >
                      {m.image ? (
                        <img
                          alt=""
                          src={m.image}
                          className="w-9 h-9 mb-1 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl mb-1">
                          {AVATARS[i % AVATARS.length]}
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-on-surface truncate w-full text-center group-hover:text-primary transition-colors">
                        {m.name}
                      </span>
                    </Link>
                    {m.isSelf && (
                      <span className="absolute top-1 right-1 bg-primary text-on-primary text-[8px] font-bold px-1 rounded-full">你</span>
                    )}
                    {m.isOwner ? (
                      <span className="absolute top-1 left-1 bg-tertiary-container text-on-tertiary-container text-[8px] font-bold px-1 rounded-full flex items-center">
                        <span className="material-symbols-outlined text-[10px]">star</span>
                      </span>
                    ) : m.isModerator ? (
                      <span className="absolute top-1 left-1 bg-secondary-container text-on-secondary-container text-[8px] font-bold px-1 rounded-full flex items-center">
                        <span className="material-symbols-outlined text-[10px]">shield_person</span>
                      </span>
                    ) : null}

                    {/* 管理控制：建立者可指派/取消管理員；管理員可禁麥/禁鏡/踢人 */}
                    {!m.isSelf && (canModerate || canEdit) && (
                      <div className="absolute inset-x-0 bottom-0 bg-surface-container-highest/95 px-1 py-1 flex flex-wrap items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {canEdit && !m.isOwner && (
                          <button
                            type="button"
                            title={m.isModerator ? "取消管理員" : "設為管理員"}
                            onClick={() =>
                              setRoomModerator(room.id, m.id, !m.isModerator)
                            }
                            className="p-0.5 rounded text-on-surface-variant hover:text-primary hover:bg-primary-container/40"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {m.isModerator ? "remove_moderator" : "add_moderator"}
                            </span>
                          </button>
                        )}
                        {canModerate && !m.isOwner && (
                          <>
                            <button
                              type="button"
                              title="強制靜音"
                              disabled={!targetInVoice}
                              onClick={() => voiceApiRef.current?.forceMute(m.id)}
                              className="p-0.5 rounded text-on-surface-variant hover:text-error hover:bg-error-container/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-[14px]">mic_off</span>
                            </button>
                            <button
                              type="button"
                              title="強制關鏡頭"
                              disabled={!targetInVoice}
                              onClick={() =>
                                voiceApiRef.current?.forceCameraOff(m.id)
                              }
                              className="p-0.5 rounded text-on-surface-variant hover:text-error hover:bg-error-container/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-[14px]">videocam_off</span>
                            </button>
                            <button
                              type="button"
                              title="踢出"
                              onClick={() => kickMember(room.id, m.id)}
                              className="p-0.5 rounded text-on-surface-variant hover:text-error hover:bg-error-container/40"
                            >
                              <span className="material-symbols-outlined text-[14px]">person_remove</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: remainingSlots }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square bg-surface-container-lowest border border-dashed border-outline-variant/40 rounded-lg flex items-center justify-center text-outline/50"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </div>
              ))}
            </div>
          </div>

          {/* 語音 / 視訊通話 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-body-md text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-primary">groups</span>
                語音通話
              </h3>
              {recording && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-error bg-error-container/40 px-2 py-0.5 rounded-full">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                  {recordingLabel}
                </span>
              )}
            </div>

            {voiceError && (
              <p className="text-[10px] text-error mb-1.5">{voiceError}</p>
            )}
            {voiceNotice && (
              <p className="text-[10px] text-tertiary mb-1.5">{voiceNotice}</p>
            )}

            {/* 誰在語音中（頭像 + Discord 風 speaking 綠色光環） */}
            {inVoice && (
              <div className="mb-2.5">
                <p className="text-[10px] text-secondary mb-1.5">
                  通話中（{voiceParticipants.length} 人）
                </p>
                <div className="flex flex-wrap gap-2">
                  {voiceParticipants.map((p) => {
                    const isSpeaking = speakingKeys.has(p.key);
                    return (
                      <div
                        key={p.key}
                        className="flex flex-col items-center gap-0.5 w-12"
                        title={`${p.name}${isSpeaking ? "（說話中）" : ""}`}
                      >
                        <div
                          className={`relative w-10 h-10 rounded-full p-[2px] transition-all ${
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
                            <div className="w-full h-full rounded-full bg-surface-container-high flex items-center justify-center text-base">
                              {p.isSelf ? "🙂" : "🧑‍🎓"}
                            </div>
                          )}
                          {p.hasVideo && (
                            <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-on-primary rounded-full w-3.5 h-3.5 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px]">videocam</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-on-surface truncate w-full text-center">
                          {p.isSelf ? "你" : p.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!isMember ? (
              <p className="text-[11px] text-secondary">加入此自習室後即可使用語音/視訊通話。</p>
            ) : !inVoice ? (
              <button
                type="button"
                onClick={() => setShowConsent(true)}
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
                  className={`font-bold text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${
                    voiceMuted
                      ? "bg-error-container text-on-error-container border-error/30"
                      : "bg-surface-container hover:bg-surface-container-highest text-on-surface-variant border-outline-variant/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {voiceMuted ? "mic_off" : "mic"}
                  </span>
                  {voiceMuted ? "已靜音" : "靜音"}
                </button>
                <button
                  type="button"
                  onClick={() => voiceApiRef.current?.toggleCamera()}
                  className={`font-bold text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${
                    cameraOn
                      ? "bg-primary-container text-on-primary-container border-primary/30"
                      : "bg-surface-container hover:bg-surface-container-highest text-on-surface-variant border-outline-variant/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {cameraOn ? "videocam" : "videocam_off"}
                  </span>
                  {cameraOn ? "關鏡頭" : "開鏡頭"}
                </button>
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

            {inVoice && (
              <p className="mt-2 text-[9px] text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">
                  {rnnoiseActive ? "graphic_eq" : "noise_control_off"}
                </span>
                {rnnoiseActive ? "AI 降噪已啟用（RNNoise）" : "使用瀏覽器內建降噪"}
              </p>
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

        {/* ---------- 中央：通話中→視訊格優先；否則→番茄鐘 ---------- */}
        <div className="lg:col-span-6 flex flex-col gap-md">
          {/* 視訊格（grid）：通話中且有任何鏡頭時，置於中央區並明顯放大 */}
          {showVideoGrid && (
            <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border-2 border-primary/30 shadow-md ring-1 ring-primary/10">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-bold text-body-md text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-primary">videocam</span>
                  視訊
                </h3>
                {recording && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-error">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                    {recordingLabel}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 本地預覽 */}
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
                    <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      {voiceMuted && (
                        <span className="material-symbols-outlined text-[12px]">mic_off</span>
                      )}
                      你
                    </span>
                  </div>
                )}
                {videoPeers.map((p) => {
                  const mem = p.userId ? memberByUserId.get(p.userId) : null;
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
                      <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {mem?.name ?? p.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 番茄鐘：通話且有視訊時縮為精簡橫條，否則為大型主視覺 */}
          {showVideoGrid ? (
            <div className="bg-surface-container-lowest dark:bg-surface-container-high px-md py-3 rounded-xl border border-outline-variant/30 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-primary">timer</span>
                <span className="text-2xl font-bold tabular-nums text-on-background">
                  {mins}:{secs}
                </span>
                <span className="text-[11px] text-secondary truncate">
                  {running ? "番茄鐘運作中" : "已暫停"}
                </span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleTimer}
                  className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-3 py-1.5 rounded-lg shadow flex items-center gap-1 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {running ? "pause" : "play_arrow"}
                  </span>
                  {running ? "暫停" : "開始"}
                </button>
                <button
                  type="button"
                  onClick={resetTimer}
                  className="bg-surface-container text-on-surface-variant font-bold text-xs px-3 py-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-highest transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest dark:bg-surface-container-high p-xl rounded-xl border border-outline-variant/30 shadow-sm flex flex-col items-center justify-center relative overflow-hidden min-h-[360px]">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl opacity-40" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary-container/20 rounded-full blur-3xl opacity-40" />

              <div className="text-center z-10">
                <h2 className="font-bold text-body-lg text-primary dark:text-primary-fixed mb-1">
                  專注鐘 (Pomodoro)
                </h2>
                <p className="text-secondary text-xs mb-6">
                  {running ? "番茄鐘運作中" : "準備開始一個番茄鐘"}
                </p>

                <div className="text-[80px] font-bold tracking-tight text-on-background leading-none mb-8 tabular-nums">
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
          )}
        </div>

        {/* ---------- 右欄：今日目標 + 即時討論 ---------- */}
        <div className="lg:col-span-3 flex flex-col gap-md">
          {/* 今日小組目標 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col">
            <h3 className="font-bold text-body-md text-on-surface mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-tertiary">
                playlist_add_check
              </span>{" "}
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

          {/* 即時文字討論區 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col min-h-[320px] flex-grow">
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
            <div className="flex-grow overflow-y-auto text-xs space-y-2 max-h-[280px] pr-1 flex flex-col">
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
                placeholder={
                  chatStatus === "connected" ? "輸入訊息…（Enter 送出、Shift+Enter 換行）" : "連線中…"
                }
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
                  voiceApiRef.current?.join();
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
