import { createClient } from "./supabase";
import { Player, MatchDay, Group, GroupMember, GroupObserver, SkillLevel, MvpPoll, MvpPollResults, MvpPollCandidate, MvpFormData } from "@/types";

type UserGroupRow = {
  groups: UserGroupRelation | UserGroupRelation[] | null;
};

type UserGroupRelation = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  public_code: string | null;
};

type GroupMemberRow = {
  user_id: string;
  email: string;
  is_owner: boolean;
};

type GroupObserverRow = {
  user_id: string;
  email: string;
  created_at: string;
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

  const [memberRes, observerRes] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id, groups(id, name, owner_id, created_at, public_code)")
      .eq("user_id", userId),
    supabase
      .from("group_observers")
      .select("group_id, groups(id, name, owner_id, created_at, public_code)")
      .eq("user_id", userId),
  ]);

  if (memberRes.error) throw memberRes.error;
  if (observerRes.error) throw observerRes.error;

  const groups: Group[] = [];
  const seen = new Set<string>();

  const memberRows = (memberRes.data ?? []) as unknown as UserGroupRow[];
  for (const row of memberRows) {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    if (!group || seen.has(group.id)) continue;
    seen.add(group.id);
    groups.push({
      id: group.id,
      name: group.name,
      ownerId: group.owner_id,
      memberIds: [],
      createdAt: new Date(group.created_at).getTime(),
      role: group.owner_id === userId ? "owner" : "member",
      publicCode: group.public_code,
    });
  }

  const observerRows = (observerRes.data ?? []) as unknown as UserGroupRow[];
  for (const row of observerRows) {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    if (!group || seen.has(group.id)) continue;
    seen.add(group.id);
    groups.push({
      id: group.id,
      name: group.name,
      ownerId: group.owner_id,
      memberIds: [],
      createdAt: new Date(group.created_at).getTime(),
      role: "observer",
      publicCode: null,
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

// ---- Group observers (acceso de solo lectura por codigo) ----

export async function generateGroupPublicCode(groupId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("generate_group_public_code", {
    target_group_id: groupId,
  });
  if (error) throw error;
  return data as string;
}

export async function revokeGroupPublicCode(groupId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("revoke_group_public_code", {
    target_group_id: groupId,
  });
  if (error) throw error;
}

export async function joinGroupAsObserver(code: string): Promise<string> {
  const supabase = createClient();
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error("El codigo es obligatorio.");

  const { data, error } = await supabase.rpc("join_group_as_observer", {
    code: normalized,
  });
  if (error) throw error;
  return data as string;
}

export async function leaveGroupObserver(groupId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("leave_group_observer", {
    target_group_id: groupId,
  });
  if (error) throw error;
}

export async function getGroupObservers(groupId: string): Promise<GroupObserver[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_group_observers", {
    target_group_id: groupId,
  });
  if (error) throw error;

  return ((data ?? []) as GroupObserverRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function removeGroupObserver(groupId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_group_observer", {
    target_group_id: groupId,
    target_user_id: userId,
  });
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
    mvpCount: row.mvp_count ?? 0,
    mvpVotesReceived: row.mvp_votes_received ?? 0,
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
    mvpPlayerIds: row.mvp_player_ids ?? [],
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function getMatchDayById(
  matchDayId: string
): Promise<(MatchDay & { groupId: string }) | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("match_days")
    .select("*")
    .eq("id", matchDayId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    groupId: data.group_id,
    date: data.date,
    attendees: data.attendees ?? [],
    teamA: data.team_a ?? [],
    teamB: data.team_b ?? [],
    winner: data.winner as "A" | "B" | null,
    mvpPlayerIds: data.mvp_player_ids ?? [],
    createdAt: new Date(data.created_at).getTime(),
  };
}

export async function updateMatchDay(
  groupId: string,
  matchDayId: string,
  data: Partial<MatchDay>
) {
  const supabase = createClient();
  const update: Record<string, unknown> = {};
  if (data.winner !== undefined) update.winner = data.winner;
  if (data.date) update.date = data.date;
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

// ---- MVP Polls ----

function rowToMvpPoll(row: Record<string, unknown>): MvpPoll {
  return {
    id: row.id as string,
    matchDayId: row.match_day_id as string,
    groupId: row.group_id as string,
    groupName: row.group_name as string,
    matchDate: row.match_date as string,
    candidates: row.candidates as MvpPollCandidate[],
    status: row.status as "open" | "closed",
    createdAt: new Date(row.created_at as string).getTime(),
    closedAt: row.closed_at ? new Date(row.closed_at as string).getTime() : null,
  };
}

export async function createMvpPoll(
  groupId: string,
  matchDayId: string,
  groupName: string,
  matchDate: string,
  candidates: MvpPollCandidate[]
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mvp_polls")
    .insert({ group_id: groupId, match_day_id: matchDayId, group_name: groupName, match_date: matchDate, candidates })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getMvpPollsByGroup(groupId: string): Promise<MvpPoll[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mvp_polls")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []).map((row) => rowToMvpPoll(row as Record<string, unknown>));
}

export async function getMvpPollById(pollId: string): Promise<MvpPoll | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mvp_polls")
    .select("*")
    .eq("id", pollId)
    .single();
  if (error) return null;
  return rowToMvpPoll(data as Record<string, unknown>);
}

export async function getMvpPollByMatchDay(
  matchDayId: string
): Promise<MvpPoll | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mvp_polls")
    .select("*")
    .eq("match_day_id", matchDayId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToMvpPoll(data as Record<string, unknown>);
}

export async function getMvpPollResults(pollId: string): Promise<MvpPollResults | null> {
  const supabase = createClient();
  const [pollRes, votesRes] = await Promise.all([
    supabase.from("mvp_polls").select("*").eq("id", pollId).single(),
    supabase.from("mvp_votes").select("player_id").eq("poll_id", pollId),
  ]);
  if (pollRes.error || !pollRes.data) return null;

  const poll = rowToMvpPoll(pollRes.data as Record<string, unknown>);
  const votes = votesRes.data ?? [];

  const totals: Record<string, number> = {};
  for (const v of votes) {
    totals[v.player_id] = (totals[v.player_id] ?? 0) + 1;
  }

  const totalVotes = votes.length;
  const maxVotes = totalVotes > 0 ? Math.max(...Object.values(totals)) : 0;
  const winners = maxVotes > 0 ? Object.keys(totals).filter((id) => totals[id] === maxVotes) : [];

  return { poll, totals, totalVotes, winners };
}

export async function getRecentMvpForm(
  groupId: string,
  windowSize = 4
): Promise<MvpFormData> {
  const supabase = createClient();

  const [pollsRes, lastMvpMatchRes] = await Promise.all([
    supabase
      .from("mvp_polls")
      .select("id, candidates")
      .eq("group_id", groupId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(windowSize),
    supabase
      .from("match_days")
      .select("mvp_player_ids")
      .eq("group_id", groupId)
      .not("mvp_player_ids", "is", null)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const lastMvpRow = lastMvpMatchRes.data?.[0] as { mvp_player_ids: string[] | null } | undefined;
  const lastMatchMvpIds = (lastMvpRow?.mvp_player_ids ?? []).filter((id): id is string => typeof id === "string");

  const polls = (pollsRes.data ?? []) as Array<{ id: string; candidates: MvpPollCandidate[] | null }>;
  if (polls.length === 0) {
    return { totals: {}, candidatePlayerIds: [], lastMatchMvpIds, pollsCount: 0 };
  }

  const pollIds = polls.map((p) => p.id);
  const candidateIdSet = new Set<string>();
  for (const poll of polls) {
    for (const c of poll.candidates ?? []) {
      if (c?.id) candidateIdSet.add(c.id);
    }
  }

  const votesRes = await supabase
    .from("mvp_votes")
    .select("player_id")
    .in("poll_id", pollIds);

  const totals: Record<string, number> = {};
  for (const v of votesRes.data ?? []) {
    const pid = (v as { player_id: string }).player_id;
    totals[pid] = (totals[pid] ?? 0) + 1;
  }

  return {
    totals,
    candidatePlayerIds: Array.from(candidateIdSet),
    lastMatchMvpIds,
    pollsCount: polls.length,
  };
}

export async function closeMvpPoll(pollId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("close_mvp_poll", { poll_id: pollId });
  if (error) throw error;
  return (data as string[]) ?? [];
}

export async function deleteMvpPoll(pollId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("mvp_polls").delete().eq("id", pollId);
  if (error) throw error;
}

export async function castMvpVote(
  pollId: string,
  playerId: string,
  voterFingerprint: string
): Promise<{ alreadyVoted: boolean }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("mvp_votes")
    .insert({ poll_id: pollId, player_id: playerId, voter_fingerprint: voterFingerprint });

  if (error) {
    if (error.code === "23505") return { alreadyVoted: true };
    throw error;
  }
  return { alreadyVoted: false };
}

export async function getMvpPollResultsByMatchDay(
  matchDayId: string
): Promise<MvpPollResults | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mvp_polls")
    .select("id")
    .eq("match_day_id", matchDayId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getMvpPollResults(data.id as string);
}

export async function getSavedPairs(
  groupId: string
): Promise<Array<[string, string]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("saved_pairs")
    .eq("id", groupId)
    .single();
  if (error) throw error;
  return (data?.saved_pairs ?? []) as Array<[string, string]>;
}

export async function savePairs(
  groupId: string,
  pairs: Array<[string, string]>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("groups")
    .update({ saved_pairs: pairs })
    .eq("id", groupId);
  if (error) throw error;
}
