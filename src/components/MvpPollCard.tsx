"use client";

import { useState } from "react";
import { MvpPoll, MvpPollResults } from "@/types";
import { closeMvpPoll, deleteMvpPoll } from "@/lib/db";

interface Props {
  poll: MvpPoll;
  results: MvpPollResults;
  playerName: (id: string) => string;
  onPollUpdated: () => void;
}

export default function MvpPollCard({ poll, results, playerName, onPollUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const pollUrl = typeof window !== "undefined" ? `${window.location.origin}/votar/${poll.id}` : `/votar/${poll.id}`;

  async function handleClose() {
    if (!confirm("Cerrar la votación ahora?")) return;
    setLoading(true);
    try {
      await closeMvpPoll(poll.id);
      onPollUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo cerrar la encuesta");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminar la encuesta? Los votos se borrarán.")) return;
    setLoading(true);
    try {
      await deleteMvpPoll(poll.id);
      onPollUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar la encuesta");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(pollUrl);
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      `🏆 Votá al MVP del partido del ${formatDate(poll.matchDate)} — ${poll.groupName}:\n${pollUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  if (poll.status === "closed") {
    return (
      <div className="mt-4 rounded-lg border border-fijo-200 bg-fijo-50 p-4">
        <p className="mb-2 text-xs font-bold text-[var(--muted)]">encuesta MVP — cerrada</p>
        {results.winners.length > 0 ? (
          <>
            <p className="mb-3 text-lg font-black text-fijo-900">
              {results.winners.length === 1 ? "MVP del partido" : "MVP compartido"}
            </p>
            <div className="flex flex-wrap gap-2">
              {results.winners.map((id) => (
                <span key={id} className="level-pill border border-fijo-300 bg-white font-black text-fijo-900">
                  🏆 {playerName(id)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{results.totalVotes} votos en total</p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Sin votos registrados.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-fijo-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--muted)]">encuesta MVP — abierta</p>
        <span className="level-pill border border-green-200 bg-green-50 text-green-800">
          {results.totalVotes} votos
        </span>
      </div>

      <p className="mb-3 text-sm font-bold text-fijo-900">Candidatos:</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {poll.candidates.map((c) => (
          <span key={c.id} className="level-pill border border-fijo-200 bg-fijo-50 text-fijo-800">
            {c.name}
            {results.totals[c.id] ? ` · ${results.totals[c.id]}` : ""}
          </span>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={copyLink}
          className="flex-1 rounded-lg border border-fijo-200 px-3 py-2 text-xs font-bold text-fijo-800 hover:bg-fijo-50"
        >
          Copiar link
        </button>
        <button
          onClick={shareWhatsApp}
          className="flex-1 rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-black text-green-800 hover:bg-green-50"
        >
          Compartir WhatsApp
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleClose}
          disabled={loading}
          className="flex-1 rounded-lg bg-fijo-900 px-3 py-2 text-xs font-black text-white hover:bg-fijo-800 disabled:opacity-40"
        >
          {loading ? "Cerrando..." : "Cerrar votación"}
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
