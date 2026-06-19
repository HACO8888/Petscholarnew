"use client";

/**
 * VoiceCallProvider：全域（掛在 (app)/layout）持有「Discord 式持久語音」的所有狀態與邏輯，
 * 使導航到別頁時通話不中斷。
 *
 * 擁有：
 *  - 專屬 Socket.IO 連線（join 時建立、leave 時關閉。以 ?roomId= 帶房、由 cookie 驗身分）。
 *    注意：聊天文字仍由頁面元件 StudyRoomDetail 自己的 socket 處理，兩者各自獨立。
 *  - getUserMedia（echoCancellation/autoGainControl/noiseSuppression）+ RNNoise（AI 降噪）。
 *  - WebRTC mesh peer 連線 + voice 信令（perfect negotiation）。
 *  - 強制錄製（MediaRecorder：音訊一律錄、開鏡頭連影像。每段分段上傳 /api/recordings。離開上傳最後一段）。
 *  - 加入前同意彈窗（由消費端觸發 join。本 Provider 全程提供 recording 指示）。
 *  - 說話偵測（SpeakingDetector）、靜音/開鏡頭、moderation（forceMute/forceCameraOff/kick）。
 *
 * 以 useVoiceCall() 暴露狀態與操作給：房頁完整 UI（StudyRoomDetail）與右下角 FloatingVoiceWidget。
 * 單一通話限制：同時只會在一個房間語音。已在 A 房時對 B 房 join 會被拒絕並回傳訊息。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  createNoiseSuppressedTrack,
  SpeakingDetector,
  type NoiseSuppressionHandle,
} from "@/components/study-room/audioProcessing";
import {
  createProcessedVideoTrack,
  DEFAULT_VIRTUAL_BG,
  type ProcessedVideoHandle,
  type VirtualBgState,
} from "@/components/voice/videoProcessing";

// 強制錄製：每段最長時長，到點先上傳再續錄（避免單檔過大 / 失聯時整段遺失）。
const REC_SEGMENT_MS = 150_000; // 2.5 分鐘

/** 語音 peer：socket id → 使用者 id/名稱 + 媒體串流 + 是否有視訊。 */
export interface VoicePeer {
  id: string;
  userId: string | null;
  name: string;
  stream: MediaStream;
  hasVideo: boolean;
}

/** useVoiceCall() 對外介面。 */
export interface VoiceCallContextValue {
  /** 目前語音所在房 id（未在語音時為 null）。 */
  activeRoomId: string | null;
  /** 目前語音所在房名（給浮動視窗顯示）。 */
  activeRoomName: string | null;
  /** 是否在語音中。 */
  inVoice: boolean;
  /** 對端清單（不含自己）。 */
  participants: VoicePeer[];
  /** 正在說話的 key 集合（"self" 或 peer socket id）。 */
  speakingKeys: Set<string>;
  muted: boolean;
  cameraOn: boolean;
  /** 是否正在錄製（加入語音即恆為 true，使用者無法關閉）。 */
  recording: boolean;
  /** 目前錄製是否含影像（鏡頭開啟時）。 */
  recordingVideo: boolean;
  /** 是否成功套用 RNNoise（false = 退回瀏覽器內建降噪）。 */
  rnnoiseActive: boolean;
  error: string | null;
  notice: string | null;
  /** 本地串流（降噪後音訊 + 可選「已套虛擬背景」video），給本地預覽 <video> 用。 */
  localStream: MediaStream | null;
  /** 目前虛擬背景設定（無 / 模糊 / 圖片）。跨頁持續。 */
  virtualBg: VirtualBgState;
  /**
   * 切換虛擬背景（模式 / 圖片）。鏡頭開啟時即時生效、不需重開鏡頭，
   * 處理後 track 持續相同 → 送 peer 與錄製來源不變、無縫切換。
   */
  setVirtualBg: (next: VirtualBgState) => void;
  /** 加入指定房語音。roomName 供浮動視窗顯示。 */
  join: (roomId: string, roomName: string) => void;
  /** 離開語音（上傳最後一段錄製）。 */
  leave: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  forceMute: (userId: string) => void;
  forceCameraOff: (userId: string) => void;
  kick: (userId: string) => void;
  /** 清除目前錯誤訊息。 */
  clearError: () => void;
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

/** 在 VoiceCallProvider 之內取得語音狀態與操作。 */
export function useVoiceCall(): VoiceCallContextValue {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) {
    throw new Error("useVoiceCall 必須在 <VoiceCallProvider> 內使用");
  }
  return ctx;
}

export default function VoiceCallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // ---- 對外狀態 ----
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomName, setActiveRoomName] = useState<string | null>(null);
  const [inVoice, setInVoice] = useState(false);
  const [participants, setParticipants] = useState<VoicePeer[]>([]);
  const [speakingKeys, setSpeakingKeys] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [rnnoiseActive, setRnnoiseActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // 虛擬背景設定（跨頁持續。切換不需重開鏡頭）。
  const [virtualBg, setVirtualBgState] = useState<VirtualBgState>(
    DEFAULT_VIRTUAL_BG,
  );

  // ---- 內部可變狀態（不觸發 render。以 ref 持有，跨 render 穩定）----
  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const peerInfoRef = useRef(
    new Map<string, { userId: string | null; name: string }>(),
  );
  const localStreamRef = useRef<MediaStream | null>(null);
  const rawMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const noiseHandleRef = useRef<NoiseSuppressionHandle | null>(null);
  // 鏡頭：原始 getUserMedia 視訊 track（送進虛擬背景管線的來源。非送 peer 的那條）。
  const rawCamTrackRef = useRef<MediaStreamTrack | null>(null);
  // 虛擬背景處理控制代碼（active 時其 .track 才是送 peer / 錄製的那條）。
  const videoHandleRef = useRef<ProcessedVideoHandle | null>(null);
  // 以 ref 同步最新虛擬背景設定，供開鏡頭時讀取（避免閉包過期）。
  const virtualBgRef = useRef<VirtualBgState>(DEFAULT_VIRTUAL_BG);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const recSegmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceActiveRef = useRef(false);
  const speakingRef = useRef<SpeakingDetector | null>(null);
  // 分段錄音「續錄」需在 onstop 內呼叫自己。以 ref 持有最新 startSegment 以避開自我參照。
  const startSegmentRef = useRef<() => void>(() => {});
  // Perfect negotiation 狀態。
  const makingOfferRef = useRef(new Map<string, boolean>());
  const politeMapRef = useRef(new Map<string, boolean>());
  const ignoreOfferRef = useRef(new Map<string, boolean>());
  // notice 計時器（避免殘留）。
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ---- peer 關閉 ----
  const closePeer = useCallback((id: string) => {
    const pc = pcsRef.current.get(id);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.close();
      pcsRef.current.delete(id);
    }
    peerInfoRef.current.delete(id);
    makingOfferRef.current.delete(id);
    politeMapRef.current.delete(id);
    ignoreOfferRef.current.delete(id);
    speakingRef.current?.remove(id);
    setParticipants((ps) => ps.filter((p) => p.id !== id));
  }, []);

  // ---- 建立 / 取得一個 peer 連線 ----
  const makePeer = useCallback(
    async (
      peerId: string,
      peerName: string,
      peerUserId: string | null,
      initiator: boolean,
    ): Promise<RTCPeerConnection> => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;
      const socket = socketRef.current;
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      pcsRef.current.set(peerId, pc);
      peerInfoRef.current.set(peerId, { userId: peerUserId, name: peerName });
      politeMapRef.current.set(peerId, (socket?.id ?? "") < peerId);
      makingOfferRef.current.set(peerId, false);
      ignoreOfferRef.current.set(peerId, false);
      const ls = localStreamRef.current;
      if (ls) {
        for (const t of ls.getTracks()) pc.addTrack(t, ls);
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current?.emit("voice:signal", {
            to: peerId,
            data: { candidate: e.candidate },
          });
        }
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        const hasVideo = stream.getVideoTracks().length > 0;
        const info = peerInfoRef.current.get(peerId);
        speakingRef.current?.add(peerId, stream);
        setParticipants((ps) => [
          ...ps.filter((p) => p.id !== peerId),
          {
            id: peerId,
            userId: info?.userId ?? peerUserId,
            name: info?.name ?? peerName,
            stream,
            hasVideo,
          },
        ]);
        for (const track of stream.getVideoTracks()) {
          const refresh = () => {
            const stillHasVideo = stream
              .getVideoTracks()
              .some((t) => t.readyState === "live" && !t.muted);
            setParticipants((ps) =>
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
          makingOfferRef.current.set(peerId, true);
          await pc.setLocalDescription();
          socketRef.current?.emit("voice:signal", {
            to: peerId,
            data: { sdp: pc.localDescription },
          });
        } catch {
          /* ignore */
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      };
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected"
        ) {
          closePeer(peerId);
        }
      };
      if (initiator && localStreamRef.current) {
        try {
          makingOfferRef.current.set(peerId, true);
          await pc.setLocalDescription();
          socketRef.current?.emit("voice:signal", {
            to: peerId,
            data: { sdp: pc.localDescription },
          });
        } catch {
          /* ignore */
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      }
      return pc;
    },
    [closePeer],
  );

  // ---- 強制錄製：分段錄音器 ----
  const startSegment = useCallback(() => {
    const ls = localStreamRef.current;
    if (!ls || !voiceActiveRef.current) return;
    try {
      recChunksRef.current = [];
      const recorder = new MediaRecorder(ls);
      recorderRef.current = recorder;
      recStartRef.current = performance.now();
      const hasVideo = ls.getVideoTracks().length > 0;
      setRecording(true);
      setRecordingVideo(hasVideo);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const chunks = recChunksRef.current;
        recChunksRef.current = [];
        const durMs = Math.round(performance.now() - recStartRef.current);
        // 續錄：只要還在通話中就立即開下一段（以最新 localStream）
        if (voiceActiveRef.current) startSegmentRef.current();
        else {
          setRecording(false);
          setRecordingVideo(false);
        }
        if (chunks.length === 0) return;
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size === 0) return;
        const rid = roomIdRef.current;
        if (!rid) return;
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        fd.append("roomId", rid);
        fd.append("durationMs", String(durMs));
        try {
          await fetch("/api/recordings", { method: "POST", body: fd });
        } catch {
          /* 上傳失敗忽略，不阻斷通話 */
        }
      };
      recorder.start();
      recSegmentTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      }, REC_SEGMENT_MS);
    } catch {
      setError("此瀏覽器不支援錄製，無法符合錄音規範。");
      setRecording(false);
    }
  }, []);
  // 讓 onstop 內的續錄永遠呼叫到最新的 startSegment（startSegment 無依賴，恆穩定）。
  useEffect(() => {
    startSegmentRef.current = startSegment;
  }, [startSegment]);

  // 鏡頭開/關後 track 變動，需用新的 localStream 重新錄一段。
  const restartRecording = useCallback(() => {
    if (recSegmentTimerRef.current) {
      clearTimeout(recSegmentTimerRef.current);
      recSegmentTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      startSegment();
    }
  }, [startSegment]);

  // ---- 關閉鏡頭（也供 forceCameraOff 用）----
  const disableCamera = useCallback(() => {
    const ls = localStreamRef.current;
    if (!ls) {
      setCameraOn(false);
      return;
    }
    const videoTracks = ls.getVideoTracks();
    const hadVideo = videoTracks.length > 0;
    for (const pc of pcsRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track && sender.track.kind === "video") {
          pc.removeTrack(sender);
        }
      }
    }
    // 從 localStream 移除（送 peer / 錄製的）處理後 video track。
    for (const t of videoTracks) {
      t.stop();
      ls.removeTrack(t);
    }
    // 釋放虛擬背景管線（segment loop、canvas、隱藏 video）。
    videoHandleRef.current?.destroy();
    videoHandleRef.current = null;
    // 停止原始攝影機來源 track（虛擬背景管線的輸入）。
    rawCamTrackRef.current?.stop();
    rawCamTrackRef.current = null;
    setLocalStream(new MediaStream(ls.getTracks()));
    setCameraOn(false);
    if (hadVideo) restartRecording();
  }, [restartRecording]);

  // ---- 開啟鏡頭 ----
  const enableCamera = useCallback(async () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    if (ls.getVideoTracks().length > 0) {
      setCameraOn(true);
      return;
    }
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      // 取得相機期間可能已離開語音 → 釋放並中止。
      if (!voiceActiveRef.current || localStreamRef.current !== ls) {
        camStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const rawTrack = camStream.getVideoTracks()[0];
      if (!rawTrack) return;
      rawCamTrackRef.current = rawTrack;

      // 虛擬背景管線：原始 camera → 分割 → canvas 合成 → 處理後 track。
      // 這條「處理後 track」才是要送 peer 與被 MediaRecorder 錄製的那條。
      // 失敗時 handle.active=false 且 track 沿用原始 camera（優雅退回）。
      const handle = await createProcessedVideoTrack(
        rawTrack,
        virtualBgRef.current,
        {
          onFallback: (reason) => {
            // 退回原始攝影機畫面：記一行 notice（不阻斷通話）。
            console.warn("[virtualBg] " + reason);
            showNotice(reason);
          },
        },
      );
      // 模型載入（可能耗時）期間若已離開語音 / 串流被換掉 → 釋放並中止。
      if (!voiceActiveRef.current || localStreamRef.current !== ls) {
        handle.destroy();
        rawTrack.stop();
        rawCamTrackRef.current = null;
        return;
      }
      videoHandleRef.current = handle;
      const outboundTrack = handle.track;

      ls.addTrack(outboundTrack);
      setLocalStream(new MediaStream(ls.getTracks()));
      setCameraOn(true);
      // 送 peer 的是處理後 track。
      for (const pc of pcsRef.current.values()) pc.addTrack(outboundTrack, ls);
      // 以處理後 track 重啟錄製 → MediaRecorder 錄到套背景後畫面。
      restartRecording();
    } catch {
      setError("無法取得相機權限。");
    }
  }, [restartRecording, showNotice]);

  // ---- 完整關閉（離開語音）：釋放所有資源 ----
  const teardown = useCallback(() => {
    voiceActiveRef.current = false;
    const socket = socketRef.current;
    socket?.emit("voice:leave");
    for (const id of [...pcsRef.current.keys()]) closePeer(id);
    pcsRef.current.clear();
    peerInfoRef.current.clear();
    if (recSegmentTimerRef.current) {
      clearTimeout(recSegmentTimerRef.current);
      recSegmentTimerRef.current = null;
    }
    // 停止錄製：最後一段在 onstop 上傳（voiceActive 已 false，不再續錄）。
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    noiseHandleRef.current?.destroy();
    noiseHandleRef.current = null;
    // 虛擬背景管線：釋放 segment loop / canvas / 隱藏 video，並停掉原始攝影機來源。
    videoHandleRef.current?.destroy();
    videoHandleRef.current = null;
    rawCamTrackRef.current?.stop();
    rawCamTrackRef.current = null;
    rawMicTrackRef.current?.stop();
    rawMicTrackRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    speakingRef.current?.destroy();
    speakingRef.current = null;
    if (socket) {
      socket.off();
      socket.disconnect();
    }
    socketRef.current = null;
    roomIdRef.current = null;
    setSpeakingKeys(new Set());
    setLocalStream(null);
    setInVoice(false);
    setRecording(false);
    setRecordingVideo(false);
    setRnnoiseActive(false);
    setCameraOn(false);
    setMuted(false);
    setParticipants([]);
    setActiveRoomId(null);
    setActiveRoomName(null);
  }, [closePeer]);

  const leave = useCallback(() => {
    teardown();
  }, [teardown]);

  // ---- 加入語音 ----
  const join = useCallback(
    (roomId: string, roomName: string) => {
      // 單一通話限制：已在其他房語音中 → 拒絕。
      if (voiceActiveRef.current) {
        if (roomIdRef.current !== roomId) {
          setError("你正在其他房間語音中，請先離開後再加入。");
        }
        return;
      }
      voiceActiveRef.current = true;
      roomIdRef.current = roomId;
      setActiveRoomId(roomId);
      setActiveRoomName(roomName);
      setError(null);

      void (async () => {
        try {
          if (
            !window.isSecureContext ||
            !navigator.mediaDevices?.getUserMedia
          ) {
            setError(
              "需在 HTTPS（安全來源）下才能使用語音，請改用正式網域。",
            );
            voiceActiveRef.current = false;
            roomIdRef.current = null;
            setActiveRoomId(null);
            setActiveRoomName(null);
            return;
          }

          // 建立專屬 voice socket（以 ?roomId 帶房、cookie 驗身分）。
          const socket = io({
            path: "/socket.io",
            query: { roomId },
            transports: ["websocket", "polling"],
          });
          socketRef.current = socket;

          // ---- 信令：收到 SDP / ICE ----
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
              data: {
                sdp?: RTCSessionDescriptionInit;
                candidate?: RTCIceCandidateInit;
              };
            }) => {
              try {
                const pc =
                  pcsRef.current.get(from) ??
                  (await makePeer(from, fromName, fromUserId ?? null, false));
                if (data?.sdp) {
                  const polite = politeMapRef.current.get(from) ?? true;
                  const offerCollision =
                    data.sdp.type === "offer" &&
                    (makingOfferRef.current.get(from) ||
                      pc.signalingState !== "stable");
                  const ignore = !polite && offerCollision;
                  ignoreOfferRef.current.set(from, ignore);
                  if (ignore) return;
                  await pc.setRemoteDescription(data.sdp);
                  if (data.sdp.type === "offer") {
                    await pc.setLocalDescription();
                    socketRef.current?.emit("voice:signal", {
                      to: from,
                      data: { sdp: pc.localDescription },
                    });
                  }
                } else if (data?.candidate) {
                  try {
                    await pc.addIceCandidate(data.candidate);
                  } catch (err) {
                    if (!ignoreOfferRef.current.get(from)) throw err;
                  }
                }
              } catch {
                /* 忽略個別信令錯誤，不影響其他 peer */
              }
            },
          );

          // 新成員加入語音：既有成員主動建立連線並發 offer。
          socket.on(
            "voice:peer-joined",
            ({
              id,
              name,
              userId,
            }: {
              id: string;
              name: string;
              userId?: string | null;
            }) => {
              void makePeer(id, name, userId ?? null, true);
            },
          );

          socket.on("voice:peer-left", ({ id }: { id: string }) =>
            closePeer(id),
          );

          // 被管理員強制靜音：停用本地原始麥克風 track。
          socket.on("voice:force-mute", ({ by }: { by?: string }) => {
            if (rawMicTrackRef.current) rawMicTrackRef.current.enabled = false;
            setMuted(true);
            showNotice(`${by ? by : "管理員"}已將你靜音。`);
          });

          // 被管理員強制關鏡頭。
          socket.on("voice:force-camera-off", ({ by }: { by?: string }) => {
            disableCamera();
            showNotice(`${by ? by : "管理員"}已關閉你的鏡頭。`);
          });

          // 被踢出：離房並導回列表。
          socket.on("room:kicked", (e: { by?: string }) => {
            setError(
              `你已被${e?.by ? ` ${e.by} ` : "管理員"}移出此自習室。`,
            );
            teardown();
            setTimeout(() => {
              window.location.href = "/study-rooms";
            }, 1200);
          });

          // 取得 TURN ICE servers。
          const res = await fetch("/api/turn");
          const turnJson = (await res.json()) as {
            iceServers?: RTCIceServer[];
          };
          iceServersRef.current = turnJson.iceServers ?? [];

          // 取得麥克風（瀏覽器內建降噪約束）。
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              autoGainControl: true,
              noiseSuppression: true,
            },
            video: false,
          });
          micStreamRef.current = micStream;
          const rawMicTrack = micStream.getAudioTracks()[0] ?? null;
          rawMicTrackRef.current = rawMicTrack;

          // RNNoise：送出前處理。失敗優雅退回原始 track。
          let audioTrack = rawMicTrack;
          if (rawMicTrack) {
            const handle = await createNoiseSuppressedTrack(rawMicTrack);
            noiseHandleRef.current = handle;
            audioTrack = handle.track;
            setRnnoiseActive(handle.active);
          }

          const ls = new MediaStream();
          if (audioTrack) ls.addTrack(audioTrack);
          localStreamRef.current = ls;
          setLocalStream(new MediaStream(ls.getTracks()));
          setMuted(false);
          setCameraOn(false);

          // 說話偵測：本地用原始麥克風串流（降噪後 RMS 較弱，原始更靈敏）。
          const detector = new SpeakingDetector((set) => setSpeakingKeys(set));
          speakingRef.current = detector;
          detector.add("self", micStream);

          socket.emit(
            "voice:join",
            (ack: {
              ok: boolean;
              peers?: {
                id: string;
                name: string;
                userId?: string | null;
              }[];
              error?: string;
            }) => {
              if (!ack?.ok) {
                setError(ack?.error ?? "加入語音失敗。");
                teardown();
                return;
              }
              setInVoice(true);
              // 強制錄製：加入即自動開始。
              startSegment();
              for (const p of ack.peers ?? [])
                void makePeer(p.id, p.name, p.userId ?? null, true);
            },
          );
        } catch {
          setError("無法取得麥克風權限。");
          teardown();
        }
      })();
    },
    [closePeer, disableCamera, makePeer, showNotice, startSegment, teardown],
  );

  const toggleMute = useCallback(() => {
    const track = rawMicTrackRef.current;
    if (!track) return;
    const next = !track.enabled;
    track.enabled = next;
    setMuted(!next);
  }, []);

  const toggleCamera = useCallback(() => {
    const hasVideo =
      (localStreamRef.current?.getVideoTracks().length ?? 0) > 0;
    if (hasVideo) disableCamera();
    else void enableCamera();
  }, [disableCamera, enableCamera]);

  // 切換虛擬背景：更新狀態並（鏡頭開啟時）即時套用到處理管線。
  // 處理後 track 維持同一條 → 不需替換 sender / 重啟錄製，無縫生效。
  const setVirtualBg = useCallback((next: VirtualBgState) => {
    virtualBgRef.current = next;
    setVirtualBgState(next);
    videoHandleRef.current?.setBackground(next);
  }, []);

  const forceMute = useCallback((userId: string) => {
    socketRef.current?.emit(
      "voice:force-mute",
      { userId },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) setError(ack?.error ?? "操作失敗。");
      },
    );
  }, []);

  const forceCameraOff = useCallback((userId: string) => {
    socketRef.current?.emit(
      "voice:force-camera-off",
      { userId },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) setError(ack?.error ?? "操作失敗。");
      },
    );
  }, []);

  const kick = useCallback((userId: string) => {
    socketRef.current?.emit(
      "voice:kick",
      { userId },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) setError(ack?.error ?? "操作失敗。");
      },
    );
  }, []);

  // 卸載（理論上 Provider 掛在 layout 不會卸載。保險起見釋放資源）。
  useEffect(() => {
    return () => {
      if (voiceActiveRef.current) teardown();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: VoiceCallContextValue = {
    activeRoomId,
    activeRoomName,
    inVoice,
    participants,
    speakingKeys,
    muted,
    cameraOn,
    recording,
    recordingVideo,
    rnnoiseActive,
    error,
    notice,
    localStream,
    virtualBg,
    setVirtualBg,
    join,
    leave,
    toggleMute,
    toggleCamera,
    forceMute,
    forceCameraOff,
    kick,
    clearError,
  };

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
    </VoiceCallContext.Provider>
  );
}
