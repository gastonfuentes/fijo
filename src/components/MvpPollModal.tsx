"use client";

import { useState } from "react";
import { Player, MvpPollCandidate } from "@/types";

interface Props {
  players: Player[];
  eligiblePlayerIds: string[]; // teamA ∪ teamB de ese partido
  onConfirm: (candidates: MvpPollCandidate[]) => Promise<void>;
  onCancel: () => void;
}

export default function MvpPollModal({ players, eligiblePlayerIds, onConfirm, onCancel }: Props) {
  const eligible = players.filter((p) => eligiblePlayerIds.includes(p.id));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size < 3) return;
    setLoading(true);
    const candidates = eligible
      .filter((p) => selected.has(p.id))
      .map((p) => ({ id: p.id, name: p.name }));
    await onConfirm(candidates);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="surface w-full max-w-md p-6">
        <p className="eyebrow mb-1">encuesta MVP</p>
        <h2 className="mb-1 text-2xl font-black text-fijo-900">Elegí los candidatos</h2>
        <p className="muted-copy mb-5 text-sm">
          Seleccioná entre 3 y 4 jugadores que jugaron hoy.
        </p>

        <div className="mb-5 space-y-2">
          {eligible.map((p) => {
            const checked = selected.has(p.id);
            const disabled = !checked && selected.size >= 4;
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                disabled={disabled}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-bold transition-colors ${
                  checked
                    ? "border-fijo-600 bg-fijo-50 text-fijo-900"
                    : disabled
                    ? "border-fijo-100 bg-white text-[var(--muted)] opacity-40"
                    : "border-fijo-200 bg-white text-fijo-900 hover:bg-fijo-50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs font-black ${
                    checked ? "border-fijo-600 bg-fijo-600 text-white" : "border-fijo-300"
                  }`}
                >
                  {checked && "✓"}
                </span>
                {p.name}
              </button>
            );
          })}
        </div>

        <p className="mb-4 text-xs text-[var(--muted)]">
          {selected.size} / 4 seleccionados{selected.size < 3 && " — mínimo 3"}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-fijo-200 px-4 py-3 text-sm font-bold text-[var(--muted)] hover:bg-fijo-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size < 3 || loading}
            className="flex-1 rounded-lg bg-fijo-900 px-4 py-3 text-sm font-black text-white hover:bg-fijo-800 disabled:opacity-40"
          >
            {loading ? "Creando..." : "Crear encuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}
