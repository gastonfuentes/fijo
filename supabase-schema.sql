-- Ejecutar este SQL en Supabase Dashboard > SQL Editor

-- Grupos (cada turno fijo es un grupo)
create table if not exists groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Miembros del grupo
create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);

-- Jugadores
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  level text not null check (level in ('bueno', 'tranqui', 'malo')),
  created_at timestamptz default now()
);

-- Partidos
create table if not exists match_days (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade,
  date date not null,
  attendees uuid[] not null default '{}',
  team_a uuid[] not null default '{}',
  team_b uuid[] not null default '{}',
  winner text check (winner in ('A', 'B')),
  created_at timestamptz default now()
);

-- Row Level Security (RLS)
alter table groups enable row level security;
alter table group_members enable row level security;
alter table players enable row level security;
alter table match_days enable row level security;

-- Solo los miembros del grupo pueden ver/modificar sus datos
create policy "members can view their groups"
  on groups for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
  );

create policy "authenticated users can create groups"
  on groups for insert
  with check (auth.uid() = owner_id);

create policy "owner can update group"
  on groups for update
  using (auth.uid() = owner_id);

create policy "owner can delete group"
  on groups for delete
  using (auth.uid() = owner_id);

-- group_members policies
create policy "members can view group membership"
  on group_members for select
  using (user_id = auth.uid());

create policy "owner can manage members"
  on group_members for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from groups where id = group_id and owner_id = auth.uid()
    )
  );

-- players policies
create policy "members can view players"
  on players for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "members can manage players"
  on players for insert
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "members can update players"
  on players for update
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "members can delete players"
  on players for delete
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
  );

-- match_days policies
create policy "members can view match days"
  on match_days for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "members can create match days"
  on match_days for insert
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "members can update match days"
  on match_days for update
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "members can delete match days"
  on match_days for delete
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  );
