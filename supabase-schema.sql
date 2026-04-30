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

-- Perfiles publicos minimos para resolver miembros por correo
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz default now()
);

create unique index if not exists user_profiles_email_key on user_profiles (email);

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
alter table user_profiles enable row level security;
alter table players enable row level security;
alter table match_days enable row level security;

-- Solo los miembros del grupo pueden ver/modificar sus datos
drop policy if exists "members can view their groups" on groups;
create policy "members can view their groups"
  on groups for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
    or exists (
      select 1 from group_observers go
      where go.group_id = groups.id
      and go.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated users can create groups" on groups;
create policy "authenticated users can create groups"
  on groups for insert
  with check (auth.uid() = owner_id);

drop policy if exists "owner can update group" on groups;
drop policy if exists "members can update group" on groups;
create policy "members can update group"
  on groups for update
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    or exists (
      select 1 from group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "owner can delete group" on groups;
drop policy if exists "members can delete group" on groups;
create policy "members can delete group"
  on groups for delete
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
  );

-- group_members policies
drop policy if exists "members can view group membership" on group_members;
create policy "members can view group membership"
  on group_members for select
  using (user_id = auth.uid());

drop policy if exists "owner can manage members" on group_members;
create policy "owner can manage members"
  on group_members for insert
  with check (
    exists (
      select 1 from groups where id = group_id and owner_id = auth.uid()
    )
  );

-- user_profiles policies
drop policy if exists "users can view own profile" on user_profiles;
create policy "users can view own profile"
  on user_profiles for select
  using (auth.uid() = id);

drop policy if exists "users can insert own profile" on user_profiles;
create policy "users can insert own profile"
  on user_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on user_profiles;
create policy "users can update own profile"
  on user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

insert into public.user_profiles (id, email)
select
  id,
  lower(email)
from auth.users
where email is not null
on conflict (id) do update
set email = excluded.email;

create or replace function public.sync_user_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    delete from public.user_profiles
    where id = new.id;

    return new;
  end if;

  insert into public.user_profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists sync_user_profile_from_auth_user on auth.users;
create trigger sync_user_profile_from_auth_user
after insert or update of email on auth.users
for each row
execute function public.sync_user_profile_from_auth_user();

create or replace function public.prevent_group_identity_changes()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'No se puede cambiar el id del grupo';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede transferir el owner del grupo';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_group_identity_changes on groups;
create trigger prevent_group_identity_changes
before update on groups
for each row
execute function public.prevent_group_identity_changes();

create or replace function public.enforce_group_member_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_member_count integer;
begin
  perform 1
  from public.groups
  where id = new.group_id
  for update;

  select count(*)
  into current_member_count
  from public.group_members
  where group_id = new.group_id;

  if current_member_count >= 3 then
    raise exception 'Este grupo ya tiene 3 usuarios';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_group_member_limit on group_members;
create trigger enforce_group_member_limit
before insert on group_members
for each row
execute function public.enforce_group_member_limit();

-- Crea un grupo y agrega al usuario autenticado como miembro en la misma operacion.
create or replace function public.create_group_with_owner_membership(group_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
  current_user_id uuid := auth.uid();
  normalized_group_name text := trim(coalesce(group_name, ''));
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if length(normalized_group_name) = 0 then
    raise exception 'El nombre del grupo es obligatorio';
  end if;

  insert into public.groups (name, owner_id)
  values (normalized_group_name, current_user_id)
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id)
  values (new_group_id, current_user_id);

  return new_group_id;
end;
$$;

revoke all on function public.create_group_with_owner_membership(text) from public;
grant execute on function public.create_group_with_owner_membership(text) to authenticated;

create or replace function public.get_group_members(target_group_id uuid)
returns table (
  user_id uuid,
  email text,
  is_owner boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'No tienes acceso a este grupo';
  end if;

  return query
  select
    gm.user_id,
    up.email,
    gm.user_id = g.owner_id as is_owner
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  join public.user_profiles up on up.id = gm.user_id
  where gm.group_id = target_group_id
  order by (gm.user_id = g.owner_id) desc, up.email asc;
end;
$$;

revoke all on function public.get_group_members(uuid) from public;
grant execute on function public.get_group_members(uuid) to authenticated;

create or replace function public.add_group_member_by_email(
  target_group_id uuid,
  member_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(trim(coalesce(member_email, '')));
  target_member_id uuid;
  current_member_count integer;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if target_group_id is null then
    raise exception 'Grupo invalido';
  end if;

  if length(normalized_email) = 0 then
    raise exception 'El correo es obligatorio';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'No tienes permisos para administrar este grupo';
  end if;

  select id
  into target_member_id
  from public.user_profiles
  where email = normalized_email;

  if target_member_id is null then
    raise exception 'Ese correo no tiene un usuario registrado en la app';
  end if;

  if exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = target_member_id
  ) then
    raise exception 'Ese usuario ya pertenece al grupo';
  end if;

  perform 1
  from public.groups
  where id = target_group_id
  for update;

  select count(*)
  into current_member_count
  from public.group_members gm
  where gm.group_id = target_group_id;

  if current_member_count >= 3 then
    raise exception 'Este grupo ya tiene 3 usuarios';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target_group_id, target_member_id);

  return target_member_id;
end;
$$;

revoke all on function public.add_group_member_by_email(uuid, text) from public;
grant execute on function public.add_group_member_by_email(uuid, text) to authenticated;

create or replace function public.remove_group_member(
  target_group_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  group_owner_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'No tienes permisos para administrar este grupo';
  end if;

  select owner_id
  into group_owner_id
  from public.groups
  where id = target_group_id;

  if group_owner_id is null then
    raise exception 'Grupo inexistente';
  end if;

  if target_user_id = group_owner_id then
    raise exception 'No se puede quitar al owner del grupo';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = target_user_id
  ) then
    raise exception 'Ese usuario no pertenece al grupo';
  end if;

  delete from public.group_members
  where public.group_members.group_id = target_group_id
    and public.group_members.user_id = target_user_id;
end;
$$;

revoke all on function public.remove_group_member(uuid, uuid) from public;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

-- players policies
drop policy if exists "members can view players" on players;
create policy "members can view players"
  on players for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
    or exists (
      select 1 from group_observers go
      where go.group_id = players.group_id
      and go.user_id = auth.uid()
    )
  );

drop policy if exists "members can manage players" on players;
create policy "members can manage players"
  on players for insert
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "members can update players" on players;
create policy "members can update players"
  on players for update
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = players.group_id
      and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "members can delete players" on players;
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
drop policy if exists "members can view match days" on match_days;
create policy "members can view match days"
  on match_days for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
    or exists (
      select 1 from group_observers go
      where go.group_id = match_days.group_id
      and go.user_id = auth.uid()
    )
  );

drop policy if exists "members can create match days" on match_days;
create policy "members can create match days"
  on match_days for insert
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "members can update match days" on match_days;
create policy "members can update match days"
  on match_days for update
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "members can delete match days" on match_days;
create policy "members can delete match days"
  on match_days for delete
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = match_days.group_id
      and group_members.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';

-- ============================================================
-- MVP POLLS: encuesta al mejor jugador del partido
-- ============================================================

-- Contadores acumulados por jugador
alter table players add column if not exists mvp_count int not null default 0;
alter table players add column if not exists mvp_votes_received int not null default 0;

-- MVPs del partido (array para soportar empate)
alter table match_days add column if not exists mvp_player_ids uuid[] not null default '{}';

-- Encuesta MVP: una por partido
create table if not exists mvp_polls (
  id uuid default gen_random_uuid() primary key,
  match_day_id uuid references match_days(id) on delete cascade unique,
  group_id uuid references groups(id) on delete cascade,
  group_name text not null,
  match_date date not null,
  candidates jsonb not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz default now(),
  closed_at timestamptz
);

-- Votos: un voto por (poll, fingerprint de dispositivo)
create table if not exists mvp_votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references mvp_polls(id) on delete cascade,
  player_id uuid not null,
  voter_fingerprint text not null,
  created_at timestamptz default now(),
  unique (poll_id, voter_fingerprint)
);

alter table mvp_polls enable row level security;
alter table mvp_votes enable row level security;

-- mvp_polls policies
drop policy if exists "anyone can view mvp polls" on mvp_polls;
create policy "anyone can view mvp polls"
  on mvp_polls for select using (true);

drop policy if exists "owner can create mvp polls" on mvp_polls;
drop policy if exists "members can create mvp polls" on mvp_polls;
create policy "members can create mvp polls"
  on mvp_polls for insert with check (
    exists (
      select 1 from group_members
      where group_members.group_id = mvp_polls.group_id
      and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "owner can update mvp polls" on mvp_polls;
drop policy if exists "members can update mvp polls" on mvp_polls;
create policy "members can update mvp polls"
  on mvp_polls for update using (
    exists (
      select 1 from group_members
      where group_members.group_id = mvp_polls.group_id
      and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "owner can delete mvp polls" on mvp_polls;
drop policy if exists "members can delete mvp polls" on mvp_polls;
create policy "members can delete mvp polls"
  on mvp_polls for delete using (
    exists (
      select 1 from group_members
      where group_members.group_id = mvp_polls.group_id
      and group_members.user_id = auth.uid()
    )
  );

-- mvp_votes policies
drop policy if exists "anyone can view votes" on mvp_votes;
create policy "anyone can view votes"
  on mvp_votes for select using (true);

drop policy if exists "anyone can vote on open polls" on mvp_votes;
create policy "anyone can vote on open polls"
  on mvp_votes for insert with check (
    exists (select 1 from mvp_polls where id = poll_id and status = 'open')
  );

-- RPC: cerrar encuesta + persistir MVP + incrementar contadores (atomico)
create or replace function public.close_mvp_poll(poll_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_match_day_id uuid;
  v_max int;
  v_winners uuid[];
begin
  select group_id, match_day_id
  into v_group_id, v_match_day_id
  from mvp_polls
  where id = close_mvp_poll.poll_id and status = 'open';

  if v_group_id is null then
    raise exception 'Encuesta no encontrada o ya cerrada';
  end if;

  if not exists (
    select 1 from group_members
    where group_members.group_id = v_group_id
    and group_members.user_id = auth.uid()
  ) then
    raise exception 'Solo los miembros del grupo pueden cerrar la encuesta';
  end if;

  -- Sumar votos recibidos a cada jugador candidato
  update players p
     set mvp_votes_received = mvp_votes_received + v.c
    from (
      select mv.player_id, count(*)::int as c
      from mvp_votes mv
      where mv.poll_id = close_mvp_poll.poll_id
      group by mv.player_id
    ) v
   where p.id = v.player_id;

  -- Determinar maximo de votos
  select coalesce(max(c), 0) into v_max
    from (
      select count(*)::int as c
      from mvp_votes mv
      where mv.poll_id = close_mvp_poll.poll_id
      group by mv.player_id
    ) s;

  if v_max > 0 then
    -- Ganadores: todos los que tienen el maximo (puede haber empate)
    select array_agg(player_id) into v_winners
      from (
        select mv.player_id, count(*)::int as c
        from mvp_votes mv
        where mv.poll_id = close_mvp_poll.poll_id
        group by mv.player_id
      ) s
     where s.c = v_max;

    update players set mvp_count = mvp_count + 1 where id = any(v_winners);
    update match_days set mvp_player_ids = v_winners where id = v_match_day_id;
  end if;

  update mvp_polls
     set status = 'closed', closed_at = now()
   where id = close_mvp_poll.poll_id;

  return coalesce(v_winners, array[]::uuid[]);
end;
$$;

revoke all on function public.close_mvp_poll(uuid) from public;
grant execute on function public.close_mvp_poll(uuid) to authenticated;

-- ============================================================
-- OBSERVADORES DE GRUPO: acceso de solo lectura por codigo publico
-- ============================================================

alter table groups add column if not exists public_code text;
alter table groups add column if not exists code_created_at timestamptz;
alter table groups add column if not exists saved_pairs jsonb not null default '[]';

create unique index if not exists groups_public_code_key on groups (public_code)
  where public_code is not null;

-- Observadores: usuarios logueados que pueden ver el grupo pero no editar
create table if not exists group_observers (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table group_observers enable row level security;

drop policy if exists "self or members can view observers" on group_observers;
create policy "self or members can view observers"
  on group_observers for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from group_members gm
      where gm.group_id = group_observers.group_id
      and gm.user_id = auth.uid()
    )
  );

drop policy if exists "self or members can remove observers" on group_observers;
create policy "self or members can remove observers"
  on group_observers for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from group_members gm
      where gm.group_id = group_observers.group_id
      and gm.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE bloqueados: solo via RPC security definer.

-- Genera o regenera el codigo publico del grupo. Cualquier miembro pleno puede hacerlo.
create or replace function public.generate_group_public_code(target_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  alphabet_length int := length(alphabet);
  candidate text;
  attempt int := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if target_group_id is null then
    raise exception 'Grupo invalido';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'No tienes permisos para administrar este grupo';
  end if;

  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * alphabet_length)::int, 1);
    end loop;

    if not exists (select 1 from public.groups where public_code = candidate) then
      exit;
    end if;

    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'No se pudo generar un codigo unico, intenta de nuevo';
    end if;
  end loop;

  update public.groups
    set public_code = candidate,
        code_created_at = now()
    where id = target_group_id;

  return candidate;
end;
$$;

revoke all on function public.generate_group_public_code(uuid) from public;
grant execute on function public.generate_group_public_code(uuid) to authenticated;

-- Revoca el codigo publico del grupo.
create or replace function public.revoke_group_public_code(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'No tienes permisos para administrar este grupo';
  end if;

  update public.groups
    set public_code = null,
        code_created_at = null
    where id = target_group_id;
end;
$$;

revoke all on function public.revoke_group_public_code(uuid) from public;
grant execute on function public.revoke_group_public_code(uuid) to authenticated;

-- Unirse a un grupo como observador usando su codigo publico.
create or replace function public.join_group_as_observer(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := upper(trim(coalesce(code, '')));
  target_group_id uuid;
begin
  if current_user_id is null then
    raise exception 'Tenes que iniciar sesion para unirte a un grupo';
  end if;

  if length(normalized_code) = 0 then
    raise exception 'El codigo es obligatorio';
  end if;

  select id into target_group_id
    from public.groups
    where public_code = normalized_code;

  if target_group_id is null then
    raise exception 'Codigo invalido o expirado';
  end if;

  if exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'Ya sos miembro pleno de este grupo';
  end if;

  insert into public.group_observers (group_id, user_id)
    values (target_group_id, current_user_id)
    on conflict (group_id, user_id) do nothing;

  return target_group_id;
end;
$$;

revoke all on function public.join_group_as_observer(text) from public;
grant execute on function public.join_group_as_observer(text) to authenticated;

-- Dejar de observar un grupo (uno mismo).
create or replace function public.leave_group_observer(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  delete from public.group_observers go
    where go.group_id = target_group_id
      and go.user_id = current_user_id;
end;
$$;

revoke all on function public.leave_group_observer(uuid) from public;
grant execute on function public.leave_group_observer(uuid) to authenticated;

-- Listar observadores de un grupo con email. Solo visible para miembros plenos.
create or replace function public.get_group_observers(target_group_id uuid)
returns table (
  user_id uuid,
  email text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'No tienes acceso a este grupo';
  end if;

  return query
  select
    go.user_id,
    up.email,
    go.created_at
  from public.group_observers go
  join public.user_profiles up on up.id = go.user_id
  where go.group_id = target_group_id
  order by go.created_at asc;
end;
$$;

revoke all on function public.get_group_observers(uuid) from public;
grant execute on function public.get_group_observers(uuid) to authenticated;

-- Quitar a un observador especifico (cualquier miembro pleno puede).
create or replace function public.remove_group_observer(
  target_group_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
  ) then
    raise exception 'No tienes permisos para administrar este grupo';
  end if;

  delete from public.group_observers go
    where go.group_id = target_group_id
      and go.user_id = target_user_id;
end;
$$;

revoke all on function public.remove_group_observer(uuid, uuid) from public;
grant execute on function public.remove_group_observer(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
