@AGENTS.md

# fijo

App para organizar turnos fijos de futbol entre amigos. Este archivo resume el contexto practico del proyecto; las reglas compartidas para agentes estan en `AGENTS.md`.

## Stack

- **Next.js 16.2.4** (App Router, TypeScript)
- **React 19.2.4**
- **Supabase** - Auth con Google OAuth, PostgreSQL y RLS
- **Tailwind CSS v4**

## Estructura

```
src/
  app/
    page.tsx              -> Login; redirige a /dashboard si hay sesion.
    auth/callback/        -> Callback client-side del OAuth de Google.
    dashboard/            -> Estadisticas de jugadores.
    jugadores/            -> CRUD de jugadores con niveles.
    sorteo/               -> Seleccion de presentes y sorteo balanceado.
    partidos/             -> Historial, resultados y eliminacion de partidos.
  components/
    Navbar.tsx
    ProtectedRoute.tsx
    GroupSetup.tsx
  contexts/
    AuthContext.tsx       -> Supabase Auth.
    GroupContext.tsx      -> Grupo activo compartido entre paginas.
  hooks/
    useGroup.ts           -> Hook previo para grupos; hoy se usa GroupContext.
  lib/
    supabase.ts           -> createClient() browser.
    db.ts                 -> Operaciones de BD.
    sorteo.ts             -> Algoritmo de sorteo balanceado por nivel.
  types/index.ts          -> Player, MatchDay, Group, PlayerStats.
```

## Base de datos (Supabase)

Proyecto: `hduumplgmjzudmwztffp`

Tablas:

- `groups` - Cada turno fijo es un grupo (`owner_id`, `name`).
- `group_members` - Relacion usuario/grupo (`group_id`, `user_id`).
- `players` - Jugadores del grupo (`group_id`, `name`, `level`).
- `match_days` - Partidos (`group_id`, `date`, `attendees[]`, `team_a[]`, `team_b[]`, `winner`).

El schema completo con RLS está en `supabase-schema.sql`.

## Modelo de negocio

- Niveles de jugadores: **bueno**, **tranqui**, **malo**
- El sorteo distribuye jugadores equitativamente por nivel (no todos los buenos en el mismo equipo)
- Cada partido registra: asistentes, equipos sorteados y resultado
- El dashboard calcula stats por jugador: partidos jugados, victorias, derrotas, asistencia y faltas
- Un grupo representa un turno fijo, por ejemplo "Futbol de los jueves"

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://hduumplgmjzudmwztffp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Comandos

```bash
npm run dev    # desarrollo
npm run build  # verificar build
npm run lint   # lint
```

## Auth flow

1. Usuario hace click en "Entrar con Google".
2. Supabase redirige a Google OAuth.
3. Google vuelve a `/auth/callback?code=...`.
4. `src/app/auth/callback/page.tsx` intercambia el code por sesion en el cliente.
5. La app redirige a `/dashboard`.

## Notas para cambios

- Antes de tocar APIs o convenciones de Next.js, leer la guia relevante en `node_modules/next/dist/docs/`.
- Mantener el copy en español y el tono informal actual.
- Para nuevas lecturas/escrituras de Supabase, preferir helpers en `src/lib/db.ts`.
- No poner claves privadas ni service-role keys en el frontend.
- Las paginas protegidas deben usar `ProtectedRoute`.
- Las paginas dependientes de grupo deben usar `GroupSetup` y esperar `activeGroup`.
