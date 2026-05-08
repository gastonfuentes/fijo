"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireEditor from "@/components/RequireEditor";
import GroupSetup from "@/components/GroupSetup";
import { useGroupContext } from "@/contexts/GroupContext";
import {
  getPlayers,
  getMatchDayById,
  getMvpPollByMatchDay,
  updateMatchDay,
} from "@/lib/db";
import { Player, MatchDay } from "@/types";

type Assignment = "A" | "B" | null;

export default function EditarPartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: matchDayId } = use(params);
  const { activeGroup } = useGroupContext();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const [players, setPlayers] = useState<Player[]>([]);
  const [match, setMatch] = useState<MatchDay | null>(null);
  const [date, setDate] = useState("");
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [winner, setWinner] = useState<"A" | "B" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeGroup) return;
    setLoading(true);
    setNotFound(false);
    setLocked(false);
    setError(null);

    const [playersRes, matchRes, pollRes] = await Promise.all([
      getPlayers(activeGroup.id),
      getMatchDayById(matchDayId),
      getMvpPollByMatchDay(matchDayId),
    ]);

    if (!matchRes || matchRes.groupId !== activeGroup.id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    if (pollRes || matchRes.mvpPlayerIds.length > 0) {
      setLocked(true);
      setLoading(false);
      return;
    }

    setPlayers(playersRes);
    setMatch({
      id: matchRes.id,
      date: matchRes.date,
      attendees: matchRes.attendees,
      teamA: matchRes.teamA,
      teamB: matchRes.teamB,
      winner: matchRes.winner,
      mvpPlayerIds: matchRes.mvpPlayerIds,
      createdAt: matchRes.createdAt,
    });
    setDate(matchRes.date);
    setWinner(matchRes.winner);

    const initialAssignments: Record<string, Assignment> = {};
    for (const p of playersRes) initialAssignments[p.id] = null;
    for (const id of matchRes.teamA) initialAssignments[id] = "A";
    for (const id of matchRes.teamB) initialAssignments[id] = "B";
    setAssignments(initialAssignments);

    setLoading(false);
  }, [activeGroup, matchDayId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setAssignment = (playerId: string, value: Assignment) => {
    setAssignments((prev) => ({ ...prev, [playerId]: value }));
    setError(null);
  };

  const teamA = useMemo(
    () => players.filter((p) => assignments[p.id] === "A"),
    [players, assignments]
  );
  const teamB = useMemo(
    () => players.filter((p) => assignments[p.id] === "B"),
    [players, assignments]
  );

  const ghostIds = useMemo(() => {
    if (!match) return [] as string[];
    const known = new Set(players.map((p) => p.id));
    const used = new Set([...match.teamA, ...match.teamB]);
    return Array.from(used).filter((id) => !known.has(id));
  }, [match, players]);

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
      const [freshMatch, freshPoll] = await Promise.all([
        getMatchDayById(matchDayId),
        getMvpPollByMatchDay(matchDayId),
      ]);
      if (!freshMatch || freshMatch.groupId !== activeGroup.id) {
        setError("Este partido ya no está disponible. Recargá la página.");
        setSaving(false);
        return;
      }
      if (freshPoll || freshMatch.mvpPlayerIds.length > 0) {
        setError(
          "Ya hay encuesta MVP para este partido. Recargá la página."
        );
        setSaving(false);
        return;
      }

      const teamAIds = teamA.map((p) => p.id);
      const teamBIds = teamB.map((p) => p.id);
      const attendees = [...teamAIds, ...teamBIds];

      await updateMatchDay(activeGroup.id, matchDayId, {
        date,
        attendees,
        teamA: teamAIds,
        teamB: teamBIds,
        winner,
      });
      router.push("/partidos");
    } catch {
      setError("No se pudo guardar el partido. Intentá de nuevo.");
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <RequireEditor>
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
              <p className="eyebrow mb-2">editar partido</p>
              <h1 className="text-4xl font-black leading-tight text-fijo-900">
                Editar partido
              </h1>
              <p className="muted-copy mt-2 text-sm">
                Cambiá la asignación de jugadores, el ganador o la fecha. No se
                puede editar después de crear la encuesta MVP.
              </p>
            </header>

            {loading ? (
              <div className="space-y-4">
                <div className="skeleton h-20" />
                <div className="skeleton h-64" />
              </div>
            ) : notFound ? (
              <div className="surface mx-auto max-w-xl p-8 text-center">
                <p className="eyebrow mb-2">no encontrado</p>
                <h2 className="text-2xl font-black text-fijo-900">
                  Este partido no existe
                </h2>
                <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
                  No pudimos encontrarlo en el grupo activo. Volvé a la lista
                  de partidos.
                </p>
                <Link
                  href="/partidos"
                  className="btn-secondary mt-6 inline-block"
                >
                  Volver a partidos
                </Link>
              </div>
            ) : locked ? (
              <div className="surface mx-auto max-w-xl p-8 text-center">
                <p className="eyebrow mb-2">no se puede editar</p>
                <h2 className="text-2xl font-black text-fijo-900">
                  Este partido ya tiene encuesta MVP
                </h2>
                <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
                  No se puede cambiar la composición ni el ganador. Si
                  necesitás corregirlo, eliminá la encuesta primero desde la
                  lista de partidos.
                </p>
                <Link
                  href="/partidos"
                  className="btn-secondary mt-6 inline-block"
                >
                  Volver a partidos
                </Link>
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

                {/* Warning de jugadores fantasma */}
                {ghostIds.length > 0 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    Hay {ghostIds.length}{" "}
                    {ghostIds.length === 1 ? "jugador" : "jugadores"} que ya no
                    están en el grupo y van a ser removidos del partido si
                    guardás los cambios.
                  </p>
                )}

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
                      antes de editar el partido.
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

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={handleSave}
                    disabled={saving || players.length === 0}
                    className="btn-primary w-full text-lg"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <Link
                    href="/partidos"
                    className="btn-secondary w-full text-center"
                  >
                    Cancelar
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </RequireEditor>
    </ProtectedRoute>
  );
}
