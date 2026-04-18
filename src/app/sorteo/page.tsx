"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import GroupSetup from "@/components/GroupSetup";
import { useGroupContext } from "@/contexts/GroupContext";
import { getPlayers, createMatchDay } from "@/lib/db";
import { sorteoBalanceado } from "@/lib/sorteo";
import { Player, SkillLevel } from "@/types";

const LEVEL_COLORS: Record<SkillLevel, string> = {
  bueno: "border border-fijo-200 bg-fijo-100 text-fijo-800",
  tranqui: "border border-amber-200 bg-amber-50 text-amber-800",
  malo: "border border-red-200 bg-red-50 text-red-700",
};

const LEVEL_LABELS: Record<SkillLevel, string> = {
  bueno: "Bueno",
  tranqui: "Tranqui",
  malo: "Malo",
};

function TeamCard({
  team,
  label,
  color,
}: {
  team: Player[];
  label: string;
  color: string;
}) {
  return (
    <div className={`surface-solid flex-1 border-l-4 p-5 ${color}`}>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--muted)]">equipo</p>
          <h3 className="text-2xl font-black text-fijo-900">{label}</h3>
        </div>
        <p className="font-mono text-3xl font-black text-fijo-900">{team.length}</p>
      </div>
      <div className="space-y-2">
        {team.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2"
          >
            <span className="font-bold text-fijo-900">{p.name}</span>
            <span className={`level-pill ${LEVEL_COLORS[p.level]}`}>
              {LEVEL_LABELS[p.level]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-fijo-100 pt-3 text-sm font-semibold text-[var(--muted)]">
        {["bueno", "tranqui", "malo"].map((l) => {
          const count = team.filter((p) => p.level === l).length;
          return count > 0 ? (
            <span key={l} className="mr-3">
              {LEVEL_LABELS[l as SkillLevel]}: {count}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}

export default function SorteoPage() {
  const { activeGroup } = useGroupContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [sorted, setSorted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeGroup) return;
    setLoading(true);
    const p = await getPlayers(activeGroup.id);
    setPlayers(p);
    // Seleccionar todos por default
    setSelected(new Set(p.map((pl) => pl.id)));
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const togglePlayer = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSorted(false);
    setSaved(false);
  };

  const selectAll = () => {
    setSelected(new Set(players.map((p) => p.id)));
    setSorted(false);
    setSaved(false);
  };

  const selectNone = () => {
    setSelected(new Set());
    setSorted(false);
    setSaved(false);
  };

  const handleSorteo = () => {
    const attending = players.filter((p) => selected.has(p.id));
    if (attending.length < 2) return;
    const { teamA: a, teamB: b } = sorteoBalanceado(attending);
    setTeamA(a);
    setTeamB(b);
    setSorted(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!activeGroup || !sorted) return;
    setSaving(true);
    await createMatchDay(activeGroup.id, {
      date: new Date().toISOString().split("T")[0],
      attendees: [...selected],
      teamA: teamA.map((p) => p.id),
      teamB: teamB.map((p) => p.id),
      winner: null,
      createdAt: Date.now(),
    });
    setSaving(false);
    setSaved(true);
  };

  return (
    <ProtectedRoute>
      <GroupSetup />
      {activeGroup && (
        <div className="page-shell">
          <header className="mb-8 max-w-3xl">
            <p className="eyebrow mb-2">dia de partido</p>
            <h1 className="text-4xl font-black leading-tight text-fijo-900">
              Sorteo de equipos
            </h1>
            <p className="muted-copy mt-2 text-sm">
              Marca los presentes, sortea y guarda el partido para completar el
              resultado despues.
            </p>
          </header>

          {loading ? (
            <div className="surface p-5">
              <div className="skeleton h-8 w-56" />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
              </div>
              <div className="skeleton mt-5 h-14" />
            </div>
          ) : players.length < 2 ? (
            <div className="surface mx-auto max-w-xl p-8 text-center">
              <p className="eyebrow mb-2">faltan jugadores</p>
              <h2 className="text-2xl font-black text-fijo-900">
                Necesitas al menos 2 jugadores
              </h2>
              <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
                Agrega el plantel primero y volve para armar los equipos.
              </p>
            </div>
          ) : (
            <>
              <section className="surface mb-6 p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-[var(--muted)]">lista</p>
                    <h2 className="text-2xl font-black text-fijo-900">
                    Presentes hoy ({selected.size} de {players.length})
                    </h2>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button onClick={selectAll} className="btn-secondary min-h-10 px-3 py-2">
                      Todos
                    </button>
                    <button onClick={selectNone} className="btn-ghost">
                      Ninguno
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePlayer(p.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-bold focus:outline-none focus:ring-4 focus:ring-fijo-600/15 ${
                        selected.has(p.id)
                          ? "border-fijo-500 bg-fijo-50 text-fijo-900 shadow-[0_10px_24px_-22px_rgba(27,64,41,0.8)]"
                          : "border-fijo-100 bg-white/70 text-[var(--muted)] opacity-60 line-through"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          selected.has(p.id) ? "bg-fijo-500" : "bg-gray-300"
                        }`}
                      />
                      {p.name}
                      <span className={`level-pill ml-auto px-1.5 py-0.5 ${LEVEL_COLORS[p.level]}`}>
                        {p.level[0].toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSorteo}
                  disabled={selected.size < 2}
                  className="btn-primary flex-1 text-lg"
                >
                  Sortear equipos
                </button>
                {sorted && !saved && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-secondary"
                  >
                    {saving ? "Guardando..." : "Guardar partido"}
                  </button>
                )}
                {saved && (
                  <span className="surface-solid flex items-center px-4 py-3 font-bold text-fijo-700">
                    Guardado
                  </span>
                )}
              </div>

              {sorted && (
                <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
                  <TeamCard team={teamA} label="A" color="border-l-sky-500 bg-sky-50/70" />
                  <div className="flex items-center justify-center rounded-lg border border-fijo-100 bg-white/70 px-4 py-3 text-2xl font-black text-[var(--muted)]">
                    VS
                  </div>
                  <TeamCard team={teamB} label="B" color="border-l-red-500 bg-red-50/70" />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </ProtectedRoute>
  );
}
