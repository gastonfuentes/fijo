import type { MvpFormLevel } from "@/types";

interface Props {
  level: MvpFormLevel | null;
  isLastMatchMvp: boolean;
  size?: "sm" | "md";
}

const LEVEL_CONFIG: Record<MvpFormLevel, { rotation: number; color: string; label: string }> = {
  excellent: { rotation: 0, color: "#2563eb", label: "excelente (top 1)" },
  good: { rotation: 45, color: "#16a34a", label: "bueno (top 2)" },
  normal: { rotation: 90, color: "#eab308", label: "normal (top 3)" },
  poor: { rotation: 135, color: "#f97316", label: "en baja" },
  bad: { rotation: 180, color: "#9ca3af", label: "sin votos" },
};

export default function MvpFormArrow({ level, isLastMatchMvp, size = "md" }: Props) {
  if (!level && !isLastMatchMvp) return null;

  const px = size === "sm" ? 14 : 18;
  const titleParts: string[] = [];
  if (level) titleParts.push(`Forma: ${LEVEL_CONFIG[level].label}`);
  if (isLastMatchMvp) titleParts.push("MVP del último partido");
  const title = titleParts.join(". ");

  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 align-middle"
    >
      {level && (
        <svg
          width={px}
          height={px}
          viewBox="0 0 24 24"
          fill="none"
          stroke={LEVEL_CONFIG[level].color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: `rotate(${LEVEL_CONFIG[level].rotation}deg)` }}
          aria-hidden="true"
        >
          <line x1="12" y1="20" x2="12" y2="4" />
          <polyline points="6 10 12 4 18 10" />
        </svg>
      )}
      {isLastMatchMvp && (
        <span style={{ fontSize: px - 1, lineHeight: 1 }} aria-hidden="true">
          👑
        </span>
      )}
    </span>
  );
}
