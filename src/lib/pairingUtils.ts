import type { MvpFormData } from "@/types";

export function suggestPairs(
  presentPlayerIds: Set<string>,
  savedPairs: Array<[string, string]>,
  lastMatchDay: { teamA: string[]; teamB: string[] } | null,
  mvpForm: MvpFormData
): Array<[string, string]> {
  // 1. Pares guardados donde ambos jugadores están presentes hoy
  const fromSaved = savedPairs.filter(
    ([a, b]) => presentPlayerIds.has(a) && presentPlayerIds.has(b)
  );
  if (fromSaved.length > 0) return fromSaved;

  // 2. Deriva del último partido: enfrentar jugadores que jugaron en equipos distintos
  if (lastMatchDay) {
    const presentA = lastMatchDay.teamA.filter((id) => presentPlayerIds.has(id));
    const presentB = lastMatchDay.teamB.filter((id) => presentPlayerIds.has(id));
    const used = new Set<string>();
    const fromMatch: Array<[string, string]> = [];
    for (const a of presentA) {
      if (used.has(a)) continue;
      for (const b of presentB) {
        if (used.has(b)) continue;
        fromMatch.push([a, b]);
        used.add(a);
        used.add(b);
        break;
      }
    }
    if (fromMatch.length > 0) return fromMatch;
  }

  // 3. MVP-based: empareja al de más votos con el de menos votos
  const sorted = [...presentPlayerIds].sort(
    (a, b) => (mvpForm.totals[b] ?? 0) - (mvpForm.totals[a] ?? 0)
  );
  if (sorted.length < 2) return [];
  const topScore = mvpForm.totals[sorted[0]] ?? 0;
  if (topScore === 0) return [];
  const topPlayers = sorted.filter((id) => (mvpForm.totals[id] ?? 0) === topScore);
  const remaining = sorted.filter((id) => !topPlayers.includes(id));
  const used = new Set<string>();
  const mvpPairs: Array<[string, string]> = [];
  for (const top of topPlayers) {
    if (used.has(top)) continue;
    const partner = remaining.find((id) => !used.has(id));
    if (!partner) break;
    mvpPairs.push([top, partner]);
    used.add(top);
    used.add(partner);
  }
  return mvpPairs;
}
