<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# fijo

`fijo` is a Next.js app for organizing recurring amateur football matches with a fixed group of friends.

The product flow is:

1. Sign in with Google through Supabase Auth.
2. Create or select a football group.
3. Manage group names or delete groups that are no longer used.
4. Add players and classify each one by skill level.
5. Select today's attendees.
6. Generate two balanced teams.
7. Save the match day and later register the winner.
8. Review attendance and result stats in the dashboard.

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
- When asked to publish changes, commit and push the requested branch only. Do not open pull requests automatically; the owner creates PRs manually.
- Keep local agent/tooling files such as `.codex/` and `.mcp.json` out of commits unless the owner explicitly asks to version them.

## Project Structure

```text
src/
  app/
    page.tsx              Login and authenticated redirect.
    auth/callback/        Google OAuth callback page.
    dashboard/            Group stats and ranking.
    grupos/               List, rename, and delete groups.
    jugadores/            Player CRUD and skill levels.
    sorteo/               Attendee selection and balanced team draw.
    partidos/             Saved match days, winners, and deletion.
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
- `Player`: a player belongs to a group and has a skill level.
- `Group`: a recurring football group owned by a Supabase auth user.
- `MatchDay`: one saved match with attendees, `teamA`, `teamB`, and optional winner.
- `PlayerStats`: dashboard-only derived stats, computed from players and match days.

The balanced draw lives in `src/lib/sorteo.ts`. It groups players by level, shuffles each level, then alternates players into the smaller team so skill levels are spread across both teams.

## Supabase

The schema is in `supabase-schema.sql`.

Tables:

- `groups`
- `group_members`
- `players`
- `match_days`

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
- Preserve the Spanish UI copy and the informal football vocabulary already used in the app.
- Prefer the existing `@/` import alias and local domain types from `src/types`.
- Do not bypass RLS assumptions by adding service-role logic to the frontend.
- Before changing Next.js conventions, routing, metadata, layouts, server/client boundaries, or build config, read the matching guide under `node_modules/next/dist/docs/`.
