# V Torneig de Pàdel les Coves de Vinromà — 2026

Aplicación web oficial de la V edició del torneig local. Inscripciones, sorteo
de cuadros, reporte de resultados con validación cruzada y publicación pública
de clasificaciones en vivo.

## Estado

- ✅ **Fase 0 — Auditoría** (commit `bee06b0`).
- ✅ **Fase 1 — Decisiones** (PR #3 mergeado). Ver [`docs/DECISIONES.md`](docs/DECISIONES.md).
- 🚧 **Sprint 1 — Foundation** (rama actual): scaffold de Next.js + Supabase + auth + schema base + CI.

## Stack

| Capa           | Tecnología                                                        |
| -------------- | ----------------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router) + React 19 + TypeScript strict            |
| Estilos        | Tailwind CSS v4 + shadcn/ui (paleta placeholder neutral)          |
| i18n           | next-intl (ca por defecto, es alternativo)                        |
| Backend / DB   | Supabase Cloud (Postgres + Auth + Storage + Edge Functions + RLS) |
| Email          | Resend + React Email                                              |
| WhatsApp       | Meta WhatsApp Cloud API (Sprint 4)                                |
| Pagos          | Bizum + transferencia bancaria, conciliación manual               |
| Observabilidad | Sentry Free (Sprint 5)                                            |
| Despliegue     | Vercel (frontend) + Supabase Cloud (data)                         |
| CI             | GitHub Actions: format check + lint + typecheck + build           |

## Setup local

> Tiempo estimado: 30-45 min la primera vez (incluye crear cuentas Supabase y Vercel).
> Si ya tienes ambas configuradas, ~5 min.

### 1. Prerrequisitos

```bash
node --version   # >= 20
pnpm --version   # >= 9
```

Si no tienes pnpm:

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

### 2. Clonar e instalar

```bash
git clone https://github.com/JonatanGhub/Torneig_Local_Padel_2025_vinroma.git
cd Torneig_Local_Padel_2025_vinroma
pnpm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Luego edita `.env.local` y rellena los valores siguiendo
[`docs/RUNBOOK.md`](docs/RUNBOOK.md). Si todavía no tienes cuenta Supabase
ni Vercel, el RUNBOOK te guía paso a paso.

### 4. Arrancar el dev server

```bash
pnpm dev
```

Abre http://localhost:3000 (redirige a `/ca`).

## Scripts disponibles

| Comando             | Descripción                                        |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo con Turbopack               |
| `pnpm build`        | Build de producción                                |
| `pnpm start`        | Servidor de producción (tras `build`)              |
| `pnpm lint`         | ESLint                                             |
| `pnpm typecheck`    | TypeScript en modo `--noEmit`                      |
| `pnpm format`       | Prettier write                                     |
| `pnpm format:check` | Prettier check (lo mismo que en CI)                |
| `pnpm db:types`     | Regenera `types/supabase.ts` desde el schema local |
| `pnpm db:reset`     | Reset + reapply migrations + seed (sólo dev local) |
| `pnpm db:diff`      | Diff entre schema local y migrations               |

## Estructura del proyecto

```
app/                     # Next.js App Router
├── [locale]/            # rutas con prefijo ca/es
│   ├── layout.tsx
│   ├── page.tsx         # landing pública
│   └── (auth)/login/
└── auth/callback/       # callback de magic link Supabase
components/
├── ui/                  # shadcn primitives
lib/
├── supabase/            # client/server/middleware helpers
└── utils.ts
messages/                # i18n JSON (ca, es)
supabase/
├── config.toml
├── migrations/          # SQL migraciones
└── seed.sql
docs/
├── DECISIONES.md        # Fase 1
├── PROPUESTA_FORMATOS.md
├── AUDITORIA.md         # Fase 0
└── RUNBOOK.md           # setup paso a paso
```

## Convenciones de desarrollo

- **TypeScript estricto**: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
- **No commits directos a `main`**. Una rama por sprint (`feat/sprint-N-*`), tags `v0.X.0` al cerrar.
- **No `any`**: usar tipos generados de Supabase (`types/supabase.ts`) o `unknown` + narrowing.
- **No `cookie` mutations en server components**: usar el cliente de `lib/supabase/server.ts`.
- **Comentarios mínimos**: nombre el código bien. Sólo comentar el "porqué", no el "qué".

## Roadmap

- **Sprint 1** (rama actual): foundation — scaffold + schema + auth.
- **Sprint 2**: inscripción pública + pago Bizum/transferencia + conciliación admin.
- **Sprint 3**: sorteo + cuadros + panel admin v1.
- **Sprint 4**: reporte de resultados con validación cruzada + WhatsApp notifications.
- **Sprint 5**: clasificaciones en vivo + diseño definitivo + sponsors + Sentry.
- **Sprint 6**: hardening + RGPD + backups + checklist pre-live.

## Decisiones clave de Fase 1

- 4 categorías por nivel mixtas
- Tercer set completo al 6 (sin super tie-break)
- Bizum **y** transferencia bancaria al IBAN del club (equivalentes)
- Modelo de pago dual (1 transacción por pareja recomendada, 1 por persona alternativa)
- Calendario: 1 jun apertura · 30 jun cierre · 6 jul - 9 ago partidos
- RGPD: Club Padel les Coves como Responsable; anonimización T+30 días tras final; sin publicación de fotos

> Ver [`docs/DECISIONES.md`](docs/DECISIONES.md) para el documento completo
> (32 secciones, 2 papeletas a capitanes).

## Licencia

Proyecto privado del Club Padel les Coves. Todos los derechos reservados.
