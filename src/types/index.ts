export type SkillLevel = "bueno" | "tranqui" | "malo";

export interface Player {
  id: string;
  name: string;
  level: SkillLevel;
  photoURL?: string;
  createdAt: number;
  mvpCount: number;
  mvpVotesReceived: number;
}

export interface MatchDay {
  id: string;
  date: string; // ISO date string
  attendees: string[]; // player IDs
  teamA: string[];
  teamB: string[];
  winner: "A" | "B" | null;
  mvpPlayerIds: string[];
  createdAt: number;
}

export interface MvpPollCandidate {
  id: string;
  name: string;
}

export interface MvpPoll {
  id: string;
  matchDayId: string;
  groupId: string;
  groupName: string;
  matchDate: string; // ISO date
  candidates: MvpPollCandidate[];
  status: "open" | "closed";
  createdAt: number;
  closedAt: number | null;
}

export interface MvpPollResults {
  poll: MvpPoll;
  totals: Record<string, number>; // playerId -> vote count
  totalVotes: number;
  winners: string[]; // playerIds
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
