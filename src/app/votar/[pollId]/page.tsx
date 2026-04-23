"use client";

import { useState, useEffect, useCallback, use } from "react";
import { getMvpPollResults, castMvpVote } from "@/lib/db";
import { MvpPollResults } from "@/types";

const FINGERPRINT_KEY = "mvp_fp";
const VOTE_KEY_PREFIX = "mvp_vote_";

function getOrCreateFingerprint(): string {
  if (typeof window === "undefined") return "";
  let fp = localStorage.getItem(FINGERPRINT_KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(FINGERPRINT_KEY, fp);
  }
  return fp;
}

function getStoredVote(pollId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${VOTE_KEY_PREFIX}${pollId}`);
}

function storeVote(pollId: string, playerId: string) {
  localStorage.setItem(`${VOTE_KEY_PREFIX}${pollId}`, playerId);
}

export default function VotarPage({ params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = use(params);
  const [results, setResults] = useState<MvpPollResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [storedVote, setStoredVote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getMvpPollResults(pollId);
    setResults(r);
    setLoading(false);
  }, [pollId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    setStoredVote(getStoredVote(pollId));
  }, [load, pollId]);

  // Refrescar resultados cada 5s si la encuesta está abierta
  useEffect(() => {
    if (!results || results.poll.status !== "open" || storedVote) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [results, storedVote, load]);

  async function handleVote() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const fp = getOrCreateFingerprint();
    const { alreadyVoted } = await castMvpVote(pollId, selected, fp);
    if (alreadyVoted) {
      setError("Ya votaste en esta encuesta desde este dispositivo.");
    } else {
      storeVote(pollId, selected);
      setStoredVote(selected);
    }
    await load();
    setSubmitting(false);
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="skeleton h-64 max-w-md" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="page-shell">
        <div className="surface mx-auto max-w-md p-8 text-center">
          <p className="eyebrow mb-2">encuesta</p>
          <h1 className="text-2xl font-black text-fijo-900">No encontrada</h1>
          <p className="muted-copy mt-3 text-sm">
            Esta encuesta no existe o fue eliminada.
          </p>
        </div>
      </div>
    );
  }

  const { poll, totals, totalVotes, winners } = results;
  const isClosed = poll.status === "closed";
  const hasVoted = !!storedVote;

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <p className="eyebrow mb-1">{poll.groupName}</p>
          <h1 className="text-3xl font-black leading-tight text-fijo-900">
            MVP del partido
          </h1>
          <p className="muted-copy mt-1 text-sm">
            {formatDate(poll.matchDate)}
          </p>
        </header>

        {isClosed ? (
          <div className="surface p-6">
            <p className="eyebrow mb-3">resultado final</p>
            {winners.length > 0 ? (
              <>
                <p className="mb-4 text-lg font-black text-fijo-900">
                  {winners.length === 1 ? "MVP del partido" : "MVP compartido"}
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {winners.map((id) => {
                    const candidate = poll.candidates.find((c) => c.id === id);
                    return (
                      <span key={id} className="level-pill border border-fijo-300 bg-fijo-100 text-lg font-black text-fijo-900">
                        🏆 {candidate?.name ?? "???"}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mb-4 text-sm text-[var(--muted)]">Sin votos registrados.</p>
            )}
            <ResultBars candidates={poll.candidates} totals={totals} totalVotes={totalVotes} />
          </div>
        ) : hasVoted ? (
          <div className="surface p-6">
            <p className="mb-3 text-sm font-bold text-[var(--muted)]">Tu voto fue registrado</p>
            <p className="mb-4 text-lg font-black text-fijo-900">
              {poll.candidates.find((c) => c.id === storedVote)?.name ?? "???"}
            </p>
            <ResultBars candidates={poll.candidates} totals={totals} totalVotes={totalVotes} />
            <p className="mt-3 text-xs text-[var(--muted)]">
              Los resultados se actualizan en vivo · {totalVotes} votos
            </p>
          </div>
        ) : (
          <div className="surface p-6">
            <p className="mb-4 text-sm font-bold text-fijo-900">
              ¿Quién fue el mejor del partido?
            </p>
            <div className="mb-5 space-y-2">
              {poll.candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-bold transition-colors ${
                    selected === c.id
                      ? "border-fijo-600 bg-fijo-50 text-fijo-900"
                      : "border-fijo-200 bg-white text-fijo-900 hover:bg-fijo-50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected === c.id ? "border-fijo-600 bg-fijo-600" : "border-fijo-300"
                    }`}
                  >
                    {selected === c.id && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                  {c.name}
                </button>
              ))}
            </div>

            {error && <p className="mb-3 text-sm font-bold text-red-600">{error}</p>}

            <button
              onClick={handleVote}
              disabled={!selected || submitting}
              className="w-full rounded-lg bg-fijo-900 px-4 py-3 text-sm font-black text-white hover:bg-fijo-800 disabled:opacity-40"
            >
              {submitting ? "Enviando..." : "Confirmar voto"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultBars({
  candidates,
  totals,
  totalVotes,
}: {
  candidates: { id: string; name: string }[];
  totals: Record<string, number>;
  totalVotes: number;
}) {
  const max = totalVotes > 0 ? Math.max(...candidates.map((c) => totals[c.id] ?? 0)) : 0;

  return (
    <div className="space-y-3">
      {candidates.map((c) => {
        const count = totals[c.id] ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isWinner = count > 0 && count === max;
        return (
          <div key={c.id}>
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className={isWinner ? "text-fijo-900" : "text-[var(--muted)]"}>
                {isWinner && "🏆 "}
                {c.name}
              </span>
              <span className="text-[var(--muted)]">{count} {count === 1 ? "voto" : "votos"}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-fijo-100">
              <div
                className={`h-full rounded-full transition-all ${isWinner ? "bg-fijo-900" : "bg-fijo-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
