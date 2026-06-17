import { HP_PER_HEART } from "@/lib/pet";

export default function HeartBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const maxHearts = Math.max(1, Math.round(maxHp / HP_PER_HEART));
  const full = Math.floor(hp / HP_PER_HEART);

  return (
    <div className="flex items-center gap-1">
      <span className="flex">
        {Array.from({ length: maxHearts }).map((_, i) => (
          <span key={i} className="text-lg" aria-hidden>
            {i < full ? "❤️" : "🤍"}
          </span>
        ))}
      </span>
      <span className="text-label-md text-secondary">
        {hp} / {maxHp} HP
      </span>
    </div>
  );
}
