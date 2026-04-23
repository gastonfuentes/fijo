import { createClient } from "./supabase";
import { Player, MatchDay, Group, GroupMember, SkillLevel } from "@/types";

type UserGroupRow = {
  groups: UserGroupRelation | UserGroupRelation[] | null;
};

type UserGroupRelation = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

type GroupMemberRow = {
  user_id: string;
  email: string;
  is_owner: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// ---- Groups ----

export async function createGroup(name: string): Promise<string> {
  const supabase = createClient();
  const groupName = name.trim();
  if (!groupName) throw new Error("El nombre del grupo es obligatorio.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Tenes que iniciar sesion para crear un grupo.");

  const groupId = globalThis.crypto.randomUUID();

  const { error: groupError } = await supabase
    .from("groups")
    .insert({ id: groupId, name: groupName, owner_id: user.id });
  if (groupError) throw groupError;

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: user.id });

  if (memberError) {
    await supabase.from("groups").delete().eq("id", groupId);
    throw memberError;
  }

  return groupId;
}

export async function syncUserProfile(userId: string, email: string) {
  const supabase = createClient();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      email: normalizedEmail,
    },
    {
      onConflict: "id",
    }
  );

  if (error) throw error;
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

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_group_members", {
    target_group_id: groupId,
  });

  if (error) throw error;

  return ((data ?? []) as GroupMemberRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    isOwner: row.is_owner,
  }));
}

export async function addGroupMemberByEmail(groupId: string, email: string) {
  const supabase = createClient();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("El correo es obligatorio.");

  const { error } = await supabase.rpc("add_group_member_by_email", {
    target_group_id: groupId,
    member_email: normalizedEmail,
  });

  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_group_member", {
    target_group_id: groupId,
    target_user_id: userId,
  });

  if (error) throw error;
}

export async function updateGroup(groupId: string, name: string) {
  const supabase = createClient();
  const groupName = name.trim();
  if (!groupName) throw new Error("El nombre del grupo es obligatorio.");

  const { error } = await supabase
    .from("groups")
    .update({ name: groupName })
    .eq("id", groupId)
    .select("id")
    .single();

  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .select("id")
    .single();

  if (error) throw error;
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
