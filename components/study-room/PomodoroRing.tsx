"use client";

/**
 * 番茄鐘「專注光環」：圓形 SVG 進度環包住時間數字。
 * - progress 0→1 隨 25 分鐘進度填滿（純展示，計時邏輯仍在父元件）。
 * - running 時整個環進入「專注」狀態（暖色發光 + 柔和脈動，尊重 reduced-motion）。
 * - 純展示元件，不持有任何狀態。
 */
export default function PomodoroRing({
  mins,
  secs,
  progress,
  running,
  size = 256,
  stroke = 14,
  compact = false,
}: {
  mins: string;
  secs: string;
  /** 0（剛開始）→ 1（已完成），用於填滿進度環 */
  progress: number;
  running: boolean;
  size?: number;
  stroke?: number;
  /** 精簡模式：縮小字級、去掉脈動發光底，供視訊舞台頂部計時 pill 使用。 */
  compact?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const dashOffset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      {/* 運作中的暖色發光底（柔和脈動，reduced-motion 下不動）。精簡模式不顯示 */}
      {running && !compact && (
        <div
          aria-hidden
          className="focus-pulse absolute inset-2 rounded-full bg-tertiary/30 blur-2xl"
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative -rotate-90"
        aria-hidden
      >
        {/* 軌道 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-outline-variant/30"
        />
        {/* 進度（運作中走暖色 tertiary，閒置走沉穩 primary） */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-[stroke-dashoffset,color] duration-1000 ease-linear motion-reduce:transition-none ${
            running ? "text-tertiary" : "text-primary"
          }`}
        />
      </svg>

      {/* 中央時間數字 */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div
            className={`font-bold leading-none tabular-nums tracking-tight text-on-background ${
              compact ? "text-[22px]" : "text-[56px] sm:text-[64px]"
            }`}
          >
            {mins}
            <span className="text-tertiary">:</span>
            {secs}
          </div>
          {!compact && (
            <div
              className={`mt-2 text-label-md font-bold uppercase tracking-[0.18em] ${
                running ? "text-tertiary" : "text-secondary"
              }`}
            >
              {running ? "專注中" : "已就緒"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
