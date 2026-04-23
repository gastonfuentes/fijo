<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# fijo

`fijo` is a Next.js app for organizing recurring amateur football matches with a fixed group of friends.

## Current Checkpoint

- Last shipped feature: **MVP poll** (`feat/mvp-poll`, ready to merge into `main`).
- Status: code committed in `feat/mvp-poll` (build and lint pass); SQL migration applied to Supabase project `hduumplgmjzudmwztffp` on 2026-04-23.
- Previous feature: shared group access (up to 3 app users per group, added by email) — deployed and verified on 2026-04-23.
- Schema state: `supabase-schema.sql` is idempotent and safe to re-run. Includes the full MVP poll migration (tables `mvp_polls`, `mvp_votes`; new columns on `players` and `match_days`; RPC `close_mvp_poll`).

The product flow is:

1. Sign in with Google through Supabase Auth.
2. Create a football group or join one where the user was added by email.
3. Select the active group and distinguish owned groups from shared groups.
4. Manage group names, members, or delete groups that are no longer used.
5. Add players to the group.
6. Select today's attendees and quickly mark the best players for that match.
7. Generate two balanced teams.
8. Share the sorted teams through WhatsApp or copy the message to send it manually.
9. Save the match day and later register the winner.
10. Optionally create an MVP poll: pick 3–4 candidate players, share the public voting link via WhatsApp, let anyone vote (one vote per device), then close the poll to persist the winner.
11. Review attendance, result, and MVP stats in the dashboard.

Current `/sorteo` behavior:

- All players start deselected by default for each match day.
- The user marks attendees manually, one by one, before running the draw.
- The user can also create a new player directly from `/sorteo` for faster match-day setup.
- Players created from `/sorteo` are stored as `tranqui` and auto-selected as present for that match.
- "Best player" quick marks only apply to players currently marked as present.
- `match_days.attendees` stores only the players selected for that day.
- Once teams are sorted, the user can share the result through WhatsApp or copy the same message manually.

Current `/grupos` behavior:

- A group can have up to 3 app users in total.
- Members are added by email only if that user already signed into the app at least once.
- Owned groups and invited groups are shown together in the UI with clear role badges.
- Any group member can rename the group, delete it, and manage non-owner members.
- The original `owner_id` remains fixed as the technical owner and cannot be transferred or removed in the app.

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
    votar/[pollId]/       Public MVP voting page (no login required).
  components/
    Navbar.tsx
    ProtectedRoute.tsx
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
- `MatchDay`: one saved match with attendees, `teamA`, `teamB`, optional winner, and optional `mvp_player_ids`.
- `MvpPoll`: one poll per match day with `candidates` (jsonb), `status` (`open`/`closed`), and a unique voting link at `/votar/[pollId]`.
- `PlayerStats`: dashboard-only derived stats, computed from players and match days.

The balanced draw lives in `src/lib/sorteo.ts`. It groups players by level, shuffles each level, then alternates players into the smaller team so skill levels are spread across both teams. The current UI does not ask for a level when adding a player; new players are stored as `tranqui`, and `/sorteo` temporarily marks checked best players as `bueno` before calling the draw. On `/sorteo`, presence is a temporary per-match selection: players start as absent, attendees are selected manually, newly created players can be added inline and auto-selected as present, and removing a player from the attendee list must also remove any temporary "bueno" mark for that match.

## Supabase

The schema is in `supabase-schema.sql`.

Tables:

- `groups`
- `group_members`
- `user_profiles`
- `players` (includes `mvp_count`, `mvp_votes_received`)
- `match_days` (includes `mvp_player_ids uuid[]`)
- `mvp_polls` (one per match day; RLS: select public, insert/update/delete owner only)
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
- Keep group-dependent pages wrapped with `GroupSetup` and render the main page content only when `activeGroup` exists.
- Group membership by email depends on `user_profiles` plus SQL functions in `supabase-schema.sql`; the schema also backfills/syncs `user_profiles` from `auth.users`, and the frontend keeps the client-side sync as a compatible fallback. The member-management functions must keep all `group_members` column references qualified (`gm.user_id`, etc.) to avoid PL/pgSQL ambiguity with output-column names. Keep this flow browser-safe and do not add service-role keys to the frontend.
- In `/sorteo`, preserve the current interaction model: default attendance is empty, `selected` is the source of truth for attendees, best-player toggles must stay disabled for absent players, and quick-created players should be added as `tranqui` and marked present immediately.
- In `/sorteo`, any share action must use the currently sorted teams only and must not introduce extra persistence in Supabase.
- Preserve the Spanish UI copy and the informal football vocabulary already used in the app.
- Prefer the existing `@/` import alias and local domain types from `src/types`.
- Do not bypass RLS assumptions by adding service-role logic to the frontend.
- Before changing Next.js conventions, routing, metadata, layouts, server/client boundaries, or build config, read the matching guide under `node_modules/next/dist/docs/`.
- The MVP poll voting page (`/votar/[pollId]`) is intentionally public: it must not require login and must not use auth-gated Supabase calls. Votes are inserted with the anon key; RLS on `mvp_votes` allows insert only when the referenced poll is `open`.
- Closing an MVP poll must go through the RPC `close_mvp_poll(poll_id)` — never replicate that logic client-side. The RPC is `security definer` and checks that the caller is the group owner.
- In case of a tie, all top-vote players become MVP (`mvp_player_ids` is an array for this reason). Increment `mvp_count` for each winner.
