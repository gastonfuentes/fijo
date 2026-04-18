import { createClient } from "./supabase";
import { Player, MatchDay, Group, SkillLevel } from "@/types";

type UserGroupRow = {
  groups: UserGroupRelation | UserGroupRelation[] | null;
};

type UserGroupRelation = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

// ---- Groups ----

export async function createGroup(name: string, ownerId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, owner_id: ownerId })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("group_members").insert({ group_id: data.id, user_id: ownerId });
  return data.id;
}

export async function getUserGroups(userId: string): Promise<Group[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name, owner_id, created_at)")
    .eq("user_id", userId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as UserGroupRow[];
  const groups: Group[] = [];

  for (const row of rows) {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    if (!group) continue;

    groups.push({
      id: group.id,
      name: group.name,
      ownerId: group.owner_id,
      memberIds: [],
      createdAt: new Date(group.created_at).getTime(),
    });
  }

  return groups;
}

// ---- Players ----

export async function addPlayer(
  groupId: string,
  name: string,
  level: SkillLevel
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("players")
    .insert({ group_id: groupId, name, level })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getPlayers(groupId: string): Promise<Player[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("group_id", groupId)
    .order("name");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level as SkillLevel,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function updatePlayer(
  groupId: string,
  playerId: string,
  data: Partial<Pick<Player, "name" | "level">>
) {
  const supabase = createClient();
  const update: Record<string, string> = {};
  if (data.name) update.name = data.name;
  if (data.level) update.level = data.level;
  const { error } = await supabase
    .from("players")
    .update(update)
    .eq("id", playerId)
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function deletePlayer(groupId: string, playerId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId)
    .eq("group_id", groupId);
  if (error) throw error;
}

// ---- Match Days ----

export async function createMatchDay(
  groupId: string,
  data: Omit<MatchDay, "id">
): Promise<string> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("match_days")
    .insert({
      group_id: groupId,
      date: data.date,
      attendees: data.attendees,
      team_a: data.teamA,
      team_b: data.teamB,
      winner: data.winner,
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function getMatchDays(groupId: string): Promise<MatchDay[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("match_days")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    attendees: row.attendees ?? [],
    teamA: row.team_a ?? [],
    teamB: row.team_b ?? [],
    winner: row.winner as "A" | "B" | null,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function updateMatchDay(
  groupId: string,
  matchDayId: string,
  data: Partial<MatchDay>
) {
  const supabase = createClient();
  const update: Record<string, unknown> = {};
  if (data.winner !== undefined) update.winner = data.winner;
  if (data.attendees) update.attendees = data.attendees;
  if (data.teamA) update.team_a = data.teamA;
  if (data.teamB) update.team_b = data.teamB;

  const { error } = await supabase
    .from("match_days")
    .update(update)
    .eq("id", matchDayId)
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function deleteMatchDay(groupId: string, matchDayId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("match_days")
    .delete()
    .eq("id", matchDayId)
    .eq("group_id", groupId);
  if (error) throw error;
}
