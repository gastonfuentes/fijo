"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import GroupSetup from "@/components/GroupSetup";
import { useGroupContext } from "@/contexts/GroupContext";
import { getPlayers, createMatchDay } from "@/lib/db";
import { sorteoBalanceado } from "@/lib/sorteo";
import { Player } from "@/types";

function TeamCard({
  team,
  label,
  color,
}: {
  team: Player[];
  label: string;
  color: string;
}) {
  const bestCount = team.filter((p) => p.level === "bueno").length;

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
            {p.level === "bueno" && (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-fijo-200 bg-white text-base shadow-[inset_0_0_0_3px_rgba(216,237,218,0.9),0_10px_20px_-16px_rgba(27,64,41,0.9)]"
                aria-label={`${p.name} marcado como bueno`}
                title="Jugador destacado"
              >
                ⚽
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-fijo-100 pt-3 text-sm font-semibold text-[var(--muted)]">
        <span aria-label={`${bestCount} jugadores marcados como buenos`}>
          ⚽ {bestCount}
        </span>
        <span>Total: {team.length}</span>
      </div>
    </div>
  );
}

export default function SorteoPage() {
  const { activeGroup } = useGroupContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bestPlayers, setBestPlayers] = useState<Set<string>>(new Set());
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
    setBestPlayers(new Set());
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const togglePlayer = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setBestPlayers((current) => {
          const best = new Set(current);
          best.delete(id);
          return best;
        });
      } else {
        next.add(id);
      }
      return next;
    });
    setSorted(false);
    setSaved(false);
  };

  const toggleBestPlayer = (id: string, checked: boolean) => {
    setBestPlayers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

    if (checked) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }

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
    setBestPlayers(new Set());
    setSorted(false);
    setSaved(false);
  };

  const handleSorteo = () => {
    const attending = players
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        ...p,
        level: bestPlayers.has(p.id) ? "bueno" : "tranqui",
      }) satisfies Player);

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
              Marca los presentes, tilda rapido quienes son los mejores hoy y
              guarda el partido para completar el resultado despues.
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
                    <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                      Buenos marcados: {bestPlayers.size}
                    </p>
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
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-lg border px-3 py-3 text-sm focus-within:ring-4 focus-within:ring-fijo-600/15 ${
                        selected.has(p.id)
                          ? "border-fijo-500 bg-fijo-50 text-fijo-900 shadow-[0_10px_24px_-22px_rgba(27,64,41,0.8)]"
                          : "border-fijo-100 bg-white/70 text-[var(--muted)] opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 font-bold">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => togglePlayer(p.id)}
                            className="h-4 w-4 accent-fijo-700"
                          />
                          <span className={selected.has(p.id) ? "" : "line-through"}>
                            {p.name}
                          </span>
                        </label>
                        <label
                          className="group/best flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center"
                          title="Marcar como bueno"
                        >
                          <input
                            type="checkbox"
                            checked={bestPlayers.has(p.id)}
                            onChange={(event) =>
                              toggleBestPlayer(p.id, event.target.checked)
                            }
                            aria-label={`Marcar a ${p.name} como bueno`}
                            className="peer sr-only"
                          />
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-fijo-200 bg-white text-base shadow-[inset_0_2px_0_rgba(255,255,255,0.9),0_8px_18px_-16px_rgba(27,64,41,0.8)] transition group-hover/best:border-fijo-500 group-hover/best:bg-fijo-50 peer-focus-visible:ring-4 peer-focus-visible:ring-fijo-600/15 peer-checked:border-fijo-700 peer-checked:bg-white peer-checked:shadow-[inset_0_0_0_3px_rgba(216,237,218,0.9),0_10px_20px_-16px_rgba(27,64,41,0.9)]">
                            <span aria-hidden="true">
                              {bestPlayers.has(p.id) ? "⚽" : ""}
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
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
