"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import GroupSetup from "@/components/GroupSetup";
import { useGroupContext } from "@/contexts/GroupContext";
import { getPlayers, getMatchDays, getRecentMvpForm, getMvpPollResultsByMatchDay } from "@/lib/db";
import { Player, MatchDay, PlayerStats, MvpFormData, MvpPollResults } from "@/types";
import { computeMvpForm } from "@/lib/mvpForm";
import MvpFormArrow from "@/components/MvpFormArrow";
import MvpResultBars from "@/components/MvpResultBars";
import Link from "next/link";

const EMPTY_FORM: MvpFormData = {
  totals: {},
  candidatePlayerIds: [],
  lastMatchMvpIds: [],
  pollsCount: 0,
};

function computeStats(players: Player[], matchDays: MatchDay[]): PlayerStats[] {
  const totalMatchDays = matchDays.length;

  return players.map((p) => {
    let wins = 0;
    let losses = 0;
    let attendance = 0;

    for (const md of matchDays) {
      const wasPresent = md.attendees.includes(p.id);
      if (wasPresent) {
        attendance++;
        if (md.winner) {
          const inTeamA = md.teamA.includes(p.id);
          const inTeamB = md.teamB.includes(p.id);
          if ((inTeamA && md.winner === "A") || (inTeamB && md.winner === "B")) {
            wins++;
          } else if (inTeamA || inTeamB) {
            losses++;
          }
        }
      }
    }

    return {
      playerId: p.id,
      name: p.name,
      gamesPlayed: wins + losses,
      wins,
      losses,
      attendance,
      absences: totalMatchDays - attendance,
    };
  });
}

function getPlayerAttendanceRate(player: PlayerStats, totalMatches: number) {
  if (totalMatches === 0) return 0;
  return Math.round((player.attendance / totalMatches) * 100);
}

function formatMatchDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function TeamColumn({
  label,
  playerIds,
  isWinner,
  hasResult,
  mvpIds,
  playerNameById,
}: {
  label: string;
  playerIds: string[];
  isWinner: boolean;
  hasResult: boolean;
  mvpIds: string[];
  playerNameById: (id: string) => string;
}) {
  const containerClass = isWinner
    ? "rounded-lg border-2 border-fijo-400 bg-fijo-50/70 p-3"
    : hasResult
      ? "rounded-lg border border-fijo-100 bg-white p-3 opacity-80"
      : "rounded-lg border border-fijo-100 bg-white p-3";

  return (
    <div className={containerClass}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--muted)]">{label}</p>
        {isWinner && (
          <span className="text-xs font-black text-fijo-900">🏆 Ganador</span>
        )}
      </div>
      {playerIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {playerIds.map((id) => {
            const isMvp = mvpIds.includes(id);
            return (
              <span
                key={id}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
                  isMvp
                    ? "border-fijo-300 bg-fijo-100 text-fijo-900"
                    : "border-fijo-200 bg-white text-fijo-800"
                }`}
              >
                {isMvp && <span className="mr-1">👑</span>}
                {playerNameById(id)}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">—</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { activeGroup, isReadOnly } = useGroupContext();
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [formData, setFormData] = useState<MvpFormData>(EMPTY_FORM);
  const [lastMatch, setLastMatch] = useState<MatchDay | null>(null);
  const [lastPoll, setLastPoll] = useState<MvpPollResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"wins" | "attendance" | "absences">("wins");

  const load = useCallback(async () => {
    if (!activeGroup) return;
    setLoading(true);
    const [players, matchDays, mvpForm] = await Promise.all([
      getPlayers(activeGroup.id),
      getMatchDays(activeGroup.id),
      getRecentMvpForm(activeGroup.id),
    ]);
    const last = matchDays[0] ?? null;
    const pollResults = last ? await getMvpPollResultsByMatchDay(last.id) : null;
    setStats(computeStats(players, matchDays));
    setTotalMatches(matchDays.length);
    setFormData(mvpForm);
    setLastMatch(last);
    setLastPoll(pollResults);
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const playerNameById = (id: string) =>
    stats.find((s) => s.playerId === id)?.name ?? "???";

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === "wins") return b.wins - a.wins;
    if (sortBy === "attendance") {
      return (
        getPlayerAttendanceRate(b, totalMatches) -
          getPlayerAttendanceRate(a, totalMatches) || b.attendance - a.attendance
      );
    }
    return b.absences - a.absences;
  });
  const attendanceRate =
    totalMatches > 0 && stats.length > 0
      ? Math.round(
          (stats.reduce((sum, player) => sum + player.attendance, 0) /
            (stats.length * totalMatches)) *
            100
        )
      : 0;

  return (
    <ProtectedRoute>
      <GroupSetup />
      {activeGroup && (
        <div className="page-shell">
          {isReadOnly && (
            <div className="mb-4 rounded-lg border border-fijo-200 bg-fijo-50/60 p-3 text-sm font-semibold text-fijo-800">
              Estas viendo <span className="font-black">{activeGroup.name}</span> en modo solo lectura. No podes editar jugadores, partidos ni sorteos.
            </div>
          )}
          <header className="mb-8 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="eyebrow mb-2">panel del grupo</p>
              <h1 className="text-4xl font-black leading-tight text-fijo-900">
                {activeGroup.name}
              </h1>
              <p className="muted-copy mt-2 text-sm">
                {totalMatches} partidos jugados, asistencia y rachas del grupo.
              </p>
            </div>
            {!isReadOnly && (
              <Link
                href="/sorteo"
                className="btn-primary"
              >
                Nuevo sorteo
              </Link>
            )}
          </header>

          {loading ? (
            <div className="surface p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="skeleton h-28" />
                <div className="skeleton h-28" />
                <div className="skeleton h-28" />
              </div>
              <div className="skeleton mt-5 h-72" />
            </div>
          ) : stats.length === 0 ? (
            <div className="surface mx-auto max-w-xl p-8 text-center">
              <p className="eyebrow mb-2">sin datos todavia</p>
              <h2 className="text-2xl font-black text-fijo-900">
                {isReadOnly
                  ? "Este grupo todavia no cargo jugadores"
                  : "Carga jugadores para ver el ranking"}
              </h2>
              <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
                {isReadOnly
                  ? "Cuando un miembro del grupo cargue jugadores y partidos, vas a ver las estadisticas aca."
                  : "Cuando guardes partidos, este panel va a mostrar asistencia, victorias y faltas sin tocar planillas."}
              </p>
              {!isReadOnly && (
                <Link
                  href="/jugadores"
                  className="btn-primary mt-6"
                >
                  Agregar jugadores
                </Link>
              )}
            </div>
          ) : (
            <>
              <section className="mb-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="surface p-6">
                  <p className="text-sm font-bold text-[var(--muted)]">
                    Asistencia general
                  </p>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-mono text-6xl font-black leading-none text-fijo-900">
                        {attendanceRate}%
                      </p>
                      <p className="muted-copy mt-3 max-w-md text-sm">
                        Promedio sobre todos los jugadores y partidos guardados.
                      </p>
                    </div>
                    <div className="surface-solid min-w-40 p-4">
                      <p className="text-xs font-bold text-[var(--muted)]">puntero</p>
                      <p className="mt-1 text-lg font-black text-fijo-900">
                        {sorted[0]?.name}
                      </p>
                      <p className="font-mono text-sm text-fijo-700">
                        {sorted[0]?.wins} victorias
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="surface-solid p-5">
                    <p className="font-mono text-4xl font-black text-fijo-900">
                      {stats.length}
                    </p>
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      jugadores
                    </p>
                  </div>
                  <div className="surface-solid p-5">
                    <p className="font-mono text-4xl font-black text-fijo-900">
                      {totalMatches}
                    </p>
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      partidos
                    </p>
                  </div>
                </div>
              </section>

              <div className="surface-solid mb-4 flex gap-1 p-1">
                {[
                  { key: "wins" as const, label: "Victorias" },
                  { key: "attendance" as const, label: "Asistencia" },
                  { key: "absences" as const, label: "Faltas" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSortBy(tab.key)}
                    className={`flex-1 rounded-md py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-fijo-600/15 ${
                      sortBy === tab.key
                        ? "bg-fijo-800 text-white"
                        : "text-[var(--muted)] hover:bg-fijo-50 hover:text-fijo-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="surface overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-fijo-100 bg-fijo-50/70 text-[var(--muted)]">
                      <th className="px-4 py-3 text-left font-bold">#</th>
                      <th className="px-2 py-3 text-center font-bold">Forma</th>
                      <th className="px-4 py-3 text-left font-bold">Jugador</th>
                      <th className="px-4 py-3 text-center font-bold">% Asist.</th>
                      <th className="px-4 py-3 text-center font-bold">PJ</th>
                      <th className="px-4 py-3 text-center font-bold">G</th>
                      <th className="px-4 py-3 text-center font-bold">P</th>
                      <th className="px-4 py-3 text-center font-bold">Asist.</th>
                      <th className="px-4 py-3 text-center font-bold">Faltas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s, i) => (
                      <tr
                        key={s.playerId}
                        className="border-b border-fijo-100 last:border-b-0 hover:bg-fijo-50/55"
                      >
                        <td className="px-4 py-3 font-mono text-[var(--muted)]">
                          {i + 1}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <MvpFormArrow {...computeMvpForm(s.playerId, formData)} size="sm" />
                        </td>
                        <td className="px-4 py-3 font-bold text-fijo-900">{s.name}</td>
                        <td className="px-4 py-3 text-center font-mono font-black text-fijo-800">
                          {getPlayerAttendanceRate(s, totalMatches)}%
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {s.gamesPlayed}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-black text-fijo-700">
                          {s.wins}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-red-600">
                          {s.losses}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {s.attendance}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[var(--amber)]">
                          {s.absences}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="surface p-6">
                  <p className="text-sm font-bold text-[var(--muted)]">Último partido</p>
                  {lastMatch ? (
                    <>
                      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-2xl font-black text-fijo-900">
                          {formatMatchDate(lastMatch.date)}
                        </p>
                        <span className="text-xs font-bold text-[var(--muted)]">
                          {lastMatch.attendees.length} jugadores
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                        <TeamColumn
                          label="Equipo A"
                          playerIds={lastMatch.teamA}
                          isWinner={lastMatch.winner === "A"}
                          hasResult={!!lastMatch.winner}
                          mvpIds={lastMatch.mvpPlayerIds}
                          playerNameById={playerNameById}
                        />
                        <div className="hidden items-center justify-center sm:flex">
                          <span className="font-mono text-xs font-black text-[var(--muted)]">
                            VS
                          </span>
                        </div>
                        <TeamColumn
                          label="Equipo B"
                          playerIds={lastMatch.teamB}
                          isWinner={lastMatch.winner === "B"}
                          hasResult={!!lastMatch.winner}
                          mvpIds={lastMatch.mvpPlayerIds}
                          playerNameById={playerNameById}
                        />
                      </div>
                      {!lastMatch.winner && (
                        <p className="mt-4 text-xs font-bold text-[var(--muted)]">
                          Sin resultado cargado todavía.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="muted-copy mt-3 text-sm">Todavía no hay partidos cargados.</p>
                  )}
                </div>

                <div className="surface p-6">
                  <p className="text-sm font-bold text-[var(--muted)]">Votación MVP del último partido</p>
                  {!lastMatch ? (
                    <p className="muted-copy mt-3 text-sm">Todavía no hay partidos cargados.</p>
                  ) : !lastPoll ? (
                    <p className="muted-copy mt-3 text-sm">
                      Este partido todavía no tiene votación MVP.
                    </p>
                  ) : lastPoll.poll.status === "open" ? (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-2xl font-black text-fijo-900">
                          {formatMatchDate(lastPoll.poll.matchDate)}
                        </p>
                        <span className="level-pill border border-green-200 bg-green-50 font-black text-green-800">
                          Votación en curso
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-bold text-fijo-900">
                        {lastPoll.totalVotes} {lastPoll.totalVotes === 1 ? "voto" : "votos"} hasta ahora
                      </p>
                      <div className="mt-3">
                        <MvpResultBars
                          candidates={lastPoll.poll.candidates}
                          totals={lastPoll.totals}
                          totalVotes={lastPoll.totalVotes}
                        />
                      </div>
                      <Link
                        href={`/votar/${lastPoll.poll.id}`}
                        className="mt-4 inline-flex items-center gap-1 text-sm font-black text-fijo-800 underline-offset-2 hover:underline"
                      >
                        Ir a la votación →
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-black text-fijo-900">
                        {formatMatchDate(lastPoll.poll.matchDate)}
                      </p>
                      {lastPoll.winners.length > 0 ? (
                        <>
                          <p className="mt-3 text-sm font-bold text-fijo-900">
                            {lastPoll.winners.length === 1 ? "MVP del partido" : "MVP compartido"}
                          </p>
                          <div className="mt-2 mb-4 flex flex-wrap gap-2">
                            {lastPoll.winners.map((id) => {
                              const c = lastPoll.poll.candidates.find((x) => x.id === id);
                              return (
                                <span key={id} className="level-pill border border-fijo-300 bg-fijo-100 font-black text-fijo-900">
                                  🏆 {c?.name ?? playerNameById(id)}
                                </span>
                              );
                            })}
                          </div>
                          <MvpResultBars
                            candidates={lastPoll.poll.candidates}
                            totals={lastPoll.totals}
                            totalVotes={lastPoll.totalVotes}
                          />
                          <p className="mt-3 text-xs text-[var(--muted)]">
                            {lastPoll.totalVotes} votos en total
                          </p>
                        </>
                      ) : (
                        <p className="muted-copy mt-3 text-sm">Encuesta cerrada sin votos.</p>
                      )}
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </ProtectedRoute>
  );
}
