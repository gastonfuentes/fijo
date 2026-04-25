interface Props {
  candidates: { id: string; name: string }[];
  totals: Record<string, number>;
  totalVotes: number;
}

export default function MvpResultBars({ candidates, totals, totalVotes }: Props) {
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
