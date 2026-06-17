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
}: {
  petStyle: string | null;
  face: string;
  equippedHat: boolean;
  equippedBackground: boolean;
  equippedRareStyle: boolean;
}) {
  const base = STYLE_EMOJI[petStyle ?? "classic"] ?? STYLE_EMOJI.classic;

  return (
    <div
      className={`relative flex h-40 w-40 items-center justify-center rounded-full transition-all ${
        equippedBackground
          ? "bg-gradient-to-br from-primary-container to-tertiary-container shadow-[0_0_40px_-4px_var(--color-primary)]"
          : "bg-surface-container-high"
      } ${equippedRareStyle ? "ring-4 ring-tertiary" : "ring-1 ring-outline-variant/40"}`}
    >
      {equippedHat && (
        <span className="absolute -top-3 text-3xl" aria-hidden>
          🎓
        </span>
      )}
      <span className="text-7xl leading-none" aria-hidden>
        {base}
      </span>
      <span className="absolute -bottom-1 right-2 text-2xl" aria-hidden>
        {face}
      </span>
    </div>
  );
}
