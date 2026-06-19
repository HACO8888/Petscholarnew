/**
 * 自習室語音的音訊處理 helper：
 *  1. RNNoise（AI / WASM）降噪：用 AudioWorklet 在「送出麥克風前」處理音訊。
 *     - worklet 與 wasm 從 public/rnnoise/ 載入（建置時由 @sapphi-red/web-noise-suppressor 複製）。
 *     - 任一步驟失敗都會優雅退回「未處理的原始麥克風 track」（仍有瀏覽器內建降噪）。
 *  2. SpeakingDetector：用 AnalyserNode 對任意 MediaStream 偵測音量，
 *     以節流的 rAF 迴圈回報「誰正在說話」，供 Discord 風綠色光環使用。
 *
 * 皆為純前端、僅在瀏覽器執行（呼叫端確保在 client component / 事件中使用）。
 */

// 注意：@sapphi-red/web-noise-suppressor 在模組頂層用 `class extends AudioWorkletNode`
// 定義 WorkletNode，靜態 import 會讓 Next.js 在 SSR（伺服器端 evaluate 此模組）時
// reference 不存在的 AudioWorkletNode 而拋 ReferenceError。改為在瀏覽器執行的函式內
// 動態 import（且在 AudioWorkletNode guard 之後），確保只在 client 載入。

// public/ 下的靜態資源路徑（worklet 與兩種 wasm）。
const RNNOISE_WORKLET_URL = "/rnnoise/workletProcessor.js";
const RNNOISE_WASM_URL = "/rnnoise/rnnoise.wasm";
const RNNOISE_WASM_SIMD_URL = "/rnnoise/rnnoise_simd.wasm";

/** 一條 RNNoise 處理鏈的可清理控制代碼。 */
export interface NoiseSuppressionHandle {
  /** 處理後（已降噪）的音訊 track，應拿這條去送給 peer / 錄音。 */
  track: MediaStreamTrack;
  /** 是否真的套用了 RNNoise（false 表示退回原始 track）。 */
  active: boolean;
  /** 釋放 AudioContext / WorkletNode 等資源。 */
  destroy: () => void;
}

// 共用一個 48kHz AudioContext（RNNoise 假設取樣率為 48kHz）。
let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  sharedCtx = new Ctor({ sampleRate: 48000 });
  return sharedCtx;
}

// 同一個 AudioContext 只需 addModule 一次。
let workletAdded = false;
// wasm binary 只需抓一次，之後重用。
let rnnoiseBinary: ArrayBuffer | null = null;

/**
 * 對一條原始麥克風 track 套用 RNNoise 降噪。
 * 失敗時回傳 active:false 並沿用原始 track（呼叫端無需特別處理）。
 */
export async function createNoiseSuppressedTrack(
  inputTrack: MediaStreamTrack,
): Promise<NoiseSuppressionHandle> {
  // 退路：直接用原始 track（仍保有 getUserMedia 的瀏覽器內建降噪）。
  const fallback = (): NoiseSuppressionHandle => ({
    track: inputTrack,
    active: false,
    destroy: () => {},
  });

  try {
    if (typeof AudioWorkletNode === "undefined") return fallback();
    // 動態載入：此時必為瀏覽器環境，套件頂層的 `extends AudioWorkletNode` 才安全。
    const { loadRnnoise, RnnoiseWorkletNode } = await import(
      "@sapphi-red/web-noise-suppressor"
    );
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }

    if (!workletAdded) {
      await ctx.audioWorklet.addModule(RNNOISE_WORKLET_URL);
      workletAdded = true;
    }
    if (!rnnoiseBinary) {
      rnnoiseBinary = await loadRnnoise({
        url: RNNOISE_WASM_URL,
        simdUrl: RNNOISE_WASM_SIMD_URL,
      });
    }

    const source = ctx.createMediaStreamSource(new MediaStream([inputTrack]));
    const rnnoise = new RnnoiseWorkletNode(ctx, {
      maxChannels: 1,
      wasmBinary: rnnoiseBinary,
    });
    const dest = ctx.createMediaStreamDestination();
    source.connect(rnnoise).connect(dest);

    const processed = dest.stream.getAudioTracks()[0];
    if (!processed) {
      rnnoise.destroy();
      return fallback();
    }

    return {
      track: processed,
      active: true,
      destroy: () => {
        try {
          source.disconnect();
          rnnoise.disconnect();
          rnnoise.destroy();
          processed.stop();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    // worklet/wasm 載入失敗、瀏覽器不支援等：優雅退回原始 track。
    return fallback();
  }
}

/**
 * 多串流音量偵測器：對每個註冊的串流建立 AnalyserNode，
 * 以節流的 rAF 迴圈計算 RMS 音量，超過門檻即視為「說話中」。
 * 透過 onChange 回報「目前說話者的 key 集合」（只有變動時才回呼）。
 */
export class SpeakingDetector {
  private ctx: AudioContext;
  private entries = new Map<
    string,
    {
      analyser: AnalyserNode;
      source: MediaStreamAudioSourceNode;
      buf: Float32Array<ArrayBuffer>;
    }
  >();
  private speaking = new Set<string>();
  private raf: number | null = null;
  private lastTick = 0;
  private onChange: (speaking: Set<string>) => void;
  // RMS 門檻與更新節流（毫秒）。
  private readonly threshold = 0.012;
  private readonly intervalMs = 120;

  constructor(onChange: (speaking: Set<string>) => void) {
    const Ctor: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctor();
    this.onChange = onChange;
  }

  /** 註冊一條串流以偵測其音量（key 例如 "self" 或 peer socket id）。 */
  add(key: string, stream: MediaStream) {
    if (this.entries.has(key)) return;
    const audio = stream.getAudioTracks();
    if (audio.length === 0) return;
    try {
      const source = this.ctx.createMediaStreamSource(stream);
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      this.entries.set(key, {
        analyser,
        source,
        buf: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)),
      });
      this.start();
    } catch {
      /* 某些串流可能無法建立 source。略過該 key */
    }
  }

  remove(key: string) {
    const e = this.entries.get(key);
    if (e) {
      try {
        e.source.disconnect();
        e.analyser.disconnect();
      } catch {
        /* ignore */
      }
      this.entries.delete(key);
    }
    if (this.speaking.delete(key)) this.emit();
    if (this.entries.size === 0) this.stop();
  }

  private start() {
    if (this.raf != null) return;
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      if (t - this.lastTick < this.intervalMs) return;
      this.lastTick = t;
      let changed = false;
      for (const [key, e] of this.entries) {
        e.analyser.getFloatTimeDomainData(e.buf);
        let sum = 0;
        for (let i = 0; i < e.buf.length; i++) sum += e.buf[i] * e.buf[i];
        const rms = Math.sqrt(sum / e.buf.length);
        const isSpeaking = rms > this.threshold;
        if (isSpeaking && !this.speaking.has(key)) {
          this.speaking.add(key);
          changed = true;
        } else if (!isSpeaking && this.speaking.has(key)) {
          this.speaking.delete(key);
          changed = true;
        }
      }
      if (changed) this.emit();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() {
    if (this.raf != null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  private emit() {
    this.onChange(new Set(this.speaking));
  }

  destroy() {
    this.stop();
    for (const key of [...this.entries.keys()]) this.remove(key);
    try {
      void this.ctx.close();
    } catch {
      /* ignore */
    }
  }
}
