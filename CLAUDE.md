@AGENTS.md

# fijo

App para organizar turnos fijos de futbol entre amigos. Este archivo resume el contexto practico del proyecto; las reglas compartidas para agentes estan en `AGENTS.md`.

Mantenimiento: cada vez que se agregue una funcionalidad relevante, cambie un flujo del producto o aparezca una nueva convencion de trabajo, actualizar este archivo y `AGENTS.md`.

## Checkpoint actual

- Rama activa: `feat/editar-partido` (pantalla `/partidos/[id]/editar` para corregir un partido antes de lanzar la encuesta MVP: mover jugadores entre Equipo A / Equipo B / Ausente, cambiar ganador y fecha). Sin cambios de schema.
- Feature anterior entregada: `feat/sorteo-enfrentamientos` (DnD opcional para emparejar antes del sorteo; mergeada a `main`).
- Flujo edicion de partido: en `/partidos`, cada card muestra boton "Editar" mientras el partido NO tenga `mvp_polls` creada y `match_days.mvp_player_ids` este vacio. El boton lleva a `/partidos/[id]/editar` (page client + `use(params)`), que reusa el patron de toggles A/B/Ausente de `/partidos/nuevo`. Helpers nuevos: `getMatchDayById(matchDayId)` (devuelve `(MatchDay & { groupId: string }) | null` via `maybeSingle`) y `getMvpPollByMatchDay(matchDayId)` en `src/lib/db.ts`. `updateMatchDay` ahora tambien acepta `date` ademas de `winner`/`attendees`/`teamA`/`teamB`. La pantalla maneja tres estados de bloqueo: `notFound` (partido inexistente o de otro grupo), `locked` (ya hay encuesta o MVP persistido) y normal. Antes de guardar, re-chequea poll/MVP para mitigar la race con creacion en otra pestaña — la atomicidad real no esta garantizada (ventana de milisegundos), pero el daño residual es bajo porque `mvp_polls.candidates` es snapshot jsonb. Si en `team_a`/`team_b` hay IDs de jugadores ya eliminados del grupo (`ghostIds`), la pantalla muestra warning amarillo no bloqueante avisando que se removeran al guardar. `attendees` se re-deriva siempre como `[...teamA, ...teamB]`.
- Flujo enfrentamientos manuales: en `/sorteo`, despues de marcar presentes (>= 4), boton "Enfrentar manualmente" cambia a un `<PairingBoard>` con DnD basado en `@dnd-kit/core`. Layout de tres columnas (`md:grid-cols-3`): "Lado A" a la izquierda, lista central de jugadores sin emparejar, "Lado B" a la derecha. Cada par se renderiza como una fila alineada entre las columnas laterales con un badge numerico (1, 2, 3...) que conecta los dos lados; el ✕ para eliminar un par vive en la columna derecha. El usuario arrastra jugadores entre la columna central y los slots `left`/`right` de los pares. Cuando arrastra una card, las cards y slots vacios del mismo nivel efectivo (`bestPlayers` -> `bueno`, resto -> nivel guardado) se resaltan como sugerencia visual no bloqueante. El estado vive en memoria y NO se persiste; el board reporta los pares completos al padre via `onPairsChange`. `sorteoBalanceado(players, pairs?)` en `src/lib/sorteo.ts` recibe ahora un segundo argumento opcional `Array<[string, string]>`: para cada par decide la asignacion que minimiza el desbalance global de pesos por nivel (`bueno=3, tranqui=2, malo=1`) y aleatoriza en empate. Los no emparejados caen al algoritmo clasico (agrupar por nivel + alternar al equipo con menos jugadores). Si no se pasan pares o estan vacios, el comportamiento es identico al anterior. Guardar partido sigue persistiendo solo `team_a`/`team_b` finales.
- Flujo dashboard ultima actividad: en `/dashboard`, debajo de la tabla, dos cards en `lg:grid-cols-2` que **siempre** corresponden al mismo partido (`matchDays[0]`). Card izquierda muestra fecha, asistentes y los dos equipos como pills (componente local `TeamColumn` en el mismo archivo); el equipo ganador queda resaltado con borde y fondo, los jugadores que salieron MVP llevan corona 👑 inline. Card derecha llama a `getMvpPollResultsByMatchDay(matchDayId)` en `src/lib/db.ts` y maneja tres estados: sin votacion, votacion en curso (badge verde "Votación en curso" + barras parciales + link a `/votar/[pollId]`), o cerrada (ganador + barras finales via `<MvpResultBars />`, componente compartido en `src/components/MvpResultBars.tsx` reusado en `/votar`). La seccion solo aparece dentro del bloque `stats.length > 0`. Las RLS SELECT existentes ya cubren observadores.
- Flujo flechas de forma: `getRecentMvpForm(groupId)` en `src/lib/db.ts` trae los ultimos 4 polls cerrados, suma votos por jugador y obtiene los MVPs del partido mas reciente. `computeMvpForm(playerId, formData)` en `src/lib/mvpForm.ts` decide el nivel: top 1 → ↑ azul, top 2 → ↗ verde, top 3 → → amarillo, top 4+ con votos → ↘ naranja, candidato sin votos → ↓ gris, jugador que nunca fue candidato en la ventana → sin flecha. Empates comparten posicion y saltan las siguientes. Si el jugador esta en `match_days.mvp_player_ids` del partido mas reciente, lleva ademas un badge 👑. Render via `<MvpFormArrow />` en `src/components/MvpFormArrow.tsx` (SVG inline rotado).
- Flujo observadores: en `/grupos` cualquier miembro pleno genera un codigo alfanumerico de 8 caracteres (alfabeto sin 0/O/1/I) y lo comparte (boton WhatsApp incluido). Otro usuario logueado pega el codigo en `/grupos` o en `GroupSetup` → RPC `join_group_as_observer` lo suma a `group_observers` → el grupo aparece en su dropdown con badge "observador" → `isReadOnly` del `GroupContext` oculta edicion. `RequireEditor` redirige a `/dashboard` desde `/jugadores`, `/partidos`, `/partidos/nuevo` y `/sorteo`. Los observadores NO cuentan contra el limite de 3 miembros plenos.
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
    sorteo/               -> Seleccion de presentes, marca rapida de mejores, sorteo balanceado (con modo opcional de enfrentamientos manuales DnD) y compartir por WhatsApp.
    partidos/             -> Historial, resultados y eliminacion de partidos.
    partidos/nuevo/       -> Carga manual de un partido con fecha arbitraria y asignacion A/B por jugador.
    partidos/[id]/editar/ -> Edicion de un partido (equipos, ausentes, ganador, fecha) mientras no exista encuesta MVP.
    votar/[pollId]/       -> Pagina publica de votacion MVP (sin login requerido).
  components/
    Navbar.tsx
    ProtectedRoute.tsx
    RequireEditor.tsx     -> Redirige a /dashboard cuando el grupo activo es observado (solo lectura).
    GroupSetup.tsx
    MvpFormArrow.tsx      -> Flecha SVG estilo PES + badge MVP ultimo partido.
    MvpResultBars.tsx     -> Barras horizontales de votos por candidato; usado en /votar y /dashboard.
    PairingBoard.tsx      -> Modo DnD opcional en /sorteo para enfrentar jugadores manualmente antes del sorteo.
    DraggablePlayerCard.tsx -> Card arrastrable de jugador (nombre + badge nivel + flecha de forma) usada por PairingBoard.
  contexts/
    AuthContext.tsx       -> Supabase Auth.
    GroupContext.tsx      -> Grupo activo compartido entre paginas.
  hooks/
    useGroup.ts           -> Hook previo para grupos; hoy se usa GroupContext.
  lib/
    supabase.ts           -> createClient() browser.
    db.ts                 -> Operaciones de BD.
    sorteo.ts             -> Algoritmo de sorteo balanceado por nivel.
    mvpForm.ts            -> Logica pura para decidir nivel de forma de cada jugador.
  types/index.ts          -> Player, MatchDay, Group, PlayerStats, MvpFormData.
```

## Base de datos (Supabase)

Proyecto: `hduumplgmjzudmwztffp`

Tablas:

- `groups` - Cada turno fijo es un grupo (`owner_id`, `name`, `public_code`, `code_created_at`).
- `group_members` - Relacion usuario/grupo (`group_id`, `user_id`). Miembros plenos, maximo 3 por grupo.
- `group_observers` - Usuarios con acceso de solo lectura al grupo (`group_id`, `user_id`). Ilimitados, agregados via codigo publico.
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
- Un partido se puede editar desde `/partidos/[id]/editar` (boton "Editar" en cada card de `/partidos`) mientras NO exista una encuesta MVP creada y `match_days.mvp_player_ids` este vacio. Permite reasignar jugadores entre Equipo A / Equipo B / Ausente, cambiar el ganador y corregir la fecha. Si ya hay encuesta o MVP persistido, la edicion queda bloqueada y la pantalla muestra un empty state explicativo.
- El dashboard calcula stats por jugador: partidos jugados, victorias, derrotas, asistencia y faltas
- Un grupo representa un turno fijo, por ejemplo "Futbol de los jueves"
- La seccion `/grupos` permite renombrar grupos y eliminar turnos que ya no se usan.
- Al cerrar un partido, cualquier miembro del grupo puede crear una encuesta MVP eligiendo 3-4 candidatos presentes en ese partido.
- La encuesta genera un link publico `/votar/[pollId]` que no requiere login; se comparte por WhatsApp.
- Cada dispositivo puede votar una sola vez (limitado por fingerprint). La encuesta puede cerrarse o eliminarse manualmente desde `/partidos` por cualquier miembro del grupo.
- Al cerrar la encuesta, la funcion RPC `close_mvp_poll` determina al ganador atomicamente, persiste en `match_days.mvp_player_ids`, e incrementa `players.mvp_count` para el ganador y `players.mvp_votes_received` para todos los candidatos que recibieron votos.
- En caso de empate, todos los jugadores empatados quedan como MVP del partido.
- Las RLS de `mvp_polls` y la RPC `close_mvp_poll` validan membresia via `group_members`, no `owner_id`. Mantener este patron en cualquier flujo de gestion de encuestas.
- Cualquier miembro pleno puede generar/regenerar/revocar el codigo publico del grupo en `/grupos`. El codigo es alfanumerico de 8 caracteres (alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sin caracteres confusos) y es fijo hasta que se regenera o revoca manualmente.
- Los observadores (role `observer`) acceden con el codigo desde `/grupos` o `GroupSetup`, quedan en `group_observers`, y son ilimitados (no cuentan contra el limite de 3 miembros plenos).
- Los observadores solo ven `/dashboard` y `/grupos`. `RequireEditor` redirige a `/dashboard` desde rutas editables. La edicion esta bloqueada por RLS: las policies INSERT/UPDATE/DELETE de `players`, `match_days`, `mvp_polls` siguen validando `group_members`, no `group_observers`.
- Las policies SELECT de `groups`, `players` y `match_days` permiten lectura tanto a miembros plenos (`group_members`) como a observadores (`group_observers`). Mantener este patron al agregar nuevas tablas del grupo.
- Las flechas de forma se muestran en `/dashboard`, `/jugadores` y `/sorteo`. Se calculan client-side a partir de los ultimos 4 polls MVP cerrados del grupo activo. Si hay menos polls, se usa lo que haya. Si no hay ningun poll cerrado pero si un MVP en el ultimo partido, igualmente se muestra el badge 👑 (sin flecha). El render funciona tanto para miembros como observadores porque las RLS SELECT de `mvp_polls`, `mvp_votes` y `match_days` ya cubren ambos roles.
- En `/sorteo` hay un modo opcional de "enfrentamientos manuales" (boton "Enfrentar manualmente", habilitado a partir de 4 presentes). Es DnD basado en `@dnd-kit/core`. Los pares se mantienen en memoria y se descartan al salir del modo, al deseleccionar un jugador presente o al volver al modo simple — nunca se persisten en la base. Cuando se sortea desde el modo emparejamiento, `sorteoBalanceado` recibe `pairs` como segundo arg; cada par queda garantizado en equipos distintos. La validacion de "mismo nivel" es solo una sugerencia visual: la UI resalta cards/slots del mismo nivel pero permite cualquier combinacion.

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
- Las paginas editables (modifican datos del grupo) deben envolverse con `RequireEditor` para redirigir a `/dashboard` cuando el grupo activo es observado.
- Las paginas dependientes de grupo deben usar `GroupSetup` y esperar `activeGroup`.
- En `/sorteo`, `selected` sigue siendo la fuente de verdad de los asistentes del dia y de `match_days.attendees`.
- En `/sorteo`, el alta rapida de jugadores debe conservar la seleccion actual del partido y sumar al nuevo jugador como presente.
- En `/sorteo`, compartir por WhatsApp o copiar el mensaje debe usar exactamente los equipos sorteados en pantalla y no guardar datos extra.
- En `/sorteo`, los pares manuales son estado en memoria — no agregar persistencia en `match_days` ni en una tabla nueva. Si un jugador deja de estar presente, su par debe limpiarse automaticamente. La regla de "mismo nivel" es solo sugerencia visual; no la hagas bloqueante.
- Mantener `sorteoBalanceado(players, pairs?)` como funcion pura: si `pairs` es undefined o vacio, comportarse exactamente como el algoritmo clasico. No reemplazar el algoritmo clasico con uno greedy global.
- En `/partidos/[id]/editar`, la condicion para permitir edicion es estricta: NO debe existir `mvp_polls` para el partido Y `match_days.mvp_player_ids` debe estar vacio. La pantalla re-chequea poll/MVP justo antes de `updateMatchDay` para mitigar race con creacion en otra pestaña; el boton "Editar" en `/partidos` se oculta con la misma condicion. `attendees` se re-deriva siempre como `[...teamA, ...teamB]` al guardar — no conservar ausentes en esa columna.
- El alta de miembros por correo depende de funciones SQL en `supabase-schema.sql`; no reemplazar esto por lógica con service-role en frontend.
- El limite de 3 miembros debe mantenerse garantizado en la base, no solo en UI o helpers TS.
- Cuando cambie un flujo importante o una decision tecnica relevante, actualizar `CLAUDE.md` y `AGENTS.md` en la misma tanda de trabajo.
