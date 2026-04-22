@AGENTS.md

# fijo

App para organizar turnos fijos de futbol entre amigos. Este archivo resume el contexto practico del proyecto; las reglas compartidas para agentes estan en `AGENTS.md`.

Mantenimiento: cada vez que se agregue una funcionalidad relevante, cambie un flujo del producto o aparezca una nueva convencion de trabajo, actualizar este archivo y `AGENTS.md`.

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
    grupos/               -> Lista, edicion de nombre y eliminacion de grupos.
    jugadores/            -> CRUD de jugadores.
    sorteo/               -> Seleccion de presentes, marca rapida de mejores y sorteo balanceado.
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

Creacion de grupos: `src/lib/db.ts` usa el usuario autenticado del cliente Supabase, genera el UUID del grupo en el navegador, inserta en `groups` y despues inserta al owner en `group_members`. No depender de un RPC PostgREST para este flujo salvo que la funcion SQL correspondiente este desplegada y verificada en Supabase.

## Modelo de negocio

- Niveles de jugadores: **bueno**, **tranqui**, **malo**. El alta de jugadores no muestra selector de nivel; los nuevos se guardan como `tranqui`.
- En `/sorteo`, todos los jugadores arrancan deseleccionados para cada partido. El usuario marca manualmente quienes estan presentes antes del sorteo.
- En `/sorteo`, los mejores del dia solo se pueden marcar entre jugadores presentes. Esos jugadores se tratan temporalmente como `bueno` para repartirlos entre equipos.
- Si un jugador deja de estar marcado como presente en `/sorteo`, tambien debe perder cualquier marca temporal de destacado de ese partido.
- Cada partido registra: asistentes, equipos sorteados y resultado
- El dashboard calcula stats por jugador: partidos jugados, victorias, derrotas, asistencia y faltas
- Un grupo representa un turno fijo, por ejemplo "Futbol de los jueves"
- La seccion `/grupos` permite renombrar grupos y eliminar turnos que ya no se usan.

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://hduumplgmjzudmwztffp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

No usar ni publicar `SUPABASE_SERVICE_ROLE_KEY` en el frontend. La app funciona con anon/publishable key y RLS.

## Comandos

```bash
npm run dev    # desarrollo
npm run build  # verificar build
npm run lint   # lint
```

## Git y publicacion

- `main` es la rama de produccion.
- `codex` es la rama de trabajo para cambios hechos por agentes y previews.
- Si el usuario pide subir cambios a GitHub, hacer commit/push solamente. No abrir PR automaticamente; el usuario crea los PRs.
- No commitear `.codex/` ni `.mcp.json` salvo pedido explicito.

## Deploy recomendado

Preferir Vercel para este proyecto porque es una app Next.js 16 con App Router. Configurar `main` como Production Branch y usar `codex` u otras ramas para preview deployments.

Variables en Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://hduumplgmjzudmwztffp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NODE_VERSION=22
```

En Supabase Auth, permitir los callbacks:

```
http://localhost:3000/auth/callback
https://<dominio-produccion>/auth/callback
```

Si se quiere probar login en previews de Vercel, agregar tambien un patron de redirect URL para previews.

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
- En `/sorteo`, `selected` sigue siendo la fuente de verdad de los asistentes del dia y de `match_days.attendees`.
- Cuando cambie un flujo importante o una decision tecnica relevante, actualizar `CLAUDE.md` y `AGENTS.md` en la misma tanda de trabajo.
