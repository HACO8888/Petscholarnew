/**
 * 自習室視訊的影像處理 helper：虛擬背景（人像分割 + 背景合成）。
 *
 * 流程：原始 camera track → MediaPipe Selfie Segmentation（ImageSegmenter，confidence mask）
 *       → 在 <canvas> 合成（人像保留、背景模糊或替換成圖片）→ canvas.captureStream()
 *       取得「處理後 video track」。這條處理後的 track 就是送給 peers 並被 MediaRecorder 錄製的 track。
 *
 * 設計重點：
 *  - 與 audioProcessing.ts 並列：對外回傳一個可清理的 handle（track + destroy）。
 *  - 模型 / wasm 皆自 public/mediapipe/ 自架載入（離線可用、不依賴外部 CDN）。
 *  - 任一步驟（模型 / wasm 載入、segmenter 建立、track 取得）失敗 → 優雅退回原始 camera track，
 *    並透過 onFallback 回報一行訊息，呼叫端可記 console / notice。
 *  - 以 requestVideoFrameCallback（無則退回 rAF）節流，於合理解析度（最長邊 640）處理避免卡頓。
 *
 * 皆為純前端、僅在瀏覽器執行（呼叫端確保在 client component / 事件中使用）。
 */

import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

/** 虛擬背景模式：無（原始攝影機）/ 背景模糊 / 背景圖片。 */
export type VirtualBgMode = "none" | "blur" | "image";

/** 預設背景圖片（放在 public/backgrounds/）。 */
export interface BackgroundImageOption {
  id: string;
  label: string;
  src: string;
}

export const BACKGROUND_IMAGES: readonly BackgroundImageOption[] = [
  { id: "library", label: "圖書館", src: "/backgrounds/library.svg" },
  { id: "study", label: "書房", src: "/backgrounds/study.svg" },
  { id: "gradient", label: "漸層", src: "/backgrounds/gradient.svg" },
];

/** 虛擬背景設定：模式 + 選定的背景圖片 id（image 模式時用）。 */
export interface VirtualBgState {
  mode: VirtualBgMode;
  /** image 模式所選圖片 id；對應 BACKGROUND_IMAGES。 */
  imageId: string;
}

export const DEFAULT_VIRTUAL_BG: VirtualBgState = {
  mode: "none",
  imageId: BACKGROUND_IMAGES[0]?.id ?? "library",
};

// 自架資源路徑（vendored 自 @mediapipe/tasks-vision 與官方模型）。
const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/selfie_segmenter.tflite";

// 處理解析度上限（最長邊）：兼顧畫質與效能。
const MAX_PROCESS_EDGE = 640;
// 背景模糊強度（canvas filter，單位 px）。
const BLUR_PX = 12;
// 合成幀率上限（毫秒）；segmentForVideo 需要嚴格遞增的 timestamp。
const MIN_FRAME_INTERVAL_MS = 1000 / 30;

let segmenterPromise: Promise<ImageSegmenter | null> | null = null;

/** 載入並快取一個 VIDEO 模式、輸出 confidence mask 的 ImageSegmenter（失敗回 null）。 */
async function getSegmenter(): Promise<ImageSegmenter | null> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        return await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
      } catch {
        return null;
      }
    })();
  }
  return segmenterPromise;
}

/** 已處理視訊 track 的可清理控制代碼。 */
export interface ProcessedVideoHandle {
  /** 合成後（套用背景）的 video track，應拿這條去送給 peer / 錄製 / 預覽。 */
  track: MediaStreamTrack;
  /** 是否真的套用了虛擬背景（false = 退回原始 camera track）。 */
  active: boolean;
  /**
   * 不重開鏡頭即時切換背景模式 / 圖片。
   * 對退回原始 track 的情形為 no-op。
   */
  setBackground: (state: VirtualBgState) => void;
  /** 釋放 segmenter loop、canvas、隱藏 video 等資源（不會停掉來源 camera track）。 */
  destroy: () => void;
}

interface ProcessOptions {
  /** 失敗退回原始 track 時的一行說明（呼叫端記 console / notice）。 */
  onFallback?: (reason: string) => void;
}

type VideoFrameCallbackId = number;

/**
 * 對一條原始 camera video track 套用虛擬背景，回傳處理後的 video track。
 * 失敗時 active:false 並沿用原始 track（呼叫端無需特別處理）。
 *
 * @param inputTrack 原始 getUserMedia 視訊 track
 * @param initial    初始背景設定（預設「無」＝原始攝影機畫面，但仍走 canvas 管線以便即時切換）
 */
export async function createProcessedVideoTrack(
  inputTrack: MediaStreamTrack,
  initial: VirtualBgState = DEFAULT_VIRTUAL_BG,
  options: ProcessOptions = {},
): Promise<ProcessedVideoHandle> {
  const fallback = (reason: string): ProcessedVideoHandle => {
    options.onFallback?.(reason);
    return {
      track: inputTrack,
      active: false,
      setBackground: () => {},
      destroy: () => {},
    };
  };

  if (typeof document === "undefined") return fallback("非瀏覽器環境");

  const segmenter = await getSegmenter();
  if (!segmenter) {
    return fallback("MediaPipe 模型 / wasm 載入失敗，已退回原始攝影機畫面。");
  }

  // 隱藏 <video> 餵原始 camera track 給 segmenter。
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([inputTrack]);
  try {
    await video.play();
  } catch {
    return fallback("無法播放攝影機影像，已退回原始攝影機畫面。");
  }

  const settings = inputTrack.getSettings();
  const srcW = settings.width ?? video.videoWidth ?? 640;
  const srcH = settings.height ?? video.videoHeight ?? 480;
  if (!srcW || !srcH) {
    return fallback("無法取得攝影機解析度，已退回原始攝影機畫面。");
  }
  // 等比縮到最長邊 MAX_PROCESS_EDGE。
  const scale = Math.min(1, MAX_PROCESS_EDGE / Math.max(srcW, srcH));
  const outW = Math.max(2, Math.round(srcW * scale));
  const outH = Math.max(2, Math.round(srcH * scale));

  // 輸出 canvas（captureStream 來源）。
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d", { willReadFrequently: true });
  if (!outCtx) {
    return fallback("無法建立 canvas 2D context，已退回原始攝影機畫面。");
  }

  // 暫存 canvas：人像合成用（先畫 video，再依 mask 套 alpha）。
  const personCanvas = document.createElement("canvas");
  personCanvas.width = outW;
  personCanvas.height = outH;
  const personCtx = personCanvas.getContext("2d", { willReadFrequently: true });
  // 背景圖片快取 canvas（image 模式）。
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = outW;
  bgCanvas.height = outH;
  const bgCtx = bgCanvas.getContext("2d");
  if (!personCtx || !bgCtx) {
    return fallback("無法建立合成 canvas，已退回原始攝影機畫面。");
  }

  // ---- 可變背景狀態 ----
  let state: VirtualBgState = { ...initial };
  // 背景圖片載入快取：id → HTMLImageElement（loaded）。
  const imageCache = new Map<string, HTMLImageElement>();
  let currentBgImage: HTMLImageElement | null = null;
  let currentBgImageId: string | null = null;

  function loadBgImage(id: string) {
    if (currentBgImageId === id && currentBgImage) return;
    currentBgImageId = id;
    const cached = imageCache.get(id);
    if (cached) {
      currentBgImage = cached;
      return;
    }
    const opt = BACKGROUND_IMAGES.find((b) => b.id === id);
    if (!opt) {
      currentBgImage = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(id, img);
      // 只有當使用者仍選此圖時才掛上去。
      if (currentBgImageId === id) currentBgImage = img;
    };
    img.onerror = () => {
      if (currentBgImageId === id) currentBgImage = null;
    };
    img.src = opt.src;
  }
  if (state.mode === "image") loadBgImage(state.imageId);

  // segmentForVideo 需要嚴格遞增的 timestamp。
  let lastTimestamp = -1;
  let lastFrameAt = 0;
  let stopped = false;
  let rvfcHandle: VideoFrameCallbackId | null = null;
  let rafHandle: number | null = null;

  /** 把目前 video 畫面 + 分割 mask 合成到 outCanvas。 */
  function renderFrame(nowMs: number) {
    if (stopped || !outCtx || !personCtx || !bgCtx) return;
    if (video.readyState < 2) return; // 尚無可用畫面

    // 「無」模式：直接畫原始畫面，不做分割（省效能，仍走 canvas 以便切換）。
    if (state.mode === "none") {
      outCtx.filter = "none";
      outCtx.drawImage(video, 0, 0, outW, outH);
      return;
    }

    // segmentForVideo 的 timestamp 必須嚴格遞增。
    let ts = Math.round(nowMs);
    if (ts <= lastTimestamp) ts = lastTimestamp + 1;
    lastTimestamp = ts;

    let result: ImageSegmenterResult | null = null;
    try {
      // 同步呼叫版：直接回傳結果（mask 僅在此次有效，須立即讀取後 close）。
      result = segmenter!.segmentForVideo(video, ts) as ImageSegmenterResult;
    } catch {
      // 單幀分割失敗：退而畫原始畫面，不中斷。
      outCtx.filter = "none";
      outCtx.drawImage(video, 0, 0, outW, outH);
      return;
    }

    const mask = result?.confidenceMasks?.[0];
    if (!mask) {
      outCtx.filter = "none";
      outCtx.drawImage(video, 0, 0, outW, outH);
      result?.close?.();
      return;
    }

    const maskW = mask.width;
    const maskH = mask.height;
    const conf = mask.getAsFloat32Array(); // 0..1，越接近 1 越是人像
    result?.close?.();

    // 1) 背景層：模糊原畫面 或 背景圖片。
    outCtx.filter = "none";
    if (state.mode === "blur") {
      outCtx.filter = `blur(${BLUR_PX}px)`;
      outCtx.drawImage(video, 0, 0, outW, outH);
      outCtx.filter = "none";
    } else {
      // image 模式：有圖畫圖（cover），沒圖則退回模糊以免露出黑底。
      if (currentBgImage) {
        drawCover(outCtx, currentBgImage, outW, outH);
      } else {
        outCtx.filter = `blur(${BLUR_PX}px)`;
        outCtx.drawImage(video, 0, 0, outW, outH);
        outCtx.filter = "none";
      }
    }

    // 2) 人像層：先把原畫面畫到 personCanvas，再用 mask 當 alpha 去背。
    personCtx.filter = "none";
    personCtx.globalCompositeOperation = "source-over";
    personCtx.clearRect(0, 0, outW, outH);
    personCtx.drawImage(video, 0, 0, outW, outH);
    const personData = personCtx.getImageData(0, 0, outW, outH);
    const px = personData.data;
    // mask 解析度可能與 outCanvas 不同 → 以最近鄰對應取樣。
    const sameSize = maskW === outW && maskH === outH;
    for (let y = 0; y < outH; y++) {
      const my = sameSize ? y : Math.min(maskH - 1, (y * maskH / outH) | 0);
      const mrow = my * maskW;
      const prow = y * outW * 4;
      for (let x = 0; x < outW; x++) {
        const mx = sameSize ? x : Math.min(maskW - 1, (x * maskW / outW) | 0);
        const c = conf[mrow + mx]; // 人像信心 0..1
        // 軟化邊緣：以信心當 alpha（乘 255）。
        px[prow + x * 4 + 3] = (c * 255) | 0;
      }
    }
    personCtx.putImageData(personData, 0, 0);

    // 3) 把去背人像疊到背景上。
    outCtx.filter = "none";
    outCtx.globalCompositeOperation = "source-over";
    outCtx.drawImage(personCanvas, 0, 0, outW, outH);
  }

  function loop(nowMs: number) {
    if (stopped) return;
    // 幀率節流。
    if (nowMs - lastFrameAt >= MIN_FRAME_INTERVAL_MS) {
      lastFrameAt = nowMs;
      try {
        renderFrame(nowMs);
      } catch {
        /* 單幀錯誤忽略 */
      }
    }
    schedule();
  }

  function schedule() {
    if (stopped) return;
    if (typeof video.requestVideoFrameCallback === "function") {
      rvfcHandle = video.requestVideoFrameCallback((now) => loop(now));
    } else {
      rafHandle = requestAnimationFrame((now) => loop(now));
    }
  }

  // 先畫一幀避免 captureStream 取到空白，再啟動迴圈。
  renderFrame(performance.now());
  schedule();

  // captureStream 取得處理後 video track（30fps）。
  const captured = (
    outCanvas as HTMLCanvasElement & {
      captureStream: (fps?: number) => MediaStream;
    }
  ).captureStream(30);
  const processedTrack = captured.getVideoTracks()[0];
  if (!processedTrack) {
    stopped = true;
    return fallback("無法從 canvas 取得處理後視訊，已退回原始攝影機畫面。");
  }

  return {
    track: processedTrack,
    active: true,
    setBackground: (next: VirtualBgState) => {
      state = { ...next };
      if (state.mode === "image") loadBgImage(state.imageId);
    },
    destroy: () => {
      stopped = true;
      if (rvfcHandle != null && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(rvfcHandle);
      }
      if (rafHandle != null) cancelAnimationFrame(rafHandle);
      try {
        processedTrack.stop();
      } catch {
        /* ignore */
      }
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        /* ignore */
      }
    },
  };
}

/** 以 cover 方式把圖片填滿目標尺寸（等比裁切置中）。 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth || w;
  const ih = img.naturalHeight || h;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}
