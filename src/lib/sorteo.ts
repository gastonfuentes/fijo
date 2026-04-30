import { Player, SkillLevel } from "@/types";

/**
 * Sorteo balanceado: distribuye jugadores por nivel equitativamente
 * entre dos equipos, luego aleatoriza dentro de cada nivel.
 *
 * Si se pasan `pairs` (enfrentamientos manuales), garantiza que los
 * dos miembros de cada par caigan en equipos distintos. Para cada par,
 * elige la asignacion que mejor balancea los niveles globales y sortea
 * en caso de empate. Los jugadores fuera de cualquier par se reparten
 * con la logica clasica.
 */
export function sorteoBalanceado(
  players: Player[],
  pairs?: Array<[string, string]>
): { teamA: Player[]; teamB: Player[] } {
  const teamA: Player[] = [];
  const teamB: Player[] = [];
  const playersById = new Map(players.map((p) => [p.id, p]));
  const pairedIds = new Set<string>();

  if (pairs && pairs.length > 0) {
    const shuffledPairs = shuffle([...pairs]);
    for (const [idA, idB] of shuffledPairs) {
      const pa = playersById.get(idA);
      const pb = playersById.get(idB);
      if (!pa || !pb) continue;
      pairedIds.add(idA);
      pairedIds.add(idB);

      const wA = teamWeight(teamA);
      const wB = teamWeight(teamB);
      const wPa = levelWeight(pa.level);
      const wPb = levelWeight(pb.level);

      const diffOption1 = Math.abs((wA + wPa) - (wB + wPb)); // pa->A, pb->B
      const diffOption2 = Math.abs((wA + wPb) - (wB + wPa)); // pa->B, pb->A

      let paToA: boolean;
      if (diffOption1 < diffOption2) paToA = true;
      else if (diffOption2 < diffOption1) paToA = false;
      else paToA = Math.random() < 0.5;

      if (paToA) {
        teamA.push(pa);
        teamB.push(pb);
      } else {
        teamA.push(pb);
        teamB.push(pa);
      }
    }
  }

  const unpaired = players.filter((p) => !pairedIds.has(p.id));

  const byLevel: Record<SkillLevel, Player[]> = {
    bueno: [],
    tranqui: [],
    malo: [],
  };

  for (const p of unpaired) {
    byLevel[p.level].push(p);
  }

  for (const level of ["bueno", "tranqui", "malo"] as SkillLevel[]) {
    const shuffled = shuffle([...byLevel[level]]);

    for (let i = 0; i < shuffled.length; i++) {
      if (teamA.length <= teamB.length) {
        teamA.push(shuffled[i]);
      } else {
        teamB.push(shuffled[i]);
      }
    }
  }

  return { teamA, teamB };
}

function levelWeight(level: SkillLevel): number {
  if (level === "bueno") return 3;
  if (level === "tranqui") return 2;
  return 1;
}

function teamWeight(team: Player[]): number {
  return team.reduce((sum, p) => sum + levelWeight(p.level), 0);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
