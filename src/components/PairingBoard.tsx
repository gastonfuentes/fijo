"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { MvpFormData, Player, SkillLevel } from "@/types";
import DraggablePlayerCard from "./DraggablePlayerCard";

interface Pair {
  id: string;
  left: string | null;
  right: string | null;
}

interface Props {
  presentPlayers: Player[];
  bestPlayerIds: Set<string>;
  formData: MvpFormData;
  pairs: Array<[string, string]>;
  onPairsChange: (pairs: Array<[string, string]>) => void;
  onExit: () => void;
  onSorteo: () => void;
  canSorteo: boolean;
}

function generatePairId(): string {
  return `pair-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function effectiveLevelOf(player: Player, bestPlayerIds: Set<string>): SkillLevel {
  return bestPlayerIds.has(player.id) ? "bueno" : player.level;
}

export default function PairingBoard({
  presentPlayers,
  bestPlayerIds,
  formData,
  pairs: confirmedPairs,
  onPairsChange,
  onExit,
  onSorteo,
  canSorteo,
}: Props) {
  // Estado interno: pares con slots potencialmente null. Se sincroniza con
  // confirmedPairs (que solo contiene pares completos) cuando cambia algo.
  const [internalPairs, setInternalPairs] = useState<Pair[]>(() =>
    confirmedPairs.map(([left, right]) => ({
      id: generatePairId(),
      left,
      right,
    }))
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of presentPlayers) map.set(p.id, p);
    return map;
  }, [presentPlayers]);

  // Filtrar internalPairs para descartar IDs que ya no están presentes.
  const safePairs = useMemo(
    () =>
      internalPairs
        .map((p) => ({
          id: p.id,
          left: p.left && playersById.has(p.left) ? p.left : null,
          right: p.right && playersById.has(p.right) ? p.right : null,
        }))
        .filter((p) => p.left !== null || p.right !== null),
    [internalPairs, playersById]
  );

  const pairedIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of safePairs) {
      if (p.left) set.add(p.left);
      if (p.right) set.add(p.right);
    }
    return set;
  }, [safePairs]);

  const unpairedPlayers = useMemo(
    () => presentPlayers.filter((p) => !pairedIds.has(p.id)),
    [presentPlayers, pairedIds]
  );

  const completedCount = safePairs.filter((p) => p.left && p.right).length;
  const incompleteCount = safePairs.length - completedCount;

  // Sincronizar pares confirmados con el padre cada vez que cambien.
  const syncCompleted = (next: Pair[]) => {
    setInternalPairs(next);
    const completed = next
      .filter((p) => p.left && p.right)
      .map((p) => [p.left!, p.right!] as [string, string]);
    onPairsChange(completed);
  };

  const activePlayer = activeDragId ? playersById.get(activeDragId) ?? null : null;
  const activeLevel = activePlayer
    ? effectiveLevelOf(activePlayer, bestPlayerIds)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const playerId = String(active.id);
    const dropId = String(over.id);

    let next = internalPairs.map((p) => ({ ...p }));

    // 1. Sacar al jugador de cualquier par previo
    for (const pair of next) {
      if (pair.left === playerId) pair.left = null;
      if (pair.right === playerId) pair.right = null;
    }
    next = next.filter((p) => p.left !== null || p.right !== null);

    if (dropId === "central") {
      syncCompleted(next);
      return;
    }

    if (dropId.startsWith("pair-")) {
      // Formato: "pair-{pairId|new}-{left|right}"
      const lastDash = dropId.lastIndexOf("-");
      const sideKey = dropId.slice(lastDash + 1) as "left" | "right";
      const pairKey = dropId.slice("pair-".length, lastDash);

      if (pairKey === "new") {
        next.push({
          id: generatePairId(),
          left: sideKey === "left" ? playerId : null,
          right: sideKey === "right" ? playerId : null,
        });
      } else {
        const target = next.find((p) => p.id === pairKey);
        if (target) {
          if (sideKey === "left") target.left = playerId;
          else target.right = playerId;
        } else {
          next.push({
            id: generatePairId(),
            left: sideKey === "left" ? playerId : null,
            right: sideKey === "right" ? playerId : null,
          });
        }
      }
      syncCompleted(next);
      return;
    }

    syncCompleted(next);
  };

  const handleDeletePair = (pairId: string) => {
    const next = internalPairs.filter((p) => p.id !== pairId);
    syncCompleted(next);
  };

  const handleClearAll = () => {
    syncCompleted([]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <section className="surface mb-6 p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--muted)]">
              modo enfrentamientos
            </p>
            <h2 className="text-2xl font-black text-fijo-900">
              Armá los duelos del partido
            </h2>
            <p className="muted-copy mt-1 text-sm">
              Arrastrá jugadores desde la columna del medio hacia los lados. Los
              que quedan enfrentados nunca caen en el mismo equipo: el sorteo
              decide al azar cuál de los dos lados termina siendo el Equipo A.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button onClick={handleClearAll} className="btn-ghost">
              Vaciar pares
            </button>
            <button onClick={onExit} className="btn-secondary min-h-10 px-3 py-2">
              Volver al modo simple
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-bold text-[var(--muted)]">
          <span>{completedCount} pares listos</span>
          {incompleteCount > 0 && (
            <span className="text-amber-700">
              · {incompleteCount} {incompleteCount === 1 ? "incompleto" : "incompletos"}
            </span>
          )}
          <span>· {unpairedPlayers.length} sueltos</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SidePanel
            side="left"
            label="Lado A"
            pairs={safePairs}
            playersById={playersById}
            bestPlayerIds={bestPlayerIds}
            formData={formData}
            activeLevel={activeLevel}
          />
          <CentralZone
            unpaired={unpairedPlayers}
            bestPlayerIds={bestPlayerIds}
            formData={formData}
            activeLevel={activeLevel}
          />
          <SidePanel
            side="right"
            label="Lado B"
            pairs={safePairs}
            playersById={playersById}
            bestPlayerIds={bestPlayerIds}
            formData={formData}
            activeLevel={activeLevel}
            onDeletePair={handleDeletePair}
          />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onSorteo}
            disabled={!canSorteo}
            className="btn-primary flex-1 text-lg"
          >
            Sortear con estos enfrentamientos
          </button>
        </div>
      </section>

      <DragOverlay>
        {activePlayer ? (
          <DraggablePlayerCard
            player={activePlayer}
            effectiveLevel={effectiveLevelOf(activePlayer, bestPlayerIds)}
            formData={formData}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface SidePanelProps {
  side: "left" | "right";
  label: string;
  pairs: Pair[];
  playersById: Map<string, Player>;
  bestPlayerIds: Set<string>;
  formData: MvpFormData;
  activeLevel: SkillLevel | null;
  onDeletePair?: (pairId: string) => void;
}

function SidePanel({
  side,
  label,
  pairs,
  playersById,
  bestPlayerIds,
  formData,
  activeLevel,
  onDeletePair,
}: SidePanelProps) {
  const filledCount = pairs.filter((p) =>
    side === "left" ? p.left !== null : p.right !== null
  ).length;

  return (
    <div className="rounded-lg border-2 border-dashed border-fijo-100 bg-white/40 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
        {label} ({filledCount})
      </p>
      <div className="space-y-2">
        {pairs.map((pair, idx) => {
          const playerId = side === "left" ? pair.left : pair.right;
          return (
            <div key={pair.id} className="flex items-center gap-2">
              <PairBadge index={idx + 1} />
              <Slot
                pairId={pair.id}
                side={side}
                playerId={playerId}
                playersById={playersById}
                bestPlayerIds={bestPlayerIds}
                formData={formData}
                activeLevel={activeLevel}
                isPlaceholder={false}
              />
              {side === "right" &&
                onDeletePair &&
                (pair.left !== null || pair.right !== null) && (
                  <button
                    onClick={() => onDeletePair(pair.id)}
                    aria-label="Eliminar par"
                    title="Eliminar par"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-fijo-200 bg-white text-sm font-black text-[var(--muted)] hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
            </div>
          );
        })}

        <div className="flex items-center gap-2">
          <PairBadge index={pairs.length + 1} placeholder />
          <Slot
            pairId="new"
            side={side}
            playerId={null}
            playersById={playersById}
            bestPlayerIds={bestPlayerIds}
            formData={formData}
            activeLevel={activeLevel}
            isPlaceholder
          />
          {side === "right" && onDeletePair && (
            <span className="h-8 w-8 shrink-0" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}

function PairBadge({
  index,
  placeholder = false,
}: {
  index: number;
  placeholder?: boolean;
}) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
        placeholder
          ? "border border-dashed border-fijo-200 bg-white/60 text-[var(--muted)]"
          : "border border-fijo-300 bg-fijo-50 text-fijo-700"
      }`}
      aria-hidden="true"
    >
      {placeholder ? "+" : index}
    </span>
  );
}

interface SlotProps {
  pairId: string;
  side: "left" | "right";
  playerId: string | null;
  playersById: Map<string, Player>;
  bestPlayerIds: Set<string>;
  formData: MvpFormData;
  activeLevel: SkillLevel | null;
  isPlaceholder: boolean;
}

function Slot({
  pairId,
  side,
  playerId,
  playersById,
  bestPlayerIds,
  formData,
  activeLevel,
  isPlaceholder,
}: SlotProps) {
  const dropId = `pair-${pairId}-${side}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  const player = playerId ? playersById.get(playerId) : null;
  const playerLevel = player ? effectiveLevelOf(player, bestPlayerIds) : null;
  const sameLevelHint =
    !player && activeLevel != null;
  // Si el slot está vacío y hay un drag activo, sugerimos visualmente
  // (no bloqueante) — el resaltado se marca cuando el slot está disponible.
  const hintClass = sameLevelHint
    ? "border-fijo-300 bg-fijo-50/50"
    : "border-fijo-100 bg-white/60";

  const filledClass = isOver
    ? "ring-2 ring-fijo-500/60"
    : "";

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[48px] flex-1 items-center rounded-md border-2 border-dashed p-1.5 transition ${
        player ? "border-transparent bg-transparent" : hintClass
      } ${filledClass}`}
    >
      {player ? (
        <DraggablePlayerCard
          player={player}
          effectiveLevel={playerLevel!}
          formData={formData}
          highlighted={
            activeLevel != null && playerLevel === activeLevel
          }
        />
      ) : (
        <span className="w-full px-2 text-center text-xs font-semibold text-[var(--muted)]">
          {isPlaceholder ? "+ soltá un jugador acá" : "esperando..."}
        </span>
      )}
    </div>
  );
}

interface CentralZoneProps {
  unpaired: Player[];
  bestPlayerIds: Set<string>;
  formData: MvpFormData;
  activeLevel: SkillLevel | null;
}

function CentralZone({
  unpaired,
  bestPlayerIds,
  formData,
  activeLevel,
}: CentralZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "central" });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-3 transition ${
        isOver
          ? "border-fijo-500 bg-fijo-50"
          : "border-fijo-100 bg-white/50"
      }`}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
        sin emparejar ({unpaired.length})
      </p>
      {unpaired.length === 0 ? (
        <p className="px-2 py-3 text-center text-sm text-[var(--muted)]">
          Todos los presentes están en algún par. Si querés sumar libres,
          arrastrá un jugador acá.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {unpaired.map((p) => {
            const lvl = effectiveLevelOf(p, bestPlayerIds);
            return (
              <DraggablePlayerCard
                key={p.id}
                player={p}
                effectiveLevel={lvl}
                formData={formData}
                highlighted={activeLevel != null && lvl === activeLevel}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
