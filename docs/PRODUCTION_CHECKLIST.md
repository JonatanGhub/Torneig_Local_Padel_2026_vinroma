# PRODUCTION CHECKLIST — Puesta en marcha (go-live)

> Lista de verificación previa al lanzamiento del torneo. Marca cada ítem antes
> de abrir inscripciones. Los ítems **[ORG]** dependen de datos que aporta el
> organizador; los **[TECH]** son técnicos. Ver detalle en `DECISIONES.md` y
> `OPERATIONS.md`.

## A. Datos del organizador (bloqueantes de negocio)

- [ ] **[ORG]** Datos bancarios para pagos (§16): teléfono **Bizum** + **IBAN**
      del club, publicados en las páginas de pago (`/p/[reference]`).
- [ ] **[ORG]** Datos legales del club (§21): nombre legal, **CIF**, dirección
      postal → `club_settings`.
- [ ] **[ORG]** Persona de contacto (§12): nombre, teléfono, email.
- [ ] **[ORG]** **Cuota** definitiva (§14): importe por jugador y tramos/fechas
      → `tournament_fees`.
- [ ] **[ORG]** **Fechas** del torneo (§12): apertura/cierre de inscripción,
      sorteo, primer partido, final → `tournaments`. **Crítico:** `final_at`
      alimenta el trigger de anonimización RGPD (T+15 días).
- [ ] **[ORG]** Logos y URLs de **patrocinadores** (§20) → `sponsors`.

## B. Configuración de servicios (TECH)

- [ ] **[TECH]** Proyecto Supabase de producción creado; todas las migraciones
      aplicadas (`supabase/migrations`, 22 ficheros).
- [ ] **[TECH]** Variables en Vercel (Producción): `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
      `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE`.
- [ ] **[TECH]** **Resend**: `RESEND_API_KEY` + `RESEND_FROM_EMAIL` con dominio
      **verificado** (no `onboarding@resend.dev`). Ver `RESEND_DOMAIN_SETUP.md`.
- [ ] **[TECH]** **WhatsApp** (opcional): `EVOLUTION_API_URL/KEY/INSTANCE` y
      `WHATSAPP_GROUP_JID`. Sin esto, los avisos son no-op (no rompen).
- [ ] **[TECH]** `CRON_SECRET` definido y coincidente con la config de Vercel Cron.
- [ ] **[TECH]** **Sentry**: `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN/ORG/PROJECT`.
- [ ] **[TECH]** **Backup**: secret de repo `SUPABASE_DB_URL` configurado; lanzar
      `DB Backup` manualmente una vez (`workflow_dispatch`) para validar.
- [ ] **[TECH]** Monitor externo apuntando a `/api/health`.

## C. Acceso y roles

- [ ] **[TECH]** Cuenta **admin** provisionada: la cuenta del club
      (`clubpadelvinroma@gmail.com`) debe hacer login (magic link) una vez para
      que el trigger le asigne `role=admin`. Verificar acceso a `/admin`.
- [ ] **[TECH]** Verificar que un capitán de prueba puede entrar a `/captain` y
      que un usuario anónimo **no** ve datos privados.

## D. Verificación funcional (dry-run end-to-end)

- [ ] Inscripción de una pareja de prueba (con y sin menor de edad).
- [ ] Generación de referencia de pago + conciliación manual en `/admin/payments`.
- [ ] Sorteo de grupos (`/admin/draw`) y visualización pública en `/grups/[level]`.
- [ ] Programación de partidos (`/admin/matches`) y `/calendari` + feed iCal.
- [ ] Reporte cruzado de resultado por ambos capitanes → validación / disputa.
- [ ] Avance a cuadro eliminatorio y vista `/quadre/[level]`.
- [ ] Emails transaccionales recibidos (inscripción, pago, resultado).
- [ ] (Si WhatsApp activo) recordatorio diario + aviso de resultado al grupo.

## E. Calidad / seguridad (TECH)

- [ ] CI verde en `main`: format, lint, typecheck, **test**, build.
- [ ] RLS activo y revisado en todas las tablas; service role solo en servidor.
- [ ] Páginas legales publicadas: `/privacitat`, `/avis-legal`, `/cookies`.
- [ ] Consentimientos RGPD recogidos en el formulario de inscripción.
- [ ] `final_at` fijado para que la anonimización (T+15) se dispare correctamente.

## F. Decisiones de producto cerradas

- [x] **Formato (§3): Grupos + Eliminatorias**, 2 clasificados por grupo. ✅
- [x] Pagos: Bizum / transferencia con conciliación manual (Stripe descartado, §17). ✅
- [x] Idiomas: ca (def.) + es. ✅
- [x] 4 categorías por nivel, mixtas (§4). ✅

---

> Cuando A–E estén marcados y F confirmado, el sistema está listo para abrir
> inscripciones. Ver `OPERATIONS.md` para la operación del día a día.
