"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import type { MvpFormData, Player, SkillLevel } from "@/types";
import { computeMvpForm } from "@/lib/mvpForm";
import MvpFormArrow from "./MvpFormArrow";

interface Props {
  player: Player;
  effectiveLevel: SkillLevel;
  formData: MvpFormData;
  highlighted?: boolean;
  dimmed?: boolean;
  compact?: boolean;
}

const LEVEL_BADGE: Record<SkillLevel, { label: string; classes: string; title: string }> = {
  bueno: {
    label: "B",
    classes: "bg-amber-100 text-amber-800 border-amber-300",
    title: "Marcado como bueno para este partido",
  },
  tranqui: {
    label: "T",
    classes: "bg-fijo-100 text-fijo-700 border-fijo-300",
    title: "Nivel tranqui",
  },
  malo: {
    label: "M",
    classes: "bg-slate-100 text-slate-600 border-slate-300",
    title: "Nivel malo",
  },
};

export default function DraggablePlayerCard({
  player,
  effectiveLevel,
  formData,
  highlighted = false,
  dimmed = false,
  compact = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
    data: { effectiveLevel },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : dimmed ? 0.5 : 1,
    touchAction: "none",
  };

  const badge = LEVEL_BADGE[effectiveLevel];

  const baseClasses = compact
    ? "rounded-md border px-2 py-1.5 text-xs"
    : "rounded-lg border px-3 py-2 text-sm";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${baseClasses} flex cursor-grab items-center gap-2 bg-white font-bold text-fijo-900 shadow-[0_8px_18px_-16px_rgba(27,64,41,0.6)] transition active:cursor-grabbing ${
        highlighted
          ? "border-fijo-600 ring-2 ring-fijo-500/50"
          : "border-fijo-100 hover:border-fijo-300"
      } ${isDragging ? "z-50" : ""}`}
    >
      <span
        title={badge.title}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${badge.classes}`}
      >
        {badge.label}
      </span>
      <MvpFormArrow {...computeMvpForm(player.id, formData)} size="sm" />
      <span className="min-w-0 flex-1 truncate">{player.name}</span>
    </div>
  );
}
