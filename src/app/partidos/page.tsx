"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import GroupSetup from "@/components/GroupSetup";
import MvpPollModal from "@/components/MvpPollModal";
import MvpPollCard from "@/components/MvpPollCard";
import { useGroupContext } from "@/contexts/GroupContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPlayers,
  getMatchDays,
  updateMatchDay,
  deleteMatchDay,
  createMvpPoll,
  getMvpPollsByGroup,
  getMvpPollResults,
} from "@/lib/db";
import { Player, MatchDay, MvpPoll, MvpPollResults, MvpPollCandidate } from "@/types";

export default function PartidosPage() {
  const { activeGroup } = useGroupContext();
  const { user } = useAuth();
  const [matchDays, setMatchDays] = useState<MatchDay[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [polls, setPolls] = useState<MvpPoll[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, MvpPollResults>>({});
  const [loading, setLoading] = useState(true);

  // Modal state: id del partido para el que se está creando la encuesta
  const [modalMatchId, setModalMatchId] = useState<string | null>(null);

  const isOwner = !!(activeGroup && user && activeGroup.ownerId === user.id);

  const load = useCallback(async () => {
    if (!activeGroup) return;
    setLoading(true);
    const [md, pl, ps] = await Promise.all([
      getMatchDays(activeGroup.id),
      getPlayers(activeGroup.id),
      getMvpPollsByGroup(activeGroup.id),
    ]);
    setMatchDays(md);
    setPlayers(pl);
    setPolls(ps);

    // Cargar resultados de cada encuesta
    const results: Record<string, MvpPollResults> = {};
    await Promise.all(
      ps.map(async (poll) => {
        const r = await getMvpPollResults(poll.id);
        if (r) results[poll.id] = r;
      })
    );
    setPollResults(results);
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "???";

  const setWinner = async (matchId: string, winner: "A" | "B") => {
    if (!activeGroup) return;
    await updateMatchDay(activeGroup.id, matchId, { winner });
    await load();
    // Solo el owner puede crear la encuesta; abrir modal
    if (isOwner) setModalMatchId(matchId);
  };

  const handleDelete = async (matchId: string) => {
    if (!activeGroup) return;
    if (!confirm("Eliminar este partido?")) return;
    await deleteMatchDay(activeGroup.id, matchId);
    await load();
  };

  const handleCreatePoll = async (matchId: string, candidates: MvpPollCandidate[]) => {
    if (!activeGroup) return;
    const match = matchDays.find((m) => m.id === matchId);
    if (!match) return;
    await createMvpPoll(
      activeGroup.id,
      matchId,
      activeGroup.name,
      match.date,
      candidates
    );
    setModalMatchId(null);
    await load();
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const getPollForMatch = (matchId: string) => polls.find((p) => p.matchDayId === matchId) ?? null;

  const modalMatch = modalMatchId ? matchDays.find((m) => m.id === modalMatchId) : null;

  return (
    <ProtectedRoute>
      <GroupSetup />
      {activeGroup && (
        <div className="page-shell">
          <header className="mb-8 max-w-3xl">
            <p className="eyebrow mb-2">historial</p>
            <h1 className="text-4xl font-black leading-tight text-fijo-900">
              Partidos
            </h1>
            <p className="muted-copy mt-2 text-sm">
              Guarda el ganador de cada fecha y eliminá los partidos cargados por
              error.
            </p>
          </header>

          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-56" />
              <div className="skeleton h-56" />
            </div>
          ) : matchDays.length === 0 ? (
            <div className="surface mx-auto max-w-xl p-8 text-center">
              <p className="eyebrow mb-2">sin partidos</p>
              <h2 className="text-2xl font-black text-fijo-900">
                Hace un sorteo primero
              </h2>
              <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
                Cuando guardes un partido, lo vas a ver aca para registrar el
                ganador.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {matchDays.map((md) => {
                const poll = getPollForMatch(md.id);
                const results = poll ? (pollResults[poll.id] ?? null) : null;

                return (
                  <article key={md.id} className="surface p-5">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold text-[var(--muted)]">fecha</p>
                        <h2 className="font-mono text-2xl font-black text-fijo-900">
                          {formatDate(md.date)}
                        </h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {md.winner ? (
                          <span className="level-pill border border-fijo-200 bg-fijo-100 text-fijo-800">
                            Gano Equipo {md.winner}
                          </span>
                        ) : (
                          <span className="level-pill border border-fijo-100 bg-white text-[var(--muted)]">
                            Sin resultado
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(md.id)}
                          className="rounded-md px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mb-4 grid gap-4 md:grid-cols-2">
                      <div
                        className={`rounded-lg border-l-4 p-4 ${
                          md.winner === "A"
                            ? "border-l-sky-600 bg-sky-100"
                            : "border-l-sky-400 bg-sky-50/75"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-lg font-black text-sky-900">Equipo A</h3>
                          {md.winner === "A" && (
                            <span className="level-pill bg-white text-sky-800">
                              Ganador
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {md.teamA.map((id) => (
                            <p key={id} className="rounded-md bg-white/70 px-3 py-2 text-sm font-bold text-sky-900">
                              {playerName(id)}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div
                        className={`rounded-lg border-l-4 p-4 ${
                          md.winner === "B"
                            ? "border-l-red-600 bg-red-100"
                            : "border-l-red-400 bg-red-50/75"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-lg font-black text-red-900">Equipo B</h3>
                          {md.winner === "B" && (
                            <span className="level-pill bg-white text-red-800">
                              Ganador
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {md.teamB.map((id) => (
                            <p key={id} className="rounded-md bg-white/70 px-3 py-2 text-sm font-bold text-red-900">
                              {playerName(id)}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    {!md.winner && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          onClick={() => setWinner(md.id, "A")}
                          className="rounded-lg border border-sky-300 bg-white px-4 py-3 text-sm font-black text-sky-800 hover:bg-sky-50"
                        >
                          Gano Equipo A
                        </button>
                        <button
                          onClick={() => setWinner(md.id, "B")}
                          className="rounded-lg border border-red-300 bg-white px-4 py-3 text-sm font-black text-red-800 hover:bg-red-50"
                        >
                          Gano Equipo B
                        </button>
                      </div>
                    )}

                    {/* Sección MVP */}
                    {md.winner && (
                      <>
                        {poll && results ? (
                          <MvpPollCard
                            poll={poll}
                            results={results}
                            isOwner={isOwner}
                            playerName={playerName}
                            onPollUpdated={load}
                          />
                        ) : md.mvpPlayerIds.length > 0 ? (
                          // Poll eliminada pero MVP ya guardado en el partido
                          <div className="mt-4 rounded-lg border border-fijo-200 bg-fijo-50 p-4">
                            <p className="mb-2 text-xs font-bold text-[var(--muted)]">MVP del partido</p>
                            <div className="flex flex-wrap gap-2">
                              {md.mvpPlayerIds.map((id) => (
                                <span key={id} className="level-pill border border-fijo-300 bg-white font-black text-fijo-900">
                                  🏆 {playerName(id)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : isOwner ? (
                          <button
                            onClick={() => setModalMatchId(md.id)}
                            className="mt-4 w-full rounded-lg border border-fijo-300 bg-white px-4 py-3 text-sm font-black text-fijo-800 hover:bg-fijo-50"
                          >
                            Crear encuesta MVP
                          </button>
                        ) : null}
                      </>
                    )}

                    <p className="mt-4 text-sm font-semibold text-[var(--muted)]">
                      {md.attendees.length} jugadores presentes
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal para seleccionar candidatos */}
      {modalMatch && (
        <MvpPollModal
          players={players}
          eligiblePlayerIds={[...modalMatch.teamA, ...modalMatch.teamB]}
          onConfirm={(candidates) => handleCreatePoll(modalMatch.id, candidates)}
          onCancel={() => setModalMatchId(null)}
        />
      )}
    </ProtectedRoute>
  );
}
