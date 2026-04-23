export type SkillLevel = "bueno" | "tranqui" | "malo";

export interface Player {
  id: string;
  name: string;
  level: SkillLevel;
  photoURL?: string;
  createdAt: number;
}

export interface MatchDay {
  id: string;
  date: string; // ISO date string
  attendees: string[]; // player IDs
  teamA: string[];
  teamB: string[];
  winner: "A" | "B" | null; // null = no se jugó o no se registró
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

export interface GroupMember {
  userId: string;
  email: string;
  isOwner: boolean;
}

export interface PlayerStats {
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  attendance: number;
  absences: number;
}
