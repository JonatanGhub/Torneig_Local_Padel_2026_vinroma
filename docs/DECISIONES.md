# Decisiones pendientes — Fase 1

> Entregable de la Fase 1 del bootstrap. Cada bloque lista **opciones**, da una **recomendación técnica con justificación de 2-3 líneas** y deja un campo **RESPUESTA** vacío para que lo rellenes. Hasta que todas las decisiones queden cerradas no se pasa a la Fase 2 (`PROPUESTA_EDICION_<AÑO>.md` + `REGLAMENTO_<AÑO>.md`).
>
> Algunas decisiones ya están cerradas en la conversación previa y se documentan en la sección final como referencia.
>
> Convención: cuando una decisión depende de otra, está marcada con `→ depende de §N`.

---

## §1. Año y nomenclatura de la edición

**Contexto.** El repo aloja la **IV edición (2025)**. La nueva pasa a ser la **V** salvo que se decida saltar números. Sin un año/nombre claros no podemos crear `docs/PROPUESTA_EDICION_<AÑO>.md`, `docs/REGLAMENTO_<AÑO>.md`, `tournaments.slug`, ni el dominio.

**Opciones.**
- (a) V Torneig de Pàdel Les Coves de Vinromà **2026**.
- (b) V Torneig de Pàdel Les Coves de Vinromà **2025-26** (si se planifica solapando años).
- (c) Otro nombre (rebranding total: cambio de patrocinador, sede, etc.).

**Recomendación.** (a). Continuidad numérica con 2025, año natural alineado con la planificación habitual del club. Cambiar de marca añade fricción y riesgo de pérdida de tracción del público local.

**RESPUESTA:** 

---

## §2. Idioma(s) de la web

**Contexto.** El visor 2025 estaba en catalán (con UI mixta cast/cat). La inscripción y el reglamento son textos sensibles que conviene firmar en un solo idioma legal.

**Opciones.**
- (a) **Bilingüe ca / es**, catalán por defecto, conmutador en navbar.
- (b) Solo catalán.
- (c) Solo castellano.
- (d) Trilingüe ca / es / en.

**Recomendación.** (a). Catalán por defecto respeta el carácter local; castellano facilita inscripciones de jugadores de fuera de la zona y reduce ambigüedad en textos legales (RGPD). El inglés añade coste de traducción sin demanda real probada.

**RESPUESTA:** 

---

## §3. Formato de competición

**Contexto.** La edición 2025 usó *grupos round-robin + KO* con cuadro principal y cuadro de consolación. La auditoría considera este formato sólido.

**Opciones.**
- (a) **Grupos round-robin + KO** (igual que 2025), con cuadro consolación para los eliminados.
- (b) Liga única round-robin (sin KO), gana quien sume más puntos.
- (c) Liga + playoff entre los N primeros.
- (d) Americana (rotación libre de parejas, no aplicable a torneo cerrado).

**Recomendación.** (a). Ya validado; ofrece picos de drama (semis + final), tolera bien 8-16 parejas por categoría, y la lógica de cuadro consolación garantiza que cada pareja juegue ≥3 partidos.

**RESPUESTA:** 

---

## §4. Número y criterios de categorías

**Contexto.** 2025 tuvo 4 categorías por nivel (1ª, 2ª, 3ª, 4ª) sin separación de género/edad.

**Opciones.**
- (a) **4 categorías por nivel** (1ª, 2ª, 3ª, 4ª), mixtas en género.
- (b) 3 categorías por nivel (compactación).
- (c) 5 categorías por nivel (más granularidad si hay demanda).
- (d) 4 por nivel + 1 femenina separada.
- (e) Mixto explícito (parejas hombre-mujer) como categoría adicional.

**Recomendación.** (a). Continuidad con 2025, equilibrio entre inclusividad y operativa (un comité asigna nivel en base a la inscripción declarada y el histórico). Reabrir el debate de género/edad puede convertirse en una decisión política sin beneficio operativo.

**RESPUESTA:** 

---

## §5. Tamaño de los grupos y nº de clasificados

**Contexto.** 2025: grupos de 4 parejas, 2 clasifican al KO. La 4ª categoría tuvo grupo único de 4 (sin SF). → depende de §3 si se cambia formato.

**Opciones.**
- (a) **Grupos de 4, clasifican 2** (≡ 2025). Cada pareja juega 3 partidos en fase de grupos.
- (b) Grupos de 3, clasifican 2 (más KO, menos grupo).
- (c) Grupos de 5, clasifican 2 (más volumen de partidos, más calendario).
- (d) Otros (especificar).

**Recomendación.** (a). 3 partidos de grupo es el sweet spot: garantiza tiempo en pista a todos los inscritos sin alargar el calendario. Matemáticas limpias para 8 / 16 / 32 parejas por categoría.

**RESPUESTA:** 

---

## §6. Capacidad por categoría y total

**Contexto.** 2025 tuvo 8 parejas en 1ª/2ª/3ª y 4 en 4ª. → depende de §5.

**Opciones.**
- (a) **Mismo dimensionado que 2025**: 8 + 8 + 8 + 4 = 28 parejas (56 jugadores).
- (b) 8 por categoría incluyendo 4ª = 32 parejas (64 jugadores).
- (c) 16 por categoría = 64 parejas (128 jugadores) — implica logística mayor.
- (d) Open con cupo flexible, fill rate decidirá la subdivisión.

**Recomendación.** (b) **8 × 4 = 32 parejas** si la demanda lo soporta. Iguala estructura entre categorías (todas con 2 grupos × 4) y simplifica la generación de cuadros KO. Si en 2025 la 4ª solo llenó 4, valorar (a).

**RESPUESTA:** 

---

## §7. Criterios de desempate en la fase de grupos

**Contexto.** `getStandings` actual ordena por: P → diferencia sets → diferencia juegos → head-to-head. Esto debe consagrarse en el reglamento.

**Opciones.**
- (a) **P → ΔSets → ΔJuegos → H2H** (≡ 2025).
- (b) P → H2H → ΔSets → ΔJuegos (prioriza el enfrentamiento directo).
- (c) Añadir Quociente de juegos (JG/(JG+JP)) como criterio adicional.

**Recomendación.** (a). Es lo que el público ya conoce y se ha aplicado durante toda la edición 2025. H2H en última posición evita inconsistencias cuando hay triple empate (donde H2H no es transitivo). Documentar explícitamente que en triple empate se aplica el orden global (no recalcula sub-tabla H2H).

**RESPUESTA:** 

---

## §8. Cómputo del super tie-break en la diferencia de juegos

**Contexto.** Hallazgo del audit: `App.jsx:62` (`if (index < 2)`) excluye el super tie-break (set 3, a 10) del recuento de juegos. Funciona como tiebreak, no como set de 6 juegos.

**Opciones.**
- (a) **No contar el STB en ΔJuegos** (≡ 2025). El STB solo cuenta como set ganado/perdido.
- (b) Contar STB como un set normal (`10-8` suma 10 a JG y 8 a JP).
- (c) Contar STB con peso reducido (p.ej. cada punto vale 0.5 juego).

**Recomendación.** (a). El STB no es un set de 6 juegos, es un decisor; mezclarlo en ΔJuegos infla artificialmente las diferencias en los empates 1-1. Opción consistente con la práctica FIP/AJP en formatos amateur.

**RESPUESTA:** 

---

## §9. Política de walkover (no presentación)

**Contexto.** Se necesita una regla operable en sistema y comprensible para los inscritos.

**Opciones.**
- (a) **6-0 6-0 a favor del rival** (común en muchos reglamentos amateur españoles).
- (b) 2-0 sin marcador (solo cuenta como partido ganado/perdido, no afecta ΔJuegos).
- (c) Anulación del partido (no se contabiliza).

**Recomendación.** (a). Simple de comunicar, fácil de modelar en `matches.status = 'walkover'` con `match_results` poblando 6-0 6-0; preserva la consistencia de ΔSets y ΔJuegos sin necesidad de excepciones especiales.

**RESPUESTA:** 

---

## §10. Política de retirada o lesión durante el torneo

**Contexto.** Pareja que abandona después de jugar algunos partidos.

**Opciones.**
- (a) **Mantener resultados ya jugados; los partidos restantes son walkover 6-0 6-0 a favor del rival** (recomendación).
- (b) Anular todos sus partidos (favorece al que perdió contra ellos).
- (c) Decisión caso a caso del comité.

**Recomendación.** (a). Justa con los rivales que ya jugaron y honesta con los que faltaban. (b) introduce incentivos perversos (eliminar partidos perdidos). (c) genera arbitrariedad.

**RESPUESTA:** 

---

## §11. Política de descalificación

**Contexto.** Conducta antideportiva, agresiones, incomparecencias reiteradas.

**Opciones.**
- (a) **Descalificación inmediata por decisión del comité**; resultados existentes se anulan retroactivamente.
- (b) Descalificación con preservación de resultados (igual que retirada §10).
- (c) Solo sanción económica.

**Recomendación.** (a). La descalificación es una sanción, no un accidente: anular partidos refleja la pérdida de elegibilidad. El reglamento debe definir taxativamente las causas (conducta, agresión, dopaje, fraude de inscripción).

**RESPUESTA:** 

---

## §12. Calendario, sede y pistas

**Contexto.** Sin datos no podemos calcular el `tournaments.start_date`, `end_date`, ni la planificación de pistas. **No tengo recomendación posible** — son datos del organizador.

**Campos requeridos:**
- Fecha de inicio (apertura de inscripciones): __________
- Fecha de cierre de inscripciones: __________
- Fecha de sorteo: __________
- Fecha de primer partido: __________
- Fecha de final: __________
- Sede principal (nombre y dirección): __________
- Pistas disponibles (nº y nombres, p.ej. "Pista Dalt", "Pista Baix"): __________
- Franja horaria diaria (de-a): __________
- Día(s) de la semana en que se juega: __________
- Persona/teléfono de contacto operativo: __________

**RESPUESTA:** (rellena los campos)

---

## §13. Cuota de inscripción

**Contexto.** Establece el flujo de pago (§16) y los precios de Stripe.

**Opciones.**
- (a) Tarifa única por pareja (típico amateur local: 20-35 €).
- (b) Tarifa por jugador (cada miembro paga su mitad por separado en Stripe).
- (c) Tarifa por pareja con descuento si ambos están federados / son socios del club.

**Recomendación.** (c) **Tarifa por pareja con descuento opcional**. Una sola transacción Stripe por pareja simplifica la conciliación y la cancelación. El descuento por federación / club es un *promo code* en Stripe Checkout.

**Campos a definir:**
- Tarifa estándar por pareja (€): __________
- Tarifa con descuento socio del club / federado (€): __________
- ¿Cuál es la entidad que valida la condición de socio?: __________

**RESPUESTA:** 

---

## §14. Descuentos por inscripción anticipada (*early bird*)

**Contexto.** Mecánica habitual para acelerar el fill rate y reducir incertidumbre.

**Opciones.**
- (a) **Early bird hasta fecha X**: precio reducido (-5 € o -10 %), después tarifa estándar.
- (b) Sin early bird.
- (c) Precio escalonado en 2-3 tramos.

**Recomendación.** (a) si las inscripciones se abren con ≥6 semanas de antelación al primer partido; (b) si la ventana es <4 semanas (el descuento no tiene tiempo de producir efecto).

**RESPUESTA:** 

---

## §15. Política de reembolso

**Contexto.** Sin política clara, cualquier reembolso queda a discreción del organizador → riesgo legal y operativo.

**Opciones.**
- (a) Sin reembolsos una vez confirmada la inscripción (excepto cancelación del torneo).
- (b) **Reembolso del 100 % hasta cierre de inscripciones; 0 % después**.
- (c) Reembolso del 100 % hasta cierre, 50 % hasta el sorteo, 0 % después.
- (d) Reembolso por causa justificada (lesión médica documentada) con criterio del comité.

**Recomendación.** (b). Simple de comunicar y operar; alinea incentivos (no inscribirse sin compromiso). El caso médico se gestiona como excepción con prueba documental.

**RESPUESTA:** 

---

## §16. Pasarela de pago

**Contexto.** El prompt sugiere Stripe. La integración exige webhook firmado, conciliación con `payments`, y manejo de PSD2 SCA. → depende de §13.

**Opciones.**
- (a) **Stripe Checkout** (hosted), webhook a Supabase Edge Function. Fee típico: 1.4 % + 0.25 € en SEPA.
- (b) Redsys (bancos españoles, Santander/BBVA/Caixabank). Fee variable según contrato bancario; integración más farragosa.
- (c) Stripe + Bizum (Bizum vía Stripe está en beta en ES; Bizum directo requiere acuerdo bancario).
- (d) Solo Bizum / transferencia (cero comisión pero conciliación manual).

**Recomendación.** (a). Onboarding inmediato, panel y reembolsos limpios, manejo automático de SCA, soporte multimoneda si en el futuro fuera necesario. (d) es tentador por coste cero pero rompe la trazabilidad automática y bloquea el flujo público de inscripción.

**RESPUESTA:** 

---

## §17. Modo de Stripe en producción

**Contexto.** El prompt §10 prohíbe paso a `live` sin aprobación explícita. Se documenta aquí para confirmar autorización antes de producción.

**Opciones.**
- (a) **Iniciar siempre en `test`**. Paso a `live` solo tras revisión completa de webhook, conciliación y URL de éxito/cancelación.
- (b) Saltar directamente a `live` (no recomendado).

**Recomendación.** (a). No negociable como práctica de ingeniería.

**RESPUESTA:** 

---

## §18. Identidad de marca

**Contexto.** El visor 2025 usaba paleta verde-primario + azul-secundario, con estética sport casual (lucide-react para iconos).

**Opciones.**
- (a) **Iterar la paleta actual** y refinarla con shadcn/ui design tokens.
- (b) Rediseño completo (logo nuevo, colores nuevos).
- (c) Encargar el rediseño a diseñador externo (presupuesto separado).

**Recomendación.** (a). Hay un equity visual mínimo de la edición 2025; iterar reduce coste y preserva reconocimiento. shadcn/ui permite tokens consistentes sin renunciar a la personalidad.

**RESPUESTA:** 

---

## §19. Notificaciones a inscritos

**Contexto.** Como mínimo: confirmación de inscripción, recordatorio de partido, resultado confirmado, eliminación, finalista.

**Opciones.**
- (a) **Solo email transaccional** (Resend + React Email).
- (b) Email + WhatsApp (Twilio API o 360dialog).
- (c) Email + push web (PWA).

**Recomendación.** (a) para v1. WhatsApp tiene mejor tasa de apertura pero añade: contrato con operador, coste recurrente, gestión de opt-in formal y configuración de webhooks de entrega. Diferible a una v2 si la tasa de apertura del email resulta insuficiente.

**RESPUESTA:** 

---

## §20. Premios y sponsors

**Contexto.** Afecta al presupuesto de la edición y a si existe `sponsors` como entidad de datos.

**Opciones para premios.**
- (a) Trofeo + premio simbólico (material de pádel) para ganadores y finalistas de cada categoría.
- (b) Premio monetario.
- (c) Solo trofeo.
- (d) Mix: trofeo + material + descuento siguiente edición.

**Sponsors.**
- ¿Hay patrocinadores? Si sí: nº, nombres, logos, contraprestaciones (banner en web, mención en redes, branding en pistas).
- ¿Necesitas un módulo simple para mostrar sponsors en la landing?

**Recomendación premios.** (d). Combina trofeo (reconocimiento), material (motivación tangible) y descuento (fidelización a la siguiente edición), sin necesidad de premio monetario que activa fiscalidad/IRPF.

**RESPUESTA premios:** 

**RESPUESTA sponsors:** 

---

## §21. RGPD / LOPDGDD

**Contexto.** En cuanto haya un formulario público de inscripción, manejaremos datos personales (nombre, apellidos, email, teléfono, eventual nivel de juego, posibles fotos). El sistema debe cumplir el RGPD + LOPDGDD desde el primer día.

**Decisiones requeridas:**

| # | Decisión | Recomendación | Tu respuesta |
|---|---|---|---|
| 21.1 | **Responsable del tratamiento**: persona física, club, asociación o empresa | Asociación / club organizador. Necesita NIF/CIF y dirección | __________ |
| 21.2 | **Datos de contacto del responsable** (a publicar en Política de Privacidad) | Email genérico tipo `privacidad@<dominio>` | __________ |
| 21.3 | **¿Designar un DPO?** No obligatorio para un torneo local | (a) No designar; (b) Designar voluntariamente | (a) |
| 21.4 | **Bases legales** del tratamiento | Inscripción/pago: ejecución de contrato. Publicación de resultados: interés legítimo. Foto/vídeo: consentimiento explícito | (Recomendación) |
| 21.5 | **Tiempo de retención** post-edición | (a) Hasta el final de la edición; (b) **3 años** (típico amateur); (c) Indefinido con anonimización | (b) |
| 21.6 | **Derechos de imagen**: ¿se hacen fotos/vídeos del evento y se publican? | Sí, con consentimiento en el formulario de inscripción (checkbox separado, opt-in granular) | __________ |
| 21.7 | **Encargados de tratamiento** (sub-procesadores) a listar | Supabase (Frankfurt EU), Stripe (Dublín EU), Resend (Frankfurt EU), Vercel (Frankfurt EU), Sentry (Frankfurt EU) | (Recomendación) |
| 21.8 | **Texto legal**: ¿lo redactamos nosotros desde plantilla AEPD o lo encarga un abogado externo? | (a) Plantilla AEPD adaptada, revisada por el responsable; (b) Encargo externo | (a) salvo que prefieras lo contrario |

**RESPUESTA bloque RGPD:** 

---

## §22. Continuidad histórica con la edición 2025

**Contexto.** Las 28 parejas 2025 viven solo en el historial git tras el rebuild. Importarlas exige consentimiento RGPD y desambiguación manual.

**Opciones.**
- (a) **Empezar desde cero**. La edición 2025 queda como dataset histórico congelado fuera del nuevo modelo de datos.
- (b) Re-importar la lista de parejas 2025 con consentimiento explícito, en una tabla `historical_pairs_2025` solo de lectura.
- (c) Re-importar y unificar en `players` (requiere desambiguación manual de los nombres repetidos).

**Recomendación.** (a). Más simple legal y operativamente. Si en el futuro se quiere construir un ranking inter-edición, se puede hacer en una v3 con datos limpios y consentidos.

**RESPUESTA:** 

---

## §23. Ranking inter-edición (ELO o similar)

**Contexto.** Si se mantiene continuidad (§22), tiene sentido sembrar el seeding inicial del próximo torneo con datos del anterior. → depende de §22.

**Opciones.**
- (a) **No** mantener ranking entre ediciones. Cada año el comité asigna categoría/seed manualmente.
- (b) Ranking ELO interno basado en resultados de partidos pasados.
- (c) Federación oficial (FCP / FEP): tomar nivel de federación cuando exista.

**Recomendación.** (a). El torneo es local y anual; la información que aporta un ranking interno entre 100 jugadores con una sola edición de muestra no compensa la complejidad del cálculo y los disputes derivados.

**RESPUESTA:** 

---

## §24. Política de auditoría (audit_log)

**Contexto.** Hallazgo del audit: hoy cualquiera con push puede reescribir resultados sin trazabilidad. En la nueva DB hay que registrar autoría + timestamp + diff.

**Opciones.**
- (a) **Trigger genérico** que escribe en `audit_log` toda modificación de `match_results`, `sets`, `matches.status`, `pairs`, `group_members`.
- (b) Solo registrar mutaciones desde el panel admin; las del flujo público (resultados de capitanes) no se auditan.
- (c) Sin `audit_log` (no recomendado).

**Recomendación.** (a). Coste de implementación bajo (un trigger PL/pgSQL genérico con `OLD`/`NEW` a `jsonb`); coste de operación marginal (escrituras adicionales solo en mutación). Cobertura completa para defender la integridad histórica en caso de disputa.

**RESPUESTA:** 

---

## §25. Roles y permisos (RBAC)

**Contexto.** El sistema necesita al menos: público (lectura), capitanes (reportar resultados de sus partidos), admin (todo). Las RLS policies de Supabase se construyen sobre esto.

**Opciones.**
- (a) **3 roles**: `anon` (público, lectura de partidos publicados), `captain` (autenticado, reporta resultados de los partidos de su pareja), `admin` (autenticado, todo).
- (b) 2 roles: `anon`, `admin`. Capitanes no autentican; resultados reportados por admin a partir de notificaciones externas.
- (c) 4 roles: `anon`, `captain`, `referee` (árbitro neutral si lo hay), `admin`.

**Recomendación.** (a). Capitanes autenticados como dueños del resultado garantiza validación cruzada (dos capitanes reportan, sistema detecta discrepancia automáticamente). 4 roles es overkill mientras no haya árbitros formales.

**RESPUESTA:** 

---

## §26. Estrategia de rama y de releases

**Contexto.** El prompt §6 propone ramas `feat/sprint-N-*` con PRs draft a `main`. Tras el merge de la Fase 0, hay que confirmar la convención.

**Opciones.**
- (a) **Una rama por sprint** (`feat/sprint-1-foundation`, `feat/sprint-2-signup-payment`, …) con PR draft hacia `main`. Tags `v0.1.0`, `v0.2.0` al cerrar cada sprint.
- (b) Una rama por feature (más granular).
- (c) Trunk-based: commits directos a `main` con feature flags.

**Recomendación.** (a). Granularidad correcta para 6 sprints; cada PR es una historia auditable y un punto natural de revisión + preview deploy. Tags facilitan rollback si una migración compromete prod.

**RESPUESTA:** 

---

## §27. Dominio y URLs

**Contexto.** Sin dominio no hay landing pública ni redirección de Stripe Checkout (`success_url`, `cancel_url`).

**Campos requeridos.**
- ¿Dominio existente? Si sí, ¿cuál?: __________
- ¿Comprar dominio nuevo? Sugerencias: `torneigpadellescoves.cat`, `padelescoves.cat`, `torneucoves.cat`. Coste anual aprox. 12-15 € / año en `.cat` o `.com`.
- Subdominios previstos:
  - `www.<dominio>` o vacío para landing pública.
  - `admin.<dominio>` para panel administrativo (o `/<dominio>/admin`).
- DNS gestionado en: __________ (Vercel DNS recomendado por simplicidad).

**Recomendación.** Comprar `torneigpadellescoves.cat` (o equivalente disponible) y delegar DNS a Vercel.

**RESPUESTA:** 

---

## §28. Observabilidad y alertas

**Contexto.** El prompt cita Sentry + Vercel Analytics como base.

**Decisiones.**
- (a) Plan de **Sentry** (free hasta 5k events/mes; suficiente para v1).
- (b) **Alertas**: Slack, email, ambos? Necesito un canal/email de guardia.

**Recomendación.** Sentry free + alertas por email a la dirección de privacidad/operación (`alertas@<dominio>` o reusar el mismo email del responsable).

**RESPUESTA:** 

---

## §29. Backups y plan de recuperación

**Contexto.** Antes de pasar a `live` con datos reales (inscripciones pagadas), hay que tener backup automatizado.

**Opciones.**
- (a) **Backup nativo de Supabase** (Point-in-Time Recovery en plan Pro; daily backup en Free).
- (b) Backup adicional manual (volcado SQL semanal a Storage).
- (c) Replica externa (innecesario para v1).

**Recomendación.** (a) en Free durante test; activar Pro antes del paso a `live` por el PITR. La RTO recomendada en `RUNBOOK.md` será ≤4 h.

**RESPUESTA:** 

---

## §30. Decisiones ya cerradas en conversación previa (referencia)

| # | Decisión | Resultado |
|---|---|---|
| C1 | Rama de trabajo de Fase 0 | `claude/tournament-discovery-odMYj`, mergeada a `main` |
| C2 | Stack frontend | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| C3 | Backend / DB | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions + RLS) |
| C4 | Pasarela de pago propuesta | Stripe Checkout (a confirmar en §16) |
| C5 | Email transaccional | Resend |
| C6 | Despliegue | **Vercel**. Netlify queda activo en `main` actual pero se descomisiona en Sprint 1 |
| C7 | Migración del repo | In-place: borrar visor 2025, reconstruir sobre `main` |
| C8 | Reglamento | Versionado en `docs/REGLAMENTO_<AÑO>.md`, no embebido en código |
| C9 | Stop point | Tras Fase 0 (✅), tras Fase 1 (pendiente al cerrar este documento), tras Fase 2, tras Fase 3 |

---

## Próximos pasos tras cerrar este documento

1. Rellenar todas las `RESPUESTA:` por encima.
2. Apertura de PR con las respuestas → revisión final conjunta.
3. **Stop point #2** cerrado.
4. Arranca **Fase 2**: `docs/PROPUESTA_EDICION_<AÑO>.md` (3-5 páginas ejecutivas) + `docs/REGLAMENTO_<AÑO>.md` v1.0.0.
