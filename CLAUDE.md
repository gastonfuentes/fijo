@AGENTS.md

# fijo

App para organizar turnos fijos de futbol entre amigos. Este archivo resume el contexto practico del proyecto; las reglas compartidas para agentes estan en `AGENTS.md`.

Mantenimiento: cada vez que se agregue una funcionalidad relevante, cambie un flujo del producto o aparezca una nueva convencion de trabajo, actualizar este archivo y `AGENTS.md`.

## Checkpoint actual

- Rama activa: `feat/manual-match` (carga manual de partidos con fecha arbitraria; sin cambios de schema).
- Feature anterior entregada: `feat/mvp-poll-members` (abre permisos de encuesta MVP a cualquier miembro del grupo; mergeado a `main` como PR #11).
- Flujo carga manual: desde `/partidos` → boton "+ Cargar partido manual" → `/partidos/nuevo` → el usuario elige fecha (cualquier fecha pasada), asigna cada jugador al Equipo A, Equipo B o Ausente, y opcionalmente registra el ganador en el mismo formulario → llama a `createMatchDay` con los datos y redirige a `/partidos`. Sin cambios de schema ni nuevas funciones SQL.
- Flujo MVP actual: al cerrar un partido, **cualquier miembro** del grupo elige 3-4 candidatos → se genera link publico `/votar/[pollId]` → se comparte por WhatsApp → cada votante usa el link sin login (1 voto por fingerprint de dispositivo) → un miembro cierra la encuesta → el MVP se persiste en `match_days.mvp_player_ids` y se incrementan `players.mvp_count` y `players.mvp_votes_received` (todo atomico via RPC `close_mvp_poll`).
- Supabase MCP: configurado con `claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest --access-token ...`

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
    grupos/               -> Lista, roles, membresias por correo, edicion y eliminacion de grupos.
    jugadores/            -> CRUD de jugadores.
    sorteo/               -> Seleccion de presentes, marca rapida de mejores, sorteo balanceado y compartir por WhatsApp.
    partidos/             -> Historial, resultados y eliminacion de partidos.
    partidos/nuevo/       -> Carga manual de un partido con fecha arbitraria y asignacion A/B por jugador.
    votar/[pollId]/       -> Pagina publica de votacion MVP (sin login requerido).
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
- `user_profiles` - Perfil publico minimo para resolver usuarios por correo (`id`, `email`).
- `players` - Jugadores del grupo (`group_id`, `name`, `level`, `mvp_count`, `mvp_votes_received`).
- `match_days` - Partidos (`group_id`, `date`, `attendees[]`, `team_a[]`, `team_b[]`, `winner`, `mvp_player_ids[]`).
- `mvp_polls` - Encuesta MVP por partido (`match_day_id`, `group_id`, `candidates jsonb`, `status open/closed`).
- `mvp_votes` - Votos de encuesta MVP, 1 por fingerprint de dispositivo por poll.

El schema completo con RLS está en `supabase-schema.sql`.

Creacion de grupos: `src/lib/db.ts` usa el usuario autenticado del cliente Supabase, genera el UUID del grupo en el navegador, inserta en `groups` y despues inserta al owner en `group_members`. No depender de un RPC PostgREST para este flujo salvo que la funcion SQL correspondiente este desplegada y verificada en Supabase.

## Modelo de negocio

- Niveles de jugadores: **bueno**, **tranqui**, **malo**. El alta de jugadores no muestra selector de nivel; los nuevos se guardan como `tranqui`.
- En `/sorteo`, todos los jugadores arrancan deseleccionados para cada partido. El usuario marca manualmente quienes estan presentes antes del sorteo.
- En `/sorteo`, tambien se pueden crear jugadores nuevos sin salir de esa pantalla para acelerar la organizacion del partido.
- Un jugador creado rapido desde `/sorteo` se guarda como `tranqui` y queda marcado como presente automaticamente.
- En `/sorteo`, los mejores del dia solo se pueden marcar entre jugadores presentes. Esos jugadores se tratan temporalmente como `bueno` para repartirlos entre equipos.
- Si un jugador deja de estar marcado como presente en `/sorteo`, tambien debe perder cualquier marca temporal de destacado de ese partido.
- Una vez sorteados los equipos en `/sorteo`, se puede compartir el resultado por WhatsApp o copiar el mismo mensaje para mandarlo manualmente.
- Cada grupo puede tener hasta 3 usuarios de la app en total.
- Los usuarios extra de un grupo se agregan por correo y ese correo ya tiene que existir en `user_profiles`; el schema hace backfill/sync desde `auth.users`, y el cliente tambien hace `upsert` del perfil como respaldo.
- Los grupos propios y los grupos compartidos aparecen juntos en la UI con badge `owner` o `miembro`.
- Cualquier miembro del grupo puede administrar el grupo, pero el `owner` original sigue fijo y no se transfiere ni se elimina desde la app.
- En las funciones SQL de miembros (`get_group_members`, `add_group_member_by_email`, `remove_group_member`), las referencias a columnas de `group_members` deben ir calificadas con alias para evitar errores tipo `column reference "user_id" is ambiguous`.
- Cada partido registra: asistentes, equipos sorteados y resultado
- Un partido puede cargarse manualmente desde `/partidos/nuevo`: el usuario elige la fecha (cualquier fecha pasada), asigna cada jugador al Equipo A, Equipo B o como Ausente, y opcionalmente registra el ganador. No requiere pasar por el sorteo.
- El dashboard calcula stats por jugador: partidos jugados, victorias, derrotas, asistencia y faltas
- Un grupo representa un turno fijo, por ejemplo "Futbol de los jueves"
- La seccion `/grupos` permite renombrar grupos y eliminar turnos que ya no se usan.
- Al cerrar un partido, cualquier miembro del grupo puede crear una encuesta MVP eligiendo 3-4 candidatos presentes en ese partido.
- La encuesta genera un link publico `/votar/[pollId]` que no requiere login; se comparte por WhatsApp.
- Cada dispositivo puede votar una sola vez (limitado por fingerprint). La encuesta puede cerrarse o eliminarse manualmente desde `/partidos` por cualquier miembro del grupo.
- Al cerrar la encuesta, la funcion RPC `close_mvp_poll` determina al ganador atomicamente, persiste en `match_days.mvp_player_ids`, e incrementa `players.mvp_count` para el ganador y `players.mvp_votes_received` para todos los candidatos que recibieron votos.
- En caso de empate, todos los jugadores empatados quedan como MVP del partido.
- Las RLS de `mvp_polls` y la RPC `close_mvp_poll` validan membresia via `group_members`, no `owner_id`. Mantener este patron en cualquier flujo de gestion de encuestas.

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
- Cada nueva feature debe arrancar en una rama nueva creada desde la `main` local actualizada.
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
- En `/sorteo`, el alta rapida de jugadores debe conservar la seleccion actual del partido y sumar al nuevo jugador como presente.
- En `/sorteo`, compartir por WhatsApp o copiar el mensaje debe usar exactamente los equipos sorteados en pantalla y no guardar datos extra.
- El alta de miembros por correo depende de funciones SQL en `supabase-schema.sql`; no reemplazar esto por lógica con service-role en frontend.
- El limite de 3 miembros debe mantenerse garantizado en la base, no solo en UI o helpers TS.
- Cuando cambie un flujo importante o una decision tecnica relevante, actualizar `CLAUDE.md` y `AGENTS.md` en la misma tanda de trabajo.
