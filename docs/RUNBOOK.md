# RUNBOOK — Setup operativo del torneig

> Audiencia: el organizador (no necesariamente técnico) y futuros mantenedores.
> Objetivo: en 30-45 minutos pasar de "repo recién clonado" a "preview deployment
> funcionando en Vercel con Supabase real". Sigue los pasos en orden.

## 0. Antes de empezar

Necesitas crear/tener:

- Una cuenta de **GitHub** (donde ya tienes el repo).
- Una cuenta de **Vercel** ([vercel.com](https://vercel.com)) — gratuita con login GitHub.
- Una cuenta de **Supabase** ([supabase.com](https://supabase.com)) — gratuita con login GitHub.
- Una cuenta de **Resend** ([resend.com](https://resend.com)) — gratuita con login GitHub (puedes posponer a Sprint 2 si quieres).

Tiempo estimado total: **35 minutos** (5 min Vercel + 15 min Supabase + 5 min Resend + 10 min wiring).

## 1. Crear el proyecto Supabase

1. Entra en https://supabase.com/dashboard → "New project".
2. Configura:
   - **Name**: `torneig-padel-vinroma`
   - **Database password**: genera una y guárdala en un gestor (no la pierdas).
   - **Region**: `Central EU (Frankfurt)` — coherente con §21.7 (UE).
   - **Pricing plan**: Free.
3. Espera ~2 minutos a que se provisione.
4. Una vez listo, en el panel del proyecto:
   - **Project Settings → API** → copia:
     - `Project URL` → será tu `NEXT_PUBLIC_SUPABASE_URL`.
     - `anon public` key → será tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
     - `service_role` key (¡no la compartas!) → será tu `SUPABASE_SERVICE_ROLE_KEY`.

### 1.1. Aplicar el schema base

Opción A — desde la web (más simple):

1. **Project → SQL Editor → New query**.
2. Copia y pega el contenido completo de `supabase/migrations/20260513120000_initial_schema.sql`.
3. Click "Run".
4. Comprueba que no hay errores. Si todo va bien, verás las tablas `tournaments`, `players`, `pairs`, etc. en **Table Editor**.

Opción B — desde CLI (si tienes la CLI de Supabase instalada):

```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

### 1.2. Configurar Auth

1. **Project → Authentication → Providers → Email**:
   - Activa "Enable Email Provider".
   - Desactiva "Confirm email" (los magic links ya son confirmación).
2. **Authentication → URL Configuration**:
   - **Site URL**: temporalmente `http://localhost:3000` (en producción será tu URL de Vercel).
   - **Redirect URLs** (whitelist):
     - `http://localhost:3000/auth/callback`
     - `https://torneigpadelvinroma-v-2026.vercel.app/auth/callback` (cuando exista)
     - `https://*-jonatanghub.vercel.app/auth/callback` (previews)
3. **Authentication → Email Templates → Magic Link**: opcional, lo podemos retocar en Sprint 2 cuando integremos Resend.

## 2. Configurar Vercel

1. https://vercel.com → "Add new... → Project".
2. Importa el repo `Torneig_Local_Padel_2025_vinroma`.
3. **Framework Preset**: Next.js (lo detecta solo).
4. **Build settings**: dejar los defaults (`pnpm install`, `pnpm build`).
5. **Environment Variables** (pestaña "Environment Variables" al crear el proyecto):
   ```
   NEXT_PUBLIC_SUPABASE_URL = (el de Supabase)
   NEXT_PUBLIC_SUPABASE_ANON_KEY = (el de Supabase)
   SUPABASE_SERVICE_ROLE_KEY = (el de Supabase, SECRETO)
   NEXT_PUBLIC_SITE_URL = https://torneigpadelvinroma-v-2026.vercel.app
   NEXT_PUBLIC_DEFAULT_LOCALE = ca
   ```
   Resend, Sentry y WhatsApp los rellenamos en sus respectivos sprints.
6. Click "Deploy". Espera ~2 minutos.

Después de desplegar, asigna el subdominio:

1. **Project → Settings → Domains**.
2. Por defecto Vercel te da `torneig-local-padel-2025-vinroma-<hash>.vercel.app`. Edítalo a `torneigpadelvinroma-v-2026.vercel.app` si está disponible.

## 3. Configurar Resend (puedes saltarlo en Sprint 1)

> Resend se usa para emails transaccionales: confirmación de inscripción,
> avisos de partido, validación cruzada. En Sprint 1 sólo está la auth, que
> usa el remitente por defecto de Supabase. Pasa al Sprint 2 si quieres
> mantenerlo simple.

1. https://resend.com → API Keys → "Create API key".
2. Copia y guarda como `RESEND_API_KEY` en Vercel y `.env.local`.
3. Para usar tu propio dominio remitente (`@clubpadelvinroma.com`), añade los registros DNS que Resend te indique. Si todavía no tienes dominio propio, usa el remitente por defecto de Resend (`onboarding@resend.dev`) durante desarrollo.

## 4. Setup local

```bash
git clone <repo>
cd Torneig_Local_Padel_2025_vinroma
pnpm install
cp .env.example .env.local
# Edita .env.local con los valores de Supabase
pnpm dev
```

Si todo va bien, http://localhost:3000 redirige a `/ca` y muestra la landing.

## 5. Conexión Supabase ↔ Vercel automática (opcional pero recomendado)

Vercel tiene una integración nativa que sincroniza las claves automáticamente:

1. https://vercel.com/integrations/supabase → "Add Integration".
2. Selecciona el proyecto Vercel y el proyecto Supabase.
3. Acepta los permisos.

A partir de aquí, las variables `NEXT_PUBLIC_SUPABASE_*` se actualizan
automáticamente en Vercel si rotas las claves en Supabase.

## 6. Verificación final (checklist)

- [ ] http://localhost:3000 muestra la landing en catalán.
- [ ] Cambiar a `/es` muestra la versión en castellano.
- [ ] `pnpm typecheck` pasa sin errores.
- [ ] `pnpm build` completa sin errores.
- [ ] `pnpm lint` pasa.
- [ ] El deploy de Vercel pasa CI (verde en el PR).
- [ ] En Supabase, **Table Editor → tournaments** muestra una fila de "V Torneig 2026".
- [ ] En Supabase, **Table Editor → tournament_fees** muestra 4 filas (los 3 tramos + recargo).
- [ ] En Supabase, **Table Editor → categories** muestra 4 filas (1ª-4ª).

## 7. Operaciones de mantenimiento

### Aplicar nuevas migraciones

Cuando un sprint añade una migración nueva:

```bash
# Desde local
supabase db push  # aplica al proyecto Supabase conectado
```

O desde la web: copiar el SQL nuevo y ejecutarlo en SQL Editor.

### Backup manual

Cada semana antes del torneo (§29):

```bash
supabase db dump --schema public > backups/$(date +%Y-%m-%d).sql
```

Sube el archivo a Supabase Storage (bucket `backups`, retención manual) o a
Google Drive personal.

### Restore en caso de catástrofe

1. Supabase → **Project Settings → Database → Backups → Restore** (último backup nativo, retención 7 días en plan Free).
2. Si necesitas restaurar manualmente desde el dump SQL:
   ```bash
   supabase db reset --linked  # ⚠️ destructivo
   psql <supabase-connection-string> < backups/<fecha>.sql
   ```

### Desconectar Netlify

> Sprint 1 incluye este paso operativo.

1. https://app.netlify.com → sitio `torneig-local-vinroma-2025`.
2. **Site settings → General → Danger zone → Delete this site**.
3. O alternativa: **Site settings → Build & deploy → Stop auto publishing**.

## 8. Troubleshooting

### "Invalid API key" en localhost

- Comprueba que `.env.local` está en la raíz y tiene los 3 valores de Supabase.
- Reinicia `pnpm dev` (las env vars no se recargan en caliente).

### El email del magic link no llega

- Comprueba en Supabase **Authentication → Logs** si el envío se ha intentado.
- En Free tier, Supabase usa su propio SMTP y a veces va a spam — revisa la carpeta.
- En Sprint 2 lo reemplazaremos por Resend para mejor entregabilidad.

### `pnpm build` falla con "Cannot find module"

```bash
rm -rf node_modules .next
pnpm install
pnpm build
```

### CI en GitHub falla en `format:check`

```bash
pnpm format    # arregla todo y deja un diff
git add -A
git commit -m "chore: format"
```

## 9. Datos pendientes del organizador (§ DECISIONES.md)

Antes de pasar a producción (Sprint 6), aporta:

- **CIF del club** (para política de privacidad).
- **Dirección postal del club** (para política de privacidad).
- **Teléfono Bizum del club** y **IBAN del club** (para pantalla de pago en Sprint 2).
- **Lista de patrocinadores** con logos y contrapartidas (para Sprint 5).

Pasa los valores actualizando `.env.local` (o variables en Vercel) y, los que
correspondan a textos legales (CIF, dirección), creando un PR a
`docs/DECISIONES.md`.
