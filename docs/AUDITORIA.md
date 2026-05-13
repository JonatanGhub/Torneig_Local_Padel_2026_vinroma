# Auditoría del repositorio — Fase 0 (Discovery)

> Solo lectura sobre el estado del repo en la rama `claude/tournament-discovery-odMYj` (working tree limpio). Sin suposiciones: lo que no consta queda marcado como **DECISIÓN PENDIENTE** y se traslada a `docs/DECISIONES.md` en la Fase 1.

## Resumen ejecutivo

El repositorio `Torneig_Local_Padel_2025_vinroma` es una **SPA estática React 18 + Vite 5 + Tailwind 3** que funciona como visor read-only de la IV edición (2025) del torneo. No tiene backend, base de datos, autenticación, pasarela de pago, tests ni CI. La operativa real (inscripción, sorteo, asignación de pistas, captura de resultados) ocurre fuera del sistema; el repo solo refleja el estado a posteriori mediante dos JSON (`public/results.json`, `public/schedules.json`) editados a mano y commiteados (**23 de 53 commits ≈ 43 %** son literalmente *"Actualizar results.json"*). Toda la lógica de torneo (round-robin, clasificación, desempates, render del bracket) vive en un único `src/App.jsx` de 768 líneas, sin tipos. El motor de clasificación (`getStandings`) y el de resultado (`getMatchResult`) son lógicamente correctos y portables a TypeScript con tests; el bracket de fase final está **hardcoded por posiciones**, no derivado de las clasificaciones. Datos del torneo (parejas, categorías, horarios de fase final) embebidos en código. No existen archivos `.env`, no hay secretos visibles. Estado deseado para la nueva edición: reescribir persistencia y operaciones, conservar UI y algoritmos puros.

## Stack actual

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Runtime | Node | implícito ≥18 | sin `engines` en `package.json`, sin `.nvmrc` |
| Bundler | Vite | 5.2.0 | `vite.config.js` con el plugin React por defecto |
| UI | React | 18.2.0 | Solo `react` + `react-dom` |
| Estilos | Tailwind CSS | 3.4.4 | Paleta y animaciones extendidas en `tailwind.config.js` |
| Iconos | lucide-react | 0.395.0 | 6 iconos en uso |
| Lint | ESLint | 8.57.0 | `--max-warnings 0` (estricto) |
| Lenguaje | JSX | — | sin TypeScript |
| Persistencia | JSON estáticos en `public/` servidos por Vite | — | edición manual + commit |
| Despliegue | No declarado | — | sin workflow, sin `vercel.json`. **DECISIÓN PENDIENTE** |

Scripts disponibles (`package.json`): `dev`, `build`, `lint`, `preview`. No hay `test`, no hay `format`, no hay hooks (Husky / lint-staged), no hay `engines`.

## Estado de datos

### Estructura efectiva (extraída del código y de los JSON)

- **4 categorías**: `1ª`, `2ª`, `3ª`, `4ª`.
- **Grupos por categoría**:
  - `1ª`, `2ª`, `3ª`: 2 grupos de 4 parejas → 12 partidos de fase de grupos cada una.
  - `4ª`: 1 solo grupo de 4 parejas → 6 partidos. Bracket KO reducido a *Final + Final consolación* (sin semifinales).
- **28 parejas** codificadas `A1..A8, B1..B8, C1..C8, D1..D4` (códigos display) en `src/App.jsx` líneas 6-21, con nombres reales asociados.
- Cuadro KO de 1ª/2ª/3ª: `SF1 (1ºG1 vs 2ºG2)`, `SF2 (1ºG2 vs 2ºG1)`, `Final entre ganadores`, con cuadro de consolación paralelo entre 3ºs y 4ºs.

### `public/results.json` — schema implícito

```ts
type Results = {
  results: Array<{
    team1: string;  // código tipo "A1"
    team2: string;
    sets: [Set, Set, Set];  // siempre 3 sets; los no jugados llevan [null, null]
  }>;
  finalPhaseResults: {
    [category in "1ª"|"2ª"|"3ª"|"4ª"]: {
      main:        { semifinal1?: { sets: [Set, Set, Set] };
                     semifinal2?: { sets: [Set, Set, Set] };
                     final:        { sets: [Set, Set, Set] } };
      consolation: { semifinal1?: { sets: [Set, Set, Set] };
                     semifinal2?: { sets: [Set, Set, Set] };
                     final:        { sets: [Set, Set, Set] } };
    };
  };
};
type Set = [number | null, number | null];
```

- 42 partidos de fase de grupos (12 + 12 + 12 + 6).
- Tercer set (super tie-break a 10) presente solo cuando hay empate a sets ganados.
- En la categoría `4ª` el bloque `main.final` y `consolation.final` no tienen `semifinal1` / `semifinal2`: el código asume que falta la SF y renderiza directamente Final + Final Consolación.
- **Anomalías**: indentación inconsistente entre líneas 18-32 (mezcla de 4 espacios, 1 espacio y sin espacio); el partido `B1 vs B2` está registrado `0-6, 0-6` que puede ser walkover legítimo o resultado real (no hay flag `status`).
- **No hay `id` de partido ni de pareja**: el cruce con `schedules.json` se hace por strings `A1`..`D4` y por orden de aparición.

### `public/schedules.json` — schema implícito

```ts
type Schedules = {
  schedules: Array<{ team1Id: string; team2Id: string; schedule: string }>;
};
```

- 42 entradas, una por partido de grupos.
- `schedule` es **texto libre en catalán**, no parseable de forma robusta. Formatos coexistentes detectados:
  - Canónico: `"Dimarts 1, 19:30"`.
  - Con pista: `"Dimarts 1, 22:00 PISTA DALT"`, `"Dijous 17, 22:00,pista de dalt"` (mayúsculas, minúsculas, coma en posición distinta).
  - Sin espacio tras coma: `"Dissabte 12,19:00"`.
  - Sin coma: `"Divendres 11 22:00"`.
  - Estados: `"Dimecres 9, 19:30 // SUSPÉS"`, `"Pendent de data"`.
- El campo no contiene mes ni año; el README implica enero 2025. Zona horaria implícita Europe/Madrid.

### Datos reutilizables para la próxima edición

- Lista de 28 parejas con nombres reales en `src/App.jsx` líneas 6-21 — reutilizable como **histórico** para sembrar ranking si se decide arrastrar continuidad inter-edición.
- Estructura de categorías y formato de cuadro KO — reutilizable como *punto de partida* del modelo, pero **debe ser configurable desde admin**, no codeada.
- Resultados 2025 completos — archivables como dataset histórico congelado en una tabla `historical_tournaments` (o equivalente) para alimentar ranking inter-edición si procede.

### Anonimización

Los nombres son alias parciales del estilo *"Vicenç / Victor"* o *"Mariano / Jordi M."*, no datos completos (sin apellidos, sin email, sin teléfono). Aun así, antes de migrar a una base relacional con FK a `players`, conviene tratarlos como dato personal (Art. 4 RGPD) y obtener consentimiento explícito o pseudonimizar. **DECISIÓN PENDIENTE** en la política RGPD.

## Componentes funcionales

| Bloque | Ubicación | Función | Veredicto migración |
|---|---|---|---|
| `initialTournamentData` | `App.jsx` 5-21 | Hardcode de categorías, grupos, parejas | **Reescribir** → tablas `pairs` + `categories` + `group_members` |
| `generateMatches(teams)` | `App.jsx` 23-40 | Round-robin: combinatoria O(N²) sin orden de jornada | **Portable a TS** + test (función pura) |
| `getStandings(teams, matches)` | `App.jsx` 44-115 | Calcula stats P/PJ/SG/SP/JG/JP y ordena por P → diff sets → diff juegos → head-to-head | **Portable a TS** + test (función pura) |
| `getMatchResult(match)` | `App.jsx` 154-167 | Cuenta sets, decide ganador, formatea marcador | **Portable a TS** + test |
| `FINAL_SCHEDULES` | `App.jsx` 215-252 | Horarios de fase final hardcoded por categoría/ronda | **Reescribir** → columnas `matches.scheduled_at` y `matches.court` |
| `FinalsBracket` + `Bracket` | `App.jsx` 254-400 | Render del cuadro con cruces hardcoded `1ºG1 vs 2ºG2`, `1ºG2 vs 2ºG1` y caso especial para 4ª | UI **portable a Next.js**; derivación de bracket → función `generate_knockout_bracket` (SQL o TS) |
| `useEffect` de carga | `App.jsx` 443-479 | `fetch` paralelo de los dos JSON + deep-clone + matching por IDs + inversión de sets si el orden viene invertido | **Sustituir** por Supabase client + suscripción Realtime |
| `useMemo` standings / finalStandings | `App.jsx` 481-510 | Derivación de stats por grupo y filtrado de categorías con todos los partidos jugados | Mantener cliente, alimentado por queries / Realtime |
| `ClassificationTable`, `MatchCard`, `Group`, `NormativaPanel`, `MainNavButton` | `App.jsx` 117-213, 402-423, 512 | UI pura | **Portable a Next.js** (RSC + Tailwind + shadcn/ui) |
| Reglamento | `App.jsx` `NormativaPanel` (402-423) | Texto inline en JSX | **Migrar** a `docs/REGLAMENTO_<AÑO>.md` versionado |

### Algoritmos: cobertura y huecos

- **Sorteo de grupos**: no existe. Las parejas están preasignadas. La nueva edición lo requiere como acción de admin con seed reproducible (`pgcrypto` o seed manual).
- **Generación de partidos de grupo**: `generateMatches` cubre el round-robin trivial sin ordenar jornadas. Aceptable como base.
- **Cuadro KO**: hardcoded por posición y por categoría. Falta el caso general (N parejas, byes automáticos cuando N no es potencia de 2, seeded para evitar cruces tempranos entre primeros del mismo grupo).
- **Validación cruzada de resultados** (dos capitanes reportan, admin arbitra discrepancias): no existe; hoy los resultados los pone el admin a mano editando el JSON.
- **Estados de partido**: solo `played: boolean`. No hay `walkover`, `cancelled`, `disputed`, `in_progress`.
- **Pagos / inscripción / auth / notificaciones**: inexistentes.

## Deuda técnica priorizada

### P0 — bloqueante para la nueva edición

- Inexistente capa de persistencia transaccional. La edición a mano de JSON es incompatible con inscripción online y operativa multi-admin.
- Falta de auth: sin admin, sin capitanes, sin RBAC.
- Falta de pasarela de pago.
- Falta de modelo de datos relacional; cruce por strings frágil entre `results` y `schedules`.
- Sin validación de entrada en ningún punto: un JSON malformado da fallos silenciosos en la UI (sin esquema, sin `try/catch` estructurado).

### P1 — impacta calidad del producto, abordable durante los sprints 1-3

- **Ausencia de tests**. Los algoritmos `getStandings`, `getMatchResult` y `generateMatches` deben portarse con cobertura unitaria antes de cualquier reescritura.
- **Ausencia de TypeScript**. La migración a Next.js debe ser TS desde el inicio.
- **Reglamento embebido** en `NormativaPanel`; debe ser doc versionado en `docs/`.
- **Sin CI/CD**: ni lint ni typecheck automáticos. Workflow GitHub Actions inexistente.
- **Sin `engines`** en `package.json` ni `.nvmrc`. Riesgo de drift de versión Node entre devs.
- **Cómputo de juegos**: `getStandings` solo suma juegos de los **dos primeros sets** (`App.jsx:62 → if (index < 2)`). Esto deja el super tie-break fuera del cómputo de *diferencia de juegos*, lo cual es defendible (no es un set de 6 juegos), pero **debe quedar consagrado en el reglamento** para evitar disputas. Marcado como pregunta en `DECISIONES.md`.
- **Sin auditoría**: cualquier admin con push a `main` puede reescribir resultados sin trazabilidad. La nueva DB necesita `audit_log` con trigger.

### P2 — cosmética / mantenimiento

- Indentación inconsistente en `results.json`.
- Formato de fecha/hora libre en `schedules.json`; reemplazar por `timestamptz` + columna `court`.
- Códigos `A1..D4` mezclan rol de id, código display y orden. En el nuevo modelo separar `pair_id` (UUID) de `pair_code` (display, p.ej. seed dentro de la categoría).
- ESLint estricto activo (`--max-warnings 0`) pero sin Prettier ni `format` script — falta de uniformidad de formato.
- Sin SEO básico, sin `robots.txt`, sin Open Graph, sin `sitemap.xml`.

## Riesgos

- **Datos sensibles inminentes**: cuando se abran inscripciones, el sistema manejará nombre, email, teléfono y pago. Hoy no hay base RGPD ni texto legal; debe redactarse antes del primer formulario público.
- **Stripe**: cualquier integración requiere webhook firmado y conciliación. Salir mal de modo `test` por descuido publicaría un Checkout que cobra de verdad. El paso a `live` queda bloqueado tras aprobación explícita, según §10 del prompt.
- **Migración de histórico**: las 28 parejas 2025 son texto libre con nombres parciales. Importarlas a `players` requiere desambiguación humana — hay al menos dos jugadores distintos llamados **Hugo** (`B3 Hugo / Fran`, `B6 Guillem / Hugo Beser`, `C8 Hugo / Guillem`) y dos llamados **Jordi** (`A3 Jordi / Ivan`, `B5 Oscar / Jordi G.`, `D1 Mariano / Jordi M.`).
- **Adversarial editing histórico**: el repo actual permite a cualquier persona con push reescribir resultados. Sin `audit_log`, no hay forma de probar la integridad histórica. Mitigado al migrar a DB con triggers.
- **Tiempos**: el prompt enumera 6 sprints + hardening + despliegue. Sin un calendario concreto (a definir en `PROPUESTA_EDICION_<AÑO>`) el alcance puede deslizarse.

## Reutilizable vs reescribir (consolidado)

| Elemento | Reutilizar | Adaptar | Reescribir |
|---|:---:|:---:|:---:|
| `getStandings`, `getMatchResult`, `generateMatches` | ✓ (portar a TS + tests) | | |
| `ClassificationTable`, `MatchCard`, `Group`, `NormativaPanel` | ✓ (a Next.js + shadcn/ui) | | |
| `FinalsBracket` (JSX) | | ✓ (separar render de derivación de cruces) | |
| Tailwind tokens y paleta | ✓ | | |
| Datos de parejas / resultados 2025 | | ✓ (importar como histórico) | |
| `initialTournamentData`, `FINAL_SCHEDULES` | | | ✓ → tablas |
| `useEffect` fetch + deep-clone matching | | | ✓ → Supabase client + Realtime |
| Reglamento embebido | | | ✓ → `docs/REGLAMENTO_<AÑO>.md` |
| Persistencia, auth, pagos, notificaciones, CI/CD, tests, observabilidad | | | ✓ desde cero |

## Estado git / GitHub

- Rama actual: `claude/tournament-discovery-odMYj`. Working tree limpio en el momento de la auditoría.
- Rama de referencia: `main`.
- Remotos: un único `origin` apuntando a `JonatanGhub/Torneig_Local_Padel_2025_vinroma` (a través del proxy del entorno).
- Total de commits: **53**. Autores: `JonatanGhub` (42) y `Jonatan Garcia` (11) — probablemente la misma persona con dos identidades git.
- **23 commits (≈43 %)** con mensaje *"Actualizar results.json"*. No hay convención (Conventional Commits o equivalente).
- **Tags / releases: 0**. Sin versionado semántico.
- **Issues abiertos o cerrados: 0** (consultado vía GitHub MCP).
- **Pull Requests: 1**, ya cerrado y merged: [#1 *"Visual Improvements and Refactor"*](https://github.com/JonatanGhub/Torneig_Local_Padel_2025_vinroma/pull/1) (jul 2025), del propio `JonatanGhub`.
- Descripción oficial del repo en GitHub: *"repositorio del codigo web de gestión del torneo local de les Coves de Vinromà 2025"*.

## Configuración sensible y secretos

- `find . -maxdepth 3 -name ".env*"` → **sin resultados**.
- Inspección rápida de `src/`, `public/`, configs y `README.md` → **ninguna URL de Supabase, clave Stripe, token Resend ni cliente Sentry presentes**. La integración de servicios externos será un greenfield.
- El primer `.env.local` se introducirá en el Sprint 1 con la guía de `docs/ENV.md` (Fase 5 del plan).

## Próximos pasos (qué desbloquea esta auditoría)

1. **Stop point #1**: aprobar este documento o solicitar cambios.
2. Pasar a **Fase 1**: generar `docs/DECISIONES.md` con la lista mínima del prompt (§3) **más** estas entradas que esta auditoría sugiere añadir:
   - **Continuidad histórica**: importar parejas 2025 al nuevo modelo sí/no; arrastrar ranking entre ediciones sí/no.
   - **Cómputo del super tie-break en la diferencia de juegos**: mantener el comportamiento actual (`if (index < 2)`) o cambiarlo, y consagrarlo en el reglamento.
   - **Estrategia de migración del repo**: instalar Next.js + Supabase en este mismo repo desplazando el visor a `legacy/`, o crear un repo nuevo y archivar este como dataset histórico.
   - **Política de auditoría**: registrar autoría y timestamp en cada modificación de resultados (`audit_log` + triggers) — confirmar alcance.
3. No avanzar a Fase 2 hasta cerrar Decisiones.
