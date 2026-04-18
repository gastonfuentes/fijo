import { Player, SkillLevel } from "@/types";

/**
 * Sorteo balanceado: distribuye jugadores por nivel equitativamente
 * entre dos equipos, luego aleatoriza dentro de cada nivel.
 */
export function sorteoBalanceado(players: Player[]): { teamA: Player[]; teamB: Player[] } {
  const byLevel: Record<SkillLevel, Player[]> = {
    bueno: [],
    tranqui: [],
    malo: [],
  };

  // Agrupar por nivel
  for (const p of players) {
    byLevel[p.level].push(p);
  }

  const teamA: Player[] = [];
  const teamB: Player[] = [];

  // Para cada nivel, mezclar y repartir equitativamente
  for (const level of ["bueno", "tranqui", "malo"] as SkillLevel[]) {
    const shuffled = shuffle([...byLevel[level]]);

    for (let i = 0; i < shuffled.length; i++) {
      // Alternar: si un equipo tiene menos, va ahí
      if (teamA.length <= teamB.length) {
        teamA.push(shuffled[i]);
      } else {
        teamB.push(shuffled[i]);
      }
    }
  }

  return { teamA, teamB };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
