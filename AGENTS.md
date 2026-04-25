<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# fijo

`fijo` is a Next.js app for organizing recurring amateur football matches with a fixed group of friends.

## Current Checkpoint

- Active feature branch: `feat/dashboard-last-match-mvp` — below the player stats table in `/dashboard`, two cards (`lg:grid-cols-2`) that **always reference the same match** (`matchDays[0]`). Left card shows date, attendees, and both rosters as pill badges (local `TeamColumn`): the winning team is visually highlighted (border + tint), MVP players carry a 👑 inline. Right card calls `getMvpPollResultsByMatchDay(matchDayId)` and handles three states: no poll, open poll ("Votación en curso" badge + partial bars + link to `/votar/[pollId]`), or closed poll (winner badges + final `MvpResultBars`). Data sources: `getMatchDays(groupId)` for the match, `getMvpPollResultsByMatchDay(matchDayId)` (new helper) for the poll. The previous inline `ResultBars` from `/votar/[pollId]/page.tsx` was extracted to `src/components/MvpResultBars.tsx` and is now used by both routes. No schema changes.
- Previous shipped feature: `feat/mvp-form-arrows` — PES-style form arrows; merged to `main`.
- Schema state: `supabase-schema.sql` is idempotent. New in this branch: columns `public_code` and `code_created_at` on `groups`, new table `group_observers`, and RPCs `generate_group_public_code`, `revoke_group_public_code`, `join_group_as_observer`, `leave_group_observer`, `get_group_observers`, `remove_group_observer`. SELECT policies on `groups`, `players` and `match_days` now permit both full members (`group_members`) and observers (`group_observers`). INSERT/UPDATE/DELETE policies still require `group_members` only — observers cannot edit. `mvp_polls` RLS policies check `group_members` membership; the `close_mvp_poll` RPC validates membership via `group_members` and returns `'Solo los miembros del grupo pueden cerrar la encuesta'` when the caller is not a member.

The product flow is:

1. Sign in with Google through Supabase Auth.
2. Create a football group, join one where the user was added by email, or observe one via a public code.
3. Select the active group and distinguish owned groups, shared groups, and observed (read-only) groups.
4. Manage group names, members, or delete groups that are no longer used.
5. Add players to the group.
6. Select today's attendees and quickly mark the best players for that match.
7. Generate two balanced teams.
8. Share the sorted teams through WhatsApp or copy the message to send it manually.
9. Save the match day and later register the winner.
10. Alternatively, load a past match manually from `/partidos/nuevo`: pick a date, assign each player to Team A, Team B, or Absent, and optionally set the winner in one step.
11. Optionally create an MVP poll: pick 3–4 candidate players, share the public voting link via WhatsApp, let anyone vote (one vote per device), then close the poll to persist the winner.
12. Review attendance, result, and MVP stats in the dashboard.
13. Share a read-only link: from `/grupos`, any full member can generate an 8-char public code and share it via WhatsApp. Other logged-in users paste the code to join as observers and see only the dashboard.

Current `/sorteo` behavior:

- All players start deselected by default for each match day.
- The user marks attendees manually, one by one, before running the draw.
- The user can also create a new player directly from `/sorteo` for faster match-day setup.
- Players created from `/sorteo` are stored as `tranqui` and auto-selected as present for that match.
- "Best player" quick marks only apply to players currently marked as present.
- `match_days.attendees` stores only the players selected for that day.
- Once teams are sorted, the user can share the result through WhatsApp or copy the same message manually.

Current `/grupos` behavior:

- A group can have up to 3 full app users (`group_members`) plus unlimited observers (`group_observers`).
- Members are added by email only if that user already signed into the app at least once.
- Owned groups, invited groups, and observed groups are shown together in the UI with clear role badges (`owner` / `miembro` / `observador`).
- Any full group member can rename the group, delete it, manage non-owner members, generate/regenerate/revoke the public code, and remove observers.
- The original `owner_id` remains fixed as the technical owner and cannot be transferred or removed in the app.
- Observers can only see `/dashboard` and `/grupos`. `RequireEditor` redirects observers hitting `/jugadores`, `/partidos`, `/partidos/nuevo` or `/sorteo` to `/dashboard`. The Navbar hides editor-only links when `isReadOnly` is true.
- Observers can leave the group on their own from `/grupos`; that only removes their row from `group_observers` and does not affect the group.

## Stack

- Next.js `16.2.4` with App Router and TypeScript.
- React `19.2.4`.
- Tailwind CSS v4 through `@tailwindcss/postcss`.
- Supabase for Google OAuth, PostgreSQL, and Row Level Security.

## Commands

```bash
npm run dev
npm run build
npm run lint
```

Run `npm run build` before shipping structural changes when feasible. Use `npm run lint` for focused UI or TypeScript edits.

## Git and Publishing

- `main` is the production branch.
- `codex` is the working branch for agent changes and preview deployments.
- Every new feature starts from a dedicated branch created from the latest local `main`.
- When asked to publish changes, commit and push the requested branch only. Do not open pull requests automatically; the owner creates PRs manually.
- Keep local agent/tooling files such as `.codex/` and `.mcp.json` out of commits unless the owner explicitly asks to version them.
- Update `AGENTS.md` and `CLAUDE.md` whenever a relevant product flow, technical constraint, or delivery convention changes.

## Project Structure

```text
src/
  app/
    page.tsx              Login and authenticated redirect.
    auth/callback/        Google OAuth callback page.
    dashboard/            Group stats and ranking.
    grupos/               List, rename, delete, and manage shared members.
    jugadores/            Player CRUD.
    sorteo/               Attendee selection, quick best-player checks, and balanced team draw.
    partidos/             Saved match days, winners, deletion, and MVP poll management.
    partidos/nuevo/       Manual match entry: arbitrary date, per-player A/B assignment, optional winner.
    votar/[pollId]/       Public MVP voting page (no login required).
  components/
    Navbar.tsx
    ProtectedRoute.tsx
    RequireEditor.tsx     Redirects to /dashboard when the active group is observed (read-only).
    GroupSetup.tsx
  contexts/
    AuthContext.tsx       Supabase Auth session state.
    GroupContext.tsx      Active group state.
  lib/
    supabase.ts           Browser Supabase client.
    db.ts                 Supabase data access helpers.
    sorteo.ts             Balanced draw algorithm.
  types/index.ts          Shared domain types.
```

## Domain Model

- `SkillLevel`: `bueno`, `tranqui`, `malo`.
- `Player`: a player belongs to a group and has a stored skill level for compatibility.
- `Group`: a recurring football group owned by a Supabase auth user.
- `MatchDay`: one saved match with attendees, `teamA`, `teamB`, optional winner, and optional `mvp_player_ids`. Can be created through the `/sorteo` balanced draw or manually via `/partidos/nuevo` with an arbitrary past date and per-player A/B assignment.
- `MvpPoll`: one poll per match day with `candidates` (jsonb), `status` (`open`/`closed`), and a unique voting link at `/votar/[pollId]`.
- `MvpFormData` / `MvpFormLevel`: derived signal of recent player form, computed client-side from the last 4 closed MVP polls of the active group plus the MVP of the most recent match. Used to render colored arrows next to player names. See `src/lib/mvpForm.ts` for the ranking rules: top 1 in votes → excellent (↑ blue), top 2 → good (↗ green), top 3 → normal (→ yellow), positions 4+ with votes → poor (↘ orange), candidates with 0 votes in the window → bad (↓ gray), players that were never candidates in the window → no arrow. Ties share position and skip the next position(s) tournament-style. Being on `match_days.mvp_player_ids` of the most recent match adds an extra 👑 badge alongside whatever arrow the player has.
- `PlayerStats`: dashboard-only derived stats, computed from players and match days.

The balanced draw lives in `src/lib/sorteo.ts`. It groups players by level, shuffles each level, then alternates players into the smaller team so skill levels are spread across both teams. The current UI does not ask for a level when adding a player; new players are stored as `tranqui`, and `/sorteo` temporarily marks checked best players as `bueno` before calling the draw. On `/sorteo`, presence is a temporary per-match selection: players start as absent, attendees are selected manually, newly created players can be added inline and auto-selected as present, and removing a player from the attendee list must also remove any temporary "bueno" mark for that match.

## Supabase

The schema is in `supabase-schema.sql`.

Tables:

- `groups` (includes `public_code text unique`, `code_created_at timestamptz`)
- `group_members` (full members; max 3 per group enforced by `enforce_group_member_limit` trigger)
- `group_observers` (read-only observers; unlimited per group; INSERT only via RPC `join_group_as_observer`)
- `user_profiles`
- `players` (includes `mvp_count`, `mvp_votes_received`)
- `match_days` (includes `mvp_player_ids uuid[]`)
- `mvp_polls` (one per match day; RLS: select public, insert/update/delete members only)
- `mvp_votes` (one per `poll_id + voter_fingerprint`; insert allowed on open polls without login)

All tables use RLS. Data access should go through `src/lib/db.ts` unless there is a strong reason to add a new helper.

Group creation is handled in `src/lib/db.ts` with the authenticated Supabase browser user: generate the group UUID client-side, insert into `groups`, then insert the owner into `group_members`. Do not make the app depend on a PostgREST RPC for this flow unless the matching SQL function is deployed and verified in Supabase.

Required public environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not add Supabase service-role keys to frontend code or public deployment environments.

## Deployment

Vercel is the preferred deployment target for this Next.js app. Configure `main` as the production branch and use branches such as `codex` for previews.

Required Vercel environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Recommended platform/runtime variable:

```bash
NODE_VERSION=22
```

Supabase Auth must allow the deployed callback URL:

```text
https://<production-domain>/auth/callback
http://localhost:3000/auth/callback
```

For Vercel previews, add an appropriate preview redirect URL pattern in Supabase Auth if OAuth login should work on preview deployments.

## Implementation Notes

- Most route components are client components because auth, routing, and Supabase browser state are client-side today.
- Keep route protection consistent with `ProtectedRoute`.
- Wrap any editable page (one that mutates group data) with `RequireEditor` so observed groups get redirected to `/dashboard`. Read-only pages like `/dashboard` and `/grupos` do not need it — they must render correctly for observers but hide edit actions when `GroupContext.isReadOnly` is true.
- Keep group-dependent pages wrapped with `GroupSetup` and render the main page content only when `activeGroup` exists.
- Group membership by email depends on `user_profiles` plus SQL functions in `supabase-schema.sql`; the schema also backfills/syncs `user_profiles` from `auth.users`, and the frontend keeps the client-side sync as a compatible fallback. The member-management functions must keep all `group_members` column references qualified (`gm.user_id`, etc.) to avoid PL/pgSQL ambiguity with output-column names. Keep this flow browser-safe and do not add service-role keys to the frontend.
- In `/sorteo`, preserve the current interaction model: default attendance is empty, `selected` is the source of truth for attendees, best-player toggles must stay disabled for absent players, and quick-created players should be added as `tranqui` and marked present immediately.
- In `/sorteo`, any share action must use the currently sorted teams only and must not introduce extra persistence in Supabase.
- Preserve the Spanish UI copy and the informal football vocabulary already used in the app.
- Prefer the existing `@/` import alias and local domain types from `src/types`.
- Do not bypass RLS assumptions by adding service-role logic to the frontend.
- Before changing Next.js conventions, routing, metadata, layouts, server/client boundaries, or build config, read the matching guide under `node_modules/next/dist/docs/`.
- The MVP poll voting page (`/votar/[pollId]`) is intentionally public: it must not require login and must not use auth-gated Supabase calls. Votes are inserted with the anon key; RLS on `mvp_votes` allows insert only when the referenced poll is `open`.
- Closing an MVP poll must go through the RPC `close_mvp_poll(poll_id)` — never replicate that logic client-side. The RPC is `security definer` and checks that the caller is a member of the group via `group_members` (not the original `owner_id`).
- Managing an MVP poll (create, close, delete) is allowed for any member of the group. Do not gate these actions with client-side owner checks; the RLS/RPC membership check is the source of truth. The `GroupContext` only exposes groups where the user is a member, so UI buttons are naturally scoped.
- In case of a tie, all top-vote players become MVP (`mvp_player_ids` is an array for this reason). Increment `mvp_count` for each winner.
- Public group codes are 8 chars from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I). Generation/revocation is through security-definer RPCs that require `group_members` membership — do not write directly to `groups.public_code` from the client.
- Joining as observer is only via RPC `join_group_as_observer(code)`. The RPC rejects callers that are already full members of the group. Do not add a fallback that inserts directly into `group_observers` from the client; the RLS intentionally blocks INSERT there.
- When adding new tables that store group-scoped data, extend their SELECT RLS to permit both `group_members` AND `group_observers` lookups, mirroring the pattern used in `players`, `match_days`, and `groups`. INSERT/UPDATE/DELETE must remain members-only so observers cannot mutate state.
- The MVP form arrows feature is implemented client-side: `getRecentMvpForm(groupId)` in `src/lib/db.ts` fetches the data, `computeMvpForm(playerId, formData)` in `src/lib/mvpForm.ts` returns the decision, and `MvpFormArrow` in `src/components/MvpFormArrow.tsx` renders the SVG arrow + optional crown. No schema changes. The data sources are `mvp_polls` (last 4 closed by `closed_at desc`), `mvp_votes` (sum by `player_id`), and the most recent `match_days` row with non-null `mvp_player_ids`. Existing SELECT RLS already covers all three for both members and observers, so the dashboard renders correctly in read-only mode too.
- The "last activity" section in `/dashboard` (below the player stats table) renders two cards that always describe the same match (`matchDays[0]`). The MVP poll card uses `getMvpPollResultsByMatchDay(matchDayId)` in `src/lib/db.ts`, which looks up `mvp_polls` by `match_day_id` (one poll per match by table convention) and reuses `getMvpPollResults` for totals/winners. The right card has three branches: no poll, open poll (shows "Votación en curso" + partial `MvpResultBars` + link to `/votar/[pollId]`), or closed poll (winner pills + final `MvpResultBars` + total votes). The left card uses a local `TeamColumn` component to render each side as player pills with a winner highlight and inline 👑 for MVP players — that styling is dashboard-only and intentionally not shared with `/partidos`. The vote bars themselves come from `<MvpResultBars />` in `src/components/MvpResultBars.tsx`, the shared component also used by `/votar/[pollId]` — do not duplicate this rendering inline anywhere else.
