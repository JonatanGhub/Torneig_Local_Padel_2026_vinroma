# Torneig Local de Pàdel — Les Coves de Vinromà

> Repositorio en proceso de reconstrucción. El código y los datos de la **IV edición (2025)** se han retirado del árbol activo tras la auditoría de la Fase 0 y solo permanecen en el historial git pre-rebuild. La próxima edición se desarrolla aquí desde cero, con un stack y una arquitectura nuevos.

## Estado actual

- **Fase 0 — Discovery**: ✅ completada. Documento de auditoría en [`docs/AUDITORIA.md`](docs/AUDITORIA.md).
- **Fase 1 — Decisiones**: en curso. Documento pendiente en `docs/DECISIONES.md`.
- **Fases 2–5**: pendientes (propuesta ejecutiva, reglamento, arquitectura, implementación, despliegue).

El plan completo está descrito en el prompt de bootstrap que originó este rebuild.

## Stack objetivo (resumen)

- **Frontend público + admin**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui.
- **Backend / DB**: Supabase (Postgres + Auth + Realtime + Storage + Edge Functions + RLS).
- **Pagos**: Stripe Checkout + webhooks → Supabase Edge Function.
- **Email**: Resend (transaccional) con plantillas en React Email.
- **Despliegue**: Vercel (frontend) + Supabase Cloud.
- **Observabilidad**: Sentry + Vercel Analytics.
- **CI/CD**: GitHub Actions (lint, typecheck, test, build, preview, migraciones en staging).

> Justificación de cada elección y diagrama de arquitectura en `docs/ARQUITECTURA.md` (Fase 3, todavía no escrita).

## Edición 2025 (legado)

El visor estático React + Vite que servía la IV edición está disponible en el historial git previo al merge de la rama `claude/tournament-discovery-odMYj` a `main`. Si en la Fase 1 se aprueba **continuidad histórica**, los resultados se reimportarán de forma controlada a las nuevas tablas con consentimiento RGPD; en caso contrario, la edición 2025 quedará como dataset histórico congelado.

## Cómo contribuir

Aún no hay setup local — la rama `main` no contiene código ejecutable mientras dura la reconstrucción. El primer setup (Sprint 1: Next.js + Supabase + scripts) llegará tras cerrar `docs/DECISIONES.md`.
