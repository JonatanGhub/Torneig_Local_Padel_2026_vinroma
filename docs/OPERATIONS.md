# OPERATIONS — Guía de operación en producción

> Complementa a `RUNBOOK.md` (setup inicial paso a paso). Aquí está lo necesario
> para **operar el sistema una vez en marcha**: entornos, observabilidad,
> backups, salud y respuesta a incidentes.

---

## 1. Entornos

| Entorno        | Frontend (Vercel)           | Base de datos (Supabase)        | Uso                                |
| -------------- | --------------------------- | ------------------------------- | ---------------------------------- |
| **Local**      | `pnpm dev` (localhost:3000) | Proyecto Supabase de pruebas    | Desarrollo                         |
| **Preview**    | Deploy automático por PR    | Mismo proyecto que producción\* | Revisión de cambios antes de merge |
| **Producción** | Deploy de `main`            | Proyecto Supabase de producción | Torneo real                        |

\* Para un torneo local con un único proyecto Supabase, Preview y Producción
comparten base de datos. Si se quiere aislamiento real, crear un segundo proyecto
Supabase y apuntar las variables `NEXT_PUBLIC_SUPABASE_*` de los Preview a él.

### Matriz de variables de entorno

Todas están documentadas en `.env.example`. Resumen por criticidad:

| Variable                                              | Local | Prod | Notas                                                         |
| ----------------------------------------------------- | :---: | :--: | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                            |  ✅   |  ✅  | Pública                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       |  ✅   |  ✅  | Pública                                                       |
| `SUPABASE_SERVICE_ROLE_KEY`                           |  ✅   |  ✅  | **Secreta. Solo servidor.** Salta RLS.                        |
| `SUPABASE_DB_URL`                                     |   —   |  ✅  | **Secreta.** Solo para el workflow de backup (pg_dump).       |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL`                |  ⛔   |  ✅  | Sin clave → email no-op. FROM debe ser dominio verificado.    |
| `EVOLUTION_*` / `WHATSAPP_GROUP_JID`                  |  ⛔   |  ✅  | Sin config → WhatsApp no-op.                                  |
| `CRON_SECRET`                                         |   —   |  ✅  | Bearer que Vercel Cron envía al endpoint de recordatorios.    |
| `NEXT_PUBLIC_SENTRY_DSN`                              |   —   |  ✅  | Sin DSN → Sentry no-op. Solo activo en `NODE_ENV=production`. |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` |   —   |  ✅  | Subida de source maps. Sin token, el build NO falla.          |

---

## 2. Observabilidad

### Sentry (errores + rendimiento)

- Configurado en `sentry.server.config.ts`, `sentry.edge.config.ts` e
  `instrumentation-client.ts`. **No-op por defecto**: solo envía eventos si
  `NEXT_PUBLIC_SENTRY_DSN` está presente y `NODE_ENV=production`.
- Errores de React Server Components se capturan vía `onRequestError`
  (`instrumentation.ts`).
- Muestreo configurable con `SENTRY_TRACES_SAMPLE_RATE` (def. 0.1).
- Setup: crear proyecto en Sentry → copiar DSN a Vercel → añadir
  `SENTRY_AUTH_TOKEN/ORG/PROJECT` para que el build suba source maps.

### Health check

- `GET /api/health` → `200 {status:"ok", db:"up", latencyMs, version}` si la BD
  responde; `503 {status:"degraded", db:"down", error}` si no.
- No cacheado (`Cache-Control: no-store`), sin filtración de datos.
- Conectar a un monitor externo (UptimeRobot, Better Uptime, Vercel Monitoring)
  apuntando a `https://<dominio>/api/health` cada 1-5 min.

### Logs

- Logs de runtime: panel de Vercel → Deployment → Runtime Logs.
- Envíos de email/WhatsApp fallidos se registran con `console.warn` y **nunca
  rompen** la mutación principal (resultado, reschedule, etc.).

---

## 3. Backups y restauración

### Capa 1 — Supabase gestionado

Supabase realiza backups automáticos diarios (según plan). Point-in-time recovery
disponible en planes de pago. Es la primera línea de recuperación.

### Capa 2 — Backup propio (este repo)

- Workflow `.github/workflows/backup.yml`: `pg_dump` diario (03:15 UTC) +
  `workflow_dispatch` manual. Requiere el secret de repositorio
  `SUPABASE_DB_URL`. Si el secret no existe, el job se **salta** (no falla).
- Genera dos formatos por ejecución y los sube como artefacto (retención 30 días):
  - `padel-<stamp>.sql.gz` — SQL plano gzip (restauración parcial fácil).
  - `padel-<stamp>.dump` — formato custom (`pg_restore` selectivo).

### Restaurar

```bash
# Descargar el artefacto desde GitHub Actions → Artifacts.

# Opción A — SQL plano:
gunzip -c padel-<stamp>.sql.gz | psql "$SUPABASE_DB_URL"

# Opción B — formato custom (selectivo, recomendado):
pg_restore --no-owner --no-privileges -d "$SUPABASE_DB_URL" padel-<stamp>.dump
```

> Antes de restaurar sobre producción: hacer primero un dump del estado actual
> por si hay que revertir la restauración.

---

## 4. Tareas programadas (cron)

- `vercel.json` define **1 cron** (plan Hobby permite 1): `/api/cron/match-reminders`
  a las 07:00 UTC. Envía recordatorios de partido (WhatsApp DM a capitanes) y el
  resumen diario "Avui es juga" al grupo de gestión.
- El endpoint exige `Authorization: Bearer $CRON_SECRET`.

---

## 5. Despliegue

1. Merge a `main` → Vercel despliega automáticamente.
2. CI (`.github/workflows/ci.yml`) debe estar verde: format, lint, typecheck,
   **test**, build.
3. Migraciones de BD: aplicar **antes** de desplegar código que las requiera
   (ver `RUNBOOK.md` §7 "Aplicar nuevas migraciones").
4. Rollback de frontend: en Vercel, "Promote to Production" sobre el deploy
   anterior. Rollback de BD: restaurar backup (§3) — **úsese con cuidado**, las
   migraciones no siempre son reversibles.

---

## 6. Respuesta a incidentes (runbook rápido)

| Síntoma                    | Primer diagnóstico                                              |
| -------------------------- | --------------------------------------------------------------- |
| `/api/health` devuelve 503 | BD caída/alcanzada: panel Supabase, estado del proyecto, quota. |
| Errores 500 en el sitio    | Sentry → último issue; Vercel Runtime Logs del deploy actual.   |
| No llegan emails           | `RESEND_API_KEY` presente; dominio verificado; logs Resend.     |
| No llegan WhatsApp         | `EVOLUTION_*` presentes; instancia conectada; warn en logs.     |
| Recordatorios no se envían | `CRON_SECRET` correcto; ejecución del cron en Vercel.           |
| Magic link no funciona     | Config Auth Supabase (URLs de redirect), plantillas de correo.  |

---

## 7. Seguridad operativa

- **Nunca** exponer `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_DB_URL` al cliente
  ni commitearlas. Viven solo en Vercel (env) y GitHub (secrets).
- Rotación: si se filtra una clave, regenerarla en Supabase/Resend/Evolution y
  actualizar Vercel + GitHub Secrets.
- RLS está activo en todas las tablas; el service role solo se usa en código de
  servidor (cron, notificaciones, health) donde es imprescindible.
