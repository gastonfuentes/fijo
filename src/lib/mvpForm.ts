import type { MvpFormData, MvpFormLevel } from "@/types";

export interface MvpFormDecision {
  level: MvpFormLevel | null;
  isLastMatchMvp: boolean;
}

export function computeMvpForm(playerId: string, data: MvpFormData): MvpFormDecision {
  const isLastMatchMvp = data.lastMatchMvpIds.includes(playerId);

  if (data.pollsCount === 0) {
    return { level: null, isLastMatchMvp };
  }

  const wasCandidate = data.candidatePlayerIds.includes(playerId);
  if (!wasCandidate) {
    return { level: null, isLastMatchMvp };
  }

  const myVotes = data.totals[playerId] ?? 0;

  if (myVotes === 0) {
    return { level: "bad", isLastMatchMvp };
  }

  const playersAbove = Object.values(data.totals).filter((v) => v > myVotes).length;
  const position = playersAbove + 1;

  if (position === 1) return { level: "excellent", isLastMatchMvp };
  if (position === 2) return { level: "good", isLastMatchMvp };
  if (position === 3) return { level: "normal", isLastMatchMvp };
  return { level: "poor", isLastMatchMvp };
}
