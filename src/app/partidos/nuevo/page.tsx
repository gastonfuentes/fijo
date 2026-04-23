"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import GroupSetup from "@/components/GroupSetup";
import { useGroupContext } from "@/contexts/GroupContext";
import { getPlayers, createMatchDay } from "@/lib/db";
import { Player } from "@/types";

type Assignment = "A" | "B" | null;

export default function NuevoPartidoPage() {
  const { activeGroup } = useGroupContext();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [winner, setWinner] = useState<"A" | "B" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeGroup) return;
    setLoading(true);
    const p = await getPlayers(activeGroup.id);
    setPlayers(p);
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setAssignment = (playerId: string, value: Assignment) => {
    setAssignments((prev) => ({ ...prev, [playerId]: value }));
    setError(null);
  };

  const teamA = players.filter((p) => assignments[p.id] === "A");
  const teamB = players.filter((p) => assignments[p.id] === "B");

  const validate = (): string | null => {
    if (!date) return "Elegí una fecha para el partido.";
    if (teamA.length === 0) return "El Equipo A necesita al menos un jugador.";
    if (teamB.length === 0) return "El Equipo B necesita al menos un jugador.";
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!activeGroup) return;

    setSaving(true);
    setError(null);
    try {
      const attendees = [...teamA.map((p) => p.id), ...teamB.map((p) => p.id)];
      await createMatchDay(activeGroup.id, {
        date,
        attendees,
        teamA: teamA.map((p) => p.id),
        teamB: teamB.map((p) => p.id),
        winner,
        mvpPlayerIds: [],
        createdAt: Date.now(),
      });
      router.push("/partidos");
    } catch {
      setError("No se pudo guardar el partido. Intentá de nuevo.");
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <GroupSetup />
      {activeGroup && (
        <div className="page-shell">
          <header className="mb-8 max-w-3xl">
            <Link
              href="/partidos"
              className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--muted)] hover:text-fijo-900"
            >
              ← Volver a partidos
            </Link>
            <p className="eyebrow mb-2">carga manual</p>
            <h1 className="text-4xl font-black leading-tight text-fijo-900">
              Cargar partido
            </h1>
            <p className="muted-copy mt-2 text-sm">
              Cargá un partido que ya se jugó: elegí la fecha, asigná cada
              jugador a su equipo y registrá el ganador si lo sabés.
            </p>
          </header>

          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-20" />
              <div className="skeleton h-64" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Fecha */}
              <section className="surface p-5">
                <label className="block">
                  <p className="mb-2 text-xs font-bold text-[var(--muted)]">fecha del partido</p>
                  <input
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => setDate(e.target.value)}
                    className="field max-w-xs"
                  />
                </label>
              </section>

              {/* Jugadores */}
              {players.length === 0 ? (
                <div className="surface mx-auto max-w-xl p-8 text-center">
                  <p className="eyebrow mb-2">sin jugadores</p>
                  <h2 className="text-2xl font-black text-fijo-900">
                    No hay jugadores en el grupo
                  </h2>
                  <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
                    Agregá jugadores desde la sección{" "}
                    <Link href="/jugadores" className="font-bold underline">
                      Jugadores
                    </Link>{" "}
                    antes de cargar un partido.
                  </p>
                </div>
              ) : (
                <section className="surface p-5">
                  <div className="mb-4">
                    <p className="text-xs font-bold text-[var(--muted)]">asignación de equipos</p>
                    <h2 className="text-2xl font-black text-fijo-900">
                      ¿Quién jugó en cada equipo?
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                      Equipo A: {teamA.length} · Equipo B: {teamB.length}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map((p) => {
                      const current = assignments[p.id] ?? null;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-lg border p-3 text-sm transition-colors ${
                            current === "A"
                              ? "border-sky-400 bg-sky-50"
                              : current === "B"
                              ? "border-red-400 bg-red-50"
                              : "border-fijo-100 bg-white/70 opacity-60"
                          }`}
                        >
                          <p className="mb-2 font-bold text-fijo-900">{p.name}</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() =>
                                setAssignment(p.id, current === "A" ? null : "A")
                              }
                              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-black transition-colors ${
                                current === "A"
                                  ? "border-sky-500 bg-sky-500 text-white"
                                  : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                              }`}
                            >
                              A
                            </button>
                            <button
                              onClick={() =>
                                setAssignment(p.id, current === "B" ? null : "B")
                              }
                              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-black transition-colors ${
                                current === "B"
                                  ? "border-red-500 bg-red-500 text-white"
                                  : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                              }`}
                            >
                              B
                            </button>
                            <button
                              onClick={() => setAssignment(p.id, null)}
                              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-black transition-colors ${
                                current === null
                                  ? "border-fijo-300 bg-fijo-100 text-fijo-700"
                                  : "border-fijo-100 bg-white text-[var(--muted)] hover:bg-fijo-50"
                              }`}
                            >
                              Ausente
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Ganador */}
              <section className="surface p-5">
                <p className="mb-3 text-xs font-bold text-[var(--muted)]">resultado</p>
                <h2 className="mb-3 text-2xl font-black text-fijo-900">
                  ¿Quién ganó?
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setWinner(winner === "A" ? null : "A")}
                    className={`rounded-lg border px-5 py-3 text-sm font-black transition-colors ${
                      winner === "A"
                        ? "border-sky-500 bg-sky-500 text-white"
                        : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                    }`}
                  >
                    Ganó Equipo A
                  </button>
                  <button
                    onClick={() => setWinner(winner === "B" ? null : "B")}
                    className={`rounded-lg border px-5 py-3 text-sm font-black transition-colors ${
                      winner === "B"
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                    }`}
                  >
                    Ganó Equipo B
                  </button>
                  <button
                    onClick={() => setWinner(null)}
                    className={`rounded-lg border px-5 py-3 text-sm font-black transition-colors ${
                      winner === null
                        ? "border-fijo-300 bg-fijo-100 text-fijo-700"
                        : "border-fijo-100 bg-white text-[var(--muted)] hover:bg-fijo-50"
                    }`}
                  >
                    Sin definir
                  </button>
                </div>
              </section>

              {/* Error y guardar */}
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={saving || players.length === 0}
                className="btn-primary w-full text-lg"
              >
                {saving ? "Guardando..." : "Guardar partido"}
              </button>
            </div>
          )}
        </div>
      )}
    </ProtectedRoute>
  );
}
