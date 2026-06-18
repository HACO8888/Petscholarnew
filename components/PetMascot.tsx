const STYLE_EMOJI: Record<string, string> = {
  classic: "🤖",
  cat: "🐱",
  dog: "🐶",
  rabbit: "🐰",
  dragon: "🐉",
};

export default function PetMascot({
  petStyle,
  face,
  equippedHat,
  equippedBackground,
  equippedRareStyle,
  large = false,
}: {
  petStyle: string | null;
  face: string;
  equippedHat: boolean;
  equippedBackground: boolean;
  equippedRareStyle: boolean;
  /** 大尺寸（寵物餵食頁主視覺用） */
  large?: boolean;
}) {
  const base = STYLE_EMOJI[petStyle ?? "classic"] ?? STYLE_EMOJI.classic;

  return (
    <div
      className={`relative flex items-center justify-center rounded-full transition-all ${
        large ? "h-56 w-56 sm:h-64 sm:w-64" : "h-40 w-40"
      } ${
        equippedBackground
          ? "bg-gradient-to-br from-primary-container to-tertiary-container shadow-[0_0_40px_-4px_var(--color-primary)]"
          : "bg-surface-container-high"
      } ${equippedRareStyle ? "ring-4 ring-tertiary" : "ring-1 ring-outline-variant/40"}`}
    >
      {equippedHat && (
        <span
          className={`absolute ${large ? "-top-5 text-6xl" : "-top-3 text-3xl"}`}
          aria-hidden
        >
          🎓
        </span>
      )}
      <span
        className={`leading-none ${large ? "text-[120px]" : "text-7xl"}`}
        aria-hidden
      >
        {base}
      </span>
      <span
        className={`absolute -bottom-1 right-2 ${large ? "text-4xl" : "text-2xl"}`}
        aria-hidden
      >
        {face}
      </span>
    </div>
  );
}
