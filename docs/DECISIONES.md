# Decisiones — Fase 1

> Estado: **cerrado en su mayor parte**. Quedan 15 campos de texto libre por
> completar (datos legales del club, fechas concretas del torneo, persona de
> contacto, cuota, sponsors, subdominio Vercel) — listados al final del
> documento bajo "Campos pendientes del organizador". Mientras no se rellenen,
> aparecen como `__________` en las secciones correspondientes.
>
> Convenciones:
>
> - **RESPUESTA**: decisión cerrada en la conversación.
> - **PENDIENTE**: requiere dato concreto del organizador (ver bloque final).
> - **DESCARTADO**: la decisión queda explícitamente fuera por implicación de otra.
>
> Mapa de cierres:
> §1, §2, §4, §7, §9, §10, §11, §15, §16, §18, §19, §20-premios, §21.3, §21.4,
> §21.5, §21.6, §21.7, §21.8, §22, §23, §24, §25, §26, §28, §29 — **cerradas**.
> §3 — **CERRADA (2026-05-29): Grupos + Eliminatorias (opción A).** Ver §3.
> §5, §6 — **desbloqueadas** tras cerrar §3 (valores por defecto fijados).
> §8 — **reformulada** respecto al borrador original (ya no se juega super tie-break).
> §17 — **descartada** (no se usa Stripe, ver §16).
> §12, §13, §14 (fecha X), §20-sponsors, §21.1-21.2 (datos club), §27 — **pendientes**
> de datos del organizador.
> §30-§32 — **nuevas secciones** añadidas en la Fase 1.

---

## §1. Año y nomenclatura de la edición

**Recomendación.** (a) V Torneig de Pàdel les Coves de Vinromà **2026**.

**RESPUESTA:** (a) **V Torneig de Pàdel les Coves de Vinromà — 2026**.

> Nota toponímica: la forma oficial valenciana del municipio es "les Coves de
> Vinromà" (con artículo en minúscula y acento grave). El nombre del repo
> heredado (`Torneig_Local_Padel_2025_vinroma`) se conserva por compatibilidad
> git, pero todos los textos públicos, plantillas de email y marca usan
> **"les Coves de Vinromà"**. Ver §30.

---

## §2. Idioma(s) de la web

**Recomendación.** (a) Bilingüe ca / es, catalán por defecto.

**RESPUESTA:** (a) **Bilingüe ca / es**, catalán por defecto, conmutador en navbar.
El reglamento (`REGLAMENTO_2026.md`) se firma legalmente en castellano; la
versión catalana es traducción no vinculante de cortesía.

---

## §3. Formato de competición

**Estado.** **CERRADA (2026-05-29).**

**RESPUESTA:** **Opción A — Fase de grupos + Eliminatorias (cuadro KO).**
Es el formato que la base de código ya implementa de extremo a extremo (sorteo
de grupos `run_draw`, vista `category_standings`, motor de cuadro KO, walkover,
auto-scheduling). Se descartan B (Liga), C (Liga + Playoff) y D (Americana).

Reglas asociadas que quedan fijadas como valor por defecto (editables por el
comité en `admin/settings` y en `PROPUESTA_FORMATOS.md` si cambian):

- **Avanzan 2 parejas por grupo** a la fase eliminatoria (§5).
- **Desempate de grupo:** partidos ganados → diferencia de sets → diferencia de
  juegos → enfrentamiento directo (head-to-head) → juegos a favor (§7, ya
  implementado en la vista y en `grups/[level]`).
- **Cuadro KO** sembrado por posición de grupo; tamaño redondeado a la siguiente
  potencia de 2 con byes para los mejores cabezas de serie.

> Cierre del proceso de votación: el comité organizador adopta la opción A por
> ser la alineada con el producto ya construido y con el calendario de 3 pistas.
> Esto desbloquea §5 y §6.

---

## §4. Número y criterios de categorías

**RESPUESTA:** (a) **4 categorías por nivel** (1ª, 2ª, 3ª, 4ª), mixtas en
género, sin separación por edad. El comité asigna nivel en base al nivel
declarado por la pareja + histórico conocido por la organización.

---

## §5. Tamaño de los grupos y nº de clasificados

**RESPUESTA:** **CERRADA tras §3 (opción A).** Grupos de 3-4 parejas según
inscripción; **clasifican las 2 primeras de cada grupo** a la fase eliminatoria.
El nº exacto de grupos por categoría lo fija el sorteo (`run_draw`) en función
de las parejas confirmadas.

---

## §6. Capacidad por categoría y total

**RESPUESTA:** **CERRADA tras §3 (opción A).** Techo por defecto: 28-32 parejas
totales repartidas en 4 categorías (~7-8 parejas/categoría), configurable por
categoría en `admin/settings` (`categories.max_pairs`). El cálculo de partidos
vs. capacidad de pista (3 pistas, ~14 partidos/día entre semana, ~27/día en
finde) sigue siendo la restricción operativa.

---

## §7. Criterios de desempate en la fase de grupos

**RESPUESTA:** (a) **Partidos ganados → ΔSets → ΔJuegos → H2H** (idéntico a 2025).

Notas operativas:

- En triple empate, el orden se aplica de forma **global** (no recalcula
  sub-tabla H2H entre los empatados).
- H2H se aplica como criterio final precisamente porque no es transitivo y
  generaría inconsistencias si se aplicase antes.

---

## §8. Set decisivo cuando hay empate a 1 (REFORMULADO)

> Esta sección reemplaza la original sobre "cómputo del super tie-break en
> ΔJuegos", que ya no aplica porque **no se juega super tie-break** en esta
> edición.

**RESPUESTA:** **Tercer set completo al 6**, con tie-break a 7 si llega a 6-6.
No hay super tie-break en ningún partido del torneo.

Implicaciones operativas:

- Duración media estimada por partido: **~90-105 min** (vs. ~70-80 min con STB).
- El planificador de partidos asume 95 min/partido + 10 min de descanso entre
  partidos en la misma pista.
- Con 3 pistas y franja lu-vi 16:00-23:30 (7.5 h) → ~14 partidos/día entre semana.
- Con 3 pistas y franja sá-do 09:00-23:30 (14.5 h) → ~27 partidos/día en finde.

---

## §9. Política de walkover (no presentación)

**RESPUESTA:** (a) **6-0 6-0 a favor del rival**. El partido se modela con
`matches.status = 'walkover'` y `match_results` poblando 6-0 6-0; preserva la
consistencia de ΔSets y ΔJuegos sin excepciones especiales. Tiempo de espera:
**15 minutos** desde la hora oficial del partido.

---

## §10. Política de retirada o lesión durante el torneo

**RESPUESTA:** (a) **Mantener los partidos ya jugados; los partidos pendientes
son walkover 6-0 6-0 a favor del rival**. La pareja retirada conserva los
puntos que hubiera ganado antes de la baja; los rivales pendientes se benefician
del walkover sin discriminación.

---

## §11. Política de descalificación

**RESPUESTA:** **Tratar la descalificación como una retirada** (≡ §10): los
partidos ya jugados se mantienen, los pendientes son walkover 6-0 6-0 a favor
del rival. **NO se anulan retroactivamente los resultados ya jugados.**

> Importante. El reglamento debe enumerar **taxativamente** las causas de
> descalificación (conducta antideportiva grave, agresión, dopaje, fraude de
> inscripción) y dejar claro que la sanción **no toca los resultados ya
> consignados**. Esto difiere de la recomendación del borrador original (que
> proponía anular), por decisión del organizador.

---

## §12. Calendario, sede y pistas

**Cerrado (estructural):**

- **Sede principal**: club de pádel de les Coves de Vinromà.
- **Pistas**: 3 pistas del club, gestionadas vía la app **Sporttia** (reservas).
- **Distribución de días**: entre semana + fines de semana.
- **Franja horaria**: lu-vi de **16:00 a 23:30**, sá-do de **09:00 a 23:30**
  (continuo, requiere luz artificial en tramos nocturnos).

**Integración técnica con Sporttia:** el club bloquea los slots necesarios en
Sporttia (operación manual fuera de la app del torneo); nuestra app
**programa los partidos sobre esos slots ya reservados** y no llama a la API
de Sporttia. Ventajas: cero dependencia API externa, cero riesgo de doble
reserva. Inconveniente: si Sporttia cambia un slot, el admin del torneo tiene
que reflejarlo manualmente en el panel.

**Calendario cerrado:**

| Hito                                | Fecha                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Apertura de inscripciones           | **1 jun 2026**                                                              |
| Cierre estándar de inscripciones    | **30 jun 2026**                                                             |
| Cierre con recargo / fuera de plazo | **discrecional del organizador**, sólo si quedan plazas en alguna categoría |
| Sorteo de cuadros                   | **1 jul 2026**                                                              |
| Primer partido                      | **6 jul 2026** (lunes)                                                      |
| Final                               | **9 ago 2026** (sábado)                                                     |
| Ventana de juego                    | 6 jul - 9 ago 2026 (5 semanas)                                              |

> Capacidad estimada: con holgura amplia frente a los ~100 partidos previstos
> (14 partidos/día entre semana + 27 partidos/día finde × 5 semanas = ~620
> slots disponibles, ocupación esperada ~16 %).

**Contacto operativo cerrado:**

- **Nombre**: Jonatan García
- **Teléfono**: 620 033 053
- **Publicación en web**: a confirmar si se publica directamente o sólo como
  enlace `tel:` clicable detrás de un botón "Contactar organización".

---

## §13. Cuota de inscripción — modelo de pago dual

**RESPUESTA (modelo de pago):** El sistema acepta **dos modos de pago** de
forma simultánea; cada pareja elige al inscribirse cuál usa. Cada modo
admite, indistintamente, **Bizum o transferencia bancaria** al IBAN del club
(equivalencia total — el sistema no distingue uno de otro, sólo se fija en
el concepto y el importe entrante).

| Modo                              | Descripción                                                                                                                                                                                                                             | Recomendación UI                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **A. Por pareja** _(recomendado)_ | Un miembro de la pareja paga la suma total de las dos cuotas con **un solo Bizum o transferencia** al teléfono/IBAN del club. Concepto: `2026-P<pair_id>-<APELLIDO_PAGADOR>`. La pareja queda `confirmed` con un único pago conciliado. | UI marca esta opción por defecto, con tooltip "más simple y rápido".                          |
| **B. Por persona**                | Cada miembro paga **su propia cuota** con un Bizum o transferencia independiente. Concepto: `2026-J<player_id>-<APELLIDO>`. La pareja queda `confirmed` cuando ambos pagos individuales están conciliados.                              | UI muestra esta opción como alternativa, con tooltip "si preferís cada uno pagar lo vuestro". |

> **Bizum y transferencia tienen rango idéntico** en el flujo: la pantalla
> de pago de cada modo muestra simultáneamente (a) el teléfono Bizum del
> club y (b) el IBAN del club, ambos con un botón "copiar al portapapeles"
> y el concepto único pre-formateado.

**Implicaciones técnicas.**

- Modelo de datos: tabla `payments` con FK opcional a `player_id` y `pair_id`.
  - Pago modo A: `pair_id = X, player_id = NULL, payer_player_id = Y` (el que pagó).
  - Pago modo B: `pair_id = X, player_id = Y` (un registro por jugador).
- Trigger PL/pgSQL que marca `pairs.status = 'confirmed'` cuando hay (modo A:
  1 payment con monto = suma de tramos correspondientes) o (modo B: 2 payments
  individuales coincidentes con los 2 players de la pareja).
- Reembolsos (§15): si modo A se cancela, el reembolso es un único Bizum al
  pagador; si modo B se cancela parcialmente (1 sólo miembro baja), se
  reembolsa sólo a ese miembro y el otro sigue inscrito (pero la pareja queda
  bloqueada hasta que aporte sustituto).

**RESPUESTA (estructura de tarifas):** **EN VOTACIÓN DE CAPITANES**. El
borrador del organizador propone una estructura escalonada en 3 tramos +
recargo (ver §14), pero el organizador decidió someterla a votación junto al
formato deportivo de §3 (segunda papeleta del documento
`docs/PROPUESTA_FORMATOS.md`, Parte 2). Mientras se vota, el desarrollo asume
la estructura escalonada como **valor por defecto** parametrizable; cambiar
de tarifa al cerrar la votación es una operación de configuración (no toca
código).

> Implicación RGPD-Hacienda. Si la suma anual de ingresos supera los umbrales
> del IRPF aplicable a una asociación sin ánimo de lucro, hay que dar de alta
> el ingreso. ~32 parejas × 2 personas × ~22.5 €/persona media ≈ **1.440 €**
> previstos por edición → muy por debajo de cualquier umbral, sin
> implicaciones fiscales para asociación deportiva amateur.

---

## §14. Estructura de tarifas — EN VOTACIÓN DE CAPITANES

> _El organizador decidió someter la estructura de tarifas a votación junto al
> formato deportivo de §3. Las 3 opciones que se votan están detalladas en
> `docs/PROPUESTA_FORMATOS.md` (Parte 2): (A) tarifa única por pareja,
> (B) early bird simple, (C) escalonado 3 tramos + recargo._

**RESPUESTA:** **En votación.** Se aplica el método Borda con la misma
papeleta que §3 (1 papeleta por capitán, 2 secciones independientes).

**Valor por defecto durante el desarrollo (provisional):** estructura
escalonada (C) con las cifras inicialmente propuestas por el organizador.
El sistema parametriza la tarifa en una **tabla de configuración**
(`tournament_fees`) que el admin puede editar tras conocer el ganador del
voto, sin necesidad de redeploy:

| Tramo                      | Ventana de pago                                        | Tarifa por persona | Pareja completa (×2) |
| -------------------------- | ------------------------------------------------------ | ------------------ | -------------------- |
| Tramo 1 (super early)      | **1-10 jun 2026**                                      | **15 €**           | 30 €                 |
| Tramo 2 (early)            | **11-20 jun 2026**                                     | **20 €**           | 40 €                 |
| Tramo 3 (estándar)         | **21-30 jun 2026**                                     | **25 €**           | 50 €                 |
| **Recargo fuera de plazo** | **1 jul 2026 → mientras queden plazas (discrecional)** | **30 €**           | 60 €                 |

Reglas operativas:

- El tramo se cierra a las **23:59 del último día**, hora local Europe/Madrid.
- Si una pareja se inscribe en T1 pero un miembro paga el día 12 (T2), ese
  miembro paga 20 € (no 15 €). La pareja queda `confirmada` cuando los 2 han pagado.
- El recargo "fuera de plazo" es **decisión discrecional del comité**: sólo se
  abre si después del cierre estándar quedan plazas vacantes en alguna categoría.
  Si no hay plazas, no se admite inscripción aunque la pareja esté dispuesta
  a pagar 60 €.
- El sistema **NO** ofrece reembolso retroactivo si bajan las tarifas
  posteriores (no aplica aquí porque van subiendo, pero se documenta).

---

## §15. Política de reembolso

**RESPUESTA:** (b) **Reembolso del 100 % hasta el cierre de inscripciones;
0 % después** (excepto cancelación del torneo por parte del organizador).

Con §16=Bizum/transferencia, el admin gestiona el reembolso manualmente desde
el panel: marca la inscripción como `cancelada_con_reembolso`, ejecuta el Bizum
de vuelta desde su cuenta, sube comprobante al panel.

---

## §16. Pasarela de pago

**RESPUESTA:** (d) **Bizum y/o transferencia bancaria** (ambos equivalentes,
sin preferencia), cero comisión, con **conciliación manual**. Flujo
(actualizado para coherencia con §13 = modelo de pago dual):

1. La pareja completa el formulario público y elige modo de pago (§13):
   - Modo A _(recomendado)_: 1 transacción por pareja.
   - Modo B: 2 transacciones independientes (1 por jugador).
2. El sistema crea los registros `pending_payment` correspondientes y muestra
   a cada pagador una **pantalla de pago dual** con:
   - **Bizum**: teléfono del club + botón "Copiar". Concepto pre-formateado.
   - **Transferencia bancaria**: IBAN del club + botón "Copiar". Mismo concepto.
3. El admin del torneo concilia con el extracto bancario (revisa los pagos
   entrantes — tanto Bizum como transferencia llegan al mismo extracto del
   club — y los empareja por concepto e importe).
4. El admin marca cada `payment` como `paid` desde el panel. El trigger
   PL/pgSQL marca la pareja como `confirmed` cuando se cumple la condición
   del modo elegido (1 pago consolidado en modo A, 2 pagos individuales en
   modo B) y dispara el email + WhatsApp de confirmación a ambos jugadores.

**Datos bancarios del club a publicar** (pendientes — ver bloque final):

- Teléfono Bizum del club.
- IBAN completo del club.

**Trade-off asumido:** ~5 min de admin por pago × estimación de pagos
(entre 32 modo A y 64 modo B según mix de modos elegidos por las parejas)
= **3-6 h totales de gestión por edición**. Stripe se descarta por preferencia
del organizador.

---

## §17. Modo de Stripe en producción

**DESCARTADO.** No se usa Stripe en esta edición (ver §16=Bizum/transferencia).
Si en una edición futura se reactiva Stripe, esta sección recupera vigencia con
la recomendación original (iniciar siempre en test).

---

## §18. Identidad de marca

**RESPUESTA:** (b) **Rediseño completo**.

Plan operativo:

1. **Paleta y design tokens**: yo propongo 2-3 paletas alternativas con tokens
   Tailwind / shadcn (claro+oscuro), con justificación cromática (asociaciones
   con pádel, terra valenciana, club). Decisión final del organizador.
2. **Logo**: generado por IA (Midjourney / DALL·E / Imagen 3) + retoque manual
   en SVG. Coste: tiempo del organizador. Alternativa: encargo a diseñador
   externo (presupuesto separado, +2-4 semanas).
3. **Tipografía**: par de fuentes (display + body) descargadas de Google Fonts,
   licencia OFL.
4. **Plantilla de cartel** y elementos sociales: una vez cerrada la marca.

Sprint 1 arranca con **paleta placeholder shadcn neutral** para no bloquear el
desarrollo. La marca definitiva se aplica como token swap antes de Sprint 4.

---

## §19. Notificaciones a inscritos

**RESPUESTA:** (b) **Email transaccional (Resend + React Email) + WhatsApp
(Meta WhatsApp Cloud API)**.

Eventos cubiertos:

- Confirmación de inscripción (tras conciliación de pago).
- Asignación de categoría y grupo (tras sorteo).
- Aviso de partido programado (D - 24h y D - 1h).
- Solicitud de validación de resultado (cuando el rival ha reportado).
- Validación cruzada confirmada / disputada.
- Eliminación / pase a siguiente ronda.
- Finalistas / campeones.

Bloqueantes no-técnicos (responsabilidad del organizador, fuera del backlog
de código):

- **Cuenta Meta Business verificada** vinculada al club — proceso de 1-3
  semanas con Meta.
- **Plantillas de mensaje aprobadas** por Meta (categoría "utility") — 24-48 h
  por plantilla.
- **Opt-in explícito** del inscrito (checkbox en formulario) y mecanismo de
  opt-out ("STOP" reply).

Coste estimado mensajes WhatsApp: ~50-100 conversaciones × ~0.05 € = **<10 €/edición**.

---

## §20. Premios y sponsors

**RESPUESTA premios:** **Trofeo + material de pádel** (pala, paletero, packs
de pelotas u otro) para campeón y finalista de cada categoría. **Sin descuento**
para la siguiente edición (decisión por simplicidad operativa). Sin premio
monetario.

**RESPUESTA sponsors:** **SÍ, ya cerrados**. Módulo de sponsors necesario en
la landing pública (logos + enlace + mención). Detalle de patrocinadores
**pendiente** del organizador (ver bloque final, ítem 14).

---

## §21. RGPD / LOPDGDD

| #    | Decisión                          | Respuesta                                                                                                                                                                                                                                                                                                       |
| ---- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21.1 | Responsable del tratamiento       | **Club Padel les Coves**, entidad registrada con CIF. CIF y dirección postal **pendientes** (organizador los aporta antes del live — ver bloque final).                                                                                                                                                         |
| 21.2 | Email de contacto del responsable | **`clubpadelvinroma@gmail.com`** (Gmail institucional del club). Sirve como `from address` de Resend, contacto Sentry, canal formal RGPD ARSULIPO y notificaciones internas. Canal operativo principal del día a día sigue siendo el grupo de WhatsApp del torneo.                                              |
| 21.3 | Designar DPO                      | **No designar.** No obligatorio para torneo local.                                                                                                                                                                                                                                                              |
| 21.4 | Bases legales                     | **Estándar AEPD.** Inscripción + pago: art. 6.1.b (contrato). Publicación de resultados / clasificaciones: art. 6.1.f (interés legítimo). Datos de menores: art. 6.1.a (consentimiento del titular de la patria potestad).                                                                                      |
| 21.5 | Tiempo de retención               | **Indefinido con anonimización** ejecutada **30 días después de la final** del torneo. Job automático (cron Supabase Edge Function) sobrescribe nombre, email, teléfono, foto de perfil con NULL; conserva ID interno + resultados deportivos.                                                                  |
| 21.6 | Derechos de imagen                | **Sin publicación de fotos**. No habrá galería ni fotos identificables de participantes en web ni redes del club. Si se hacen fotos privadas, uso interno del club, no se publican. La landing usa ilustraciones / stock genérico.                                                                              |
| 21.7 | Sub-procesadores declarados       | **Supabase** (Postgres + Auth + Storage + Edge Functions, región Frankfurt EU), **Vercel** (hosting, Frankfurt/Irlanda EU), **Resend** (email transaccional, Frankfurt EU), **Meta Platforms Ireland Ltd** (WhatsApp Cloud API, Irlanda EU), **Sentry** (observabilidad, Frankfurt EU). Sin Stripe (§16=Bizum). |
| 21.8 | Texto legal                       | **Plantilla AEPD adaptada** al caso del torneo amateur deportivo, revisada por el responsable del club. Cero coste de redacción.                                                                                                                                                                                |

---

## §22. Continuidad histórica con la edición 2025

**RESPUESTA:** (a) **Empezar desde cero**. La edición 2025 queda como
dataset histórico congelado en el historial git, fuera del modelo de datos
nuevo. Sin importación de parejas, sin migración de resultados, sin ranking
heredado.

---

## §23. Ranking inter-edición (ELO o similar)

**RESPUESTA:** (a) **No** mantener ranking entre ediciones. Cada año el comité
asigna nivel/seed manualmente en base al nivel declarado y el conocimiento
operativo. Coherente con §22 (sin continuidad histórica).

---

## §24. Política de auditoría (audit_log)

**RESPUESTA:** (a) **Trigger genérico PL/pgSQL** que registra automáticamente
toda mutación (INSERT/UPDATE/DELETE) en tablas críticas (`match_results`,
`sets`, `matches.status`, `pairs`, `group_members`, `payments`) con autor +
timestamp + diff (`OLD` y `NEW` como jsonb).

Defiende la integridad histórica en caso de disputa. Coste de implementación
bajo, coste de operación marginal.

---

## §25. Roles y permisos (RBAC) + flujo de validación cruzada

**RESPUESTA:** (a) **3 roles**:

- `anon`: público con acceso de lectura a partidos y clasificaciones publicados.
- `captain`: 1 usuario autenticado por pareja, asociado a la pareja. Puede
  reportar resultado de los partidos donde participa SU pareja.
- `admin`: organización; acceso total al panel admin.

**Flujo de validación cruzada de resultados.** Cuando se juega un partido
entre la pareja A y la pareja B:

1. El partido se crea con estado `scheduled`.
2. El capitán de A o B introduce el resultado en su panel → tabla
   `match_reports` recibe un registro: `(match_id, reporter_user_id,
score_jsonb, reported_at)`. El partido pasa a estado `pending_validation`.
3. El sistema dispara automáticamente un **email + WhatsApp** al capitán de la
   pareja contraria, con enlace de validación.
4. El capitán contrario entra al panel y ve el resultado reportado:
   - Si coincide con su versión → confirma → segundo `match_reports` →
     ambos reports coinciden → partido pasa a `validated` y entra en
     standings.
   - Si discrepa → introduce su versión → segundo `match_reports` con score
     distinto → partido pasa a `disputed` y se notifica al admin.
5. El admin resuelve el partido `disputed` desde el panel, con autoridad
   final (un solo report del admin valida el partido).

Estados de `matches.status`: `scheduled` → `pending_validation` →
`validated` | `disputed`. Estado terminal `walkover` se establece sin pasar
por validación cruzada.

Diseño técnico complementario:

- RLS policy: un `captain` sólo puede insertar en `match_reports` para partidos
  donde su pareja es A o B.
- Trigger PL/pgSQL: al insertar el segundo report, compara scores y actualiza
  `matches.status` automáticamente.
- Notificaciones disparadas por trigger → edge function `notify-captain` que
  llama a Resend y a Meta WhatsApp Cloud API.

---

## §26. Estrategia de rama y de releases

**RESPUESTA:** (a) **Una rama por sprint** (`feat/sprint-1-foundation`,
`feat/sprint-2-signup-payment`, …) con PR draft hacia `main`. Tags
`v0.1.0`, `v0.2.0`, … al cerrar cada sprint.

6 sprints planeados (alineados con la propuesta del bootstrap original):

- Sprint 1: foundation (Next.js + Supabase + auth + schema base).
- Sprint 2: inscripción pública + pago Bizum + conciliación admin.
- Sprint 3: sorteo + cuadros + panel admin v1.
- Sprint 4: reporte de resultados con validación cruzada + notificaciones.
- Sprint 5: clasificaciones en vivo + diseño aplicado + sponsors.
- Sprint 6: hardening + RGPD + backups + pre-live checklist.

---

## §27. Dominio y URLs

**RESPUESTA:** **Sin dominio propio**. Se usa subdominio gratuito de Vercel.

Subdominio asignado: **`torneigpadelvinroma-v-2026.vercel.app`**.

> Nota técnica. Vercel normaliza los subdominios a minúsculas; aunque el
> organizador escribió "V" en mayúscula (referencia a "V edición"), la URL
> renderiza como `...-v-2026.vercel.app`. En textos visuales (cartel, plantillas
> de email, OpenGraph) podemos escribir "V edició — 2026" con tipografía
> destacada para preservar la lectura numérica romana.

Implicaciones:

- Email `privacidad@<dominio>` no aplica (no hay dominio propio); usamos
  `clubpadelvinroma@gmail.com` como contacto RGPD directo (ver §21.2).
- Stripe success/cancel URLs no aplica (§16=Bizum).
- Branding en cartelería: la URL es larga; **QR obligatorio** en cartel,
  flyers y pantallas durante el torneo.

---

## §28. Observabilidad y alertas

**RESPUESTA:** **Sentry plan Free** (hasta 5k events/mes) + alertas por email
a la dirección de contacto del club (mientras no haya dominio propio). Source
maps habilitados. Performance monitoring desactivado (ahorra cuota).

---

## §29. Backups y plan de recuperación

**RESPUESTA:** **Supabase Free tier** durante todo el ciclo de vida del
torneo. Configuración:

- Backup diario nativo de Supabase (retención 7 días).
- **Red secundaria**: dump SQL semanal manual a Supabase Storage (también
  free tier, hasta 1 GB), con script `scripts/backup.sh` documentado en el
  `RUNBOOK.md`.
- RPO aceptado: **24 h** (peor caso: pierdes 1 día de datos).
- RTO objetivo: **≤ 4 h** (restore manual desde backup más reciente).

**Riesgo asumido explícitamente:** sin PITR (Point-in-Time Recovery), sin
backups continuos. Si Supabase Free no cubre las necesidades operativas
durante el torneo, evaluamos upgrade puntual a Pro (~25 €/mes) sólo durante
la ventana julio-agosto y downgrade después.

---

## §30. Marca toponímica (nueva)

**RESPUESTA:** Marca pública del torneo usa la forma oficial valenciana
**"les Coves de Vinromà"** (artículo "les" en minúscula, acento grave en
"-romà"). Se aplica a:

- Título del torneo en la web pública y emails.
- Footer y metadatos.
- Plantillas de cartel y comunicaciones.
- Schema.org / OpenGraph.

**No se renombra el repositorio git** (`Torneig_Local_Padel_2025_vinroma`)
por compatibilidad con URLs ya compartidas y para preservar histórico del
visor 2025. La discrepancia entre nombre del repo y nombre público del torneo
se documenta en el `README.md`.

---

## §31. Elegibilidad territorial (nueva)

**RESPUESTA:** Torneo **local** abierto a personas **empadronadas, residentes
o vinculadas al club** de les Coves de Vinromà. **Sin verificación formal**:
el formulario incluye un checkbox declarativo y la organización se reserva el
derecho de excluir a quien no cumpla el requisito si se acredita.

Implicación: sin lógica de validación cruzada con padrón ni con DNI; cero
fricción en el formulario; tratamiento RGPD simplificado (no se guarda foto
de DNI).

---

## §32. Elegibilidad por edad y trato a menores (nueva)

**RESPUESTA:** **Sin edad mínima**. Personas de cualquier edad pueden
inscribirse y compiten en las 4 categorías por nivel mezcladas con adultos
según su nivel real.

Salvaguardas para menores de edad (<18):

- **Consentimiento parental obligatorio** firmado por el titular de la patria
  potestad o tutor legal. Modelo de PDF descargable + subida al formulario.
- Datos del tutor legal recogidos en el formulario: nombre, DNI/NIE, teléfono,
  email.
- Tratamiento de datos del menor bajo art. 6.1.a RGPD (consentimiento
  explícito del titular de la patria potestad), no bajo interés legítimo.
- Notificaciones (email + WhatsApp) dirigidas tanto al menor como al tutor.
- Anonimización al cierre + 30 días (§21.5) aplica también a menores.

> Nota deportiva. Aunque el sistema permite la inscripción de niños muy
> pequeños, la asignación de categoría es competencia del comité organizador.
> El comité puede rechazar (con devolución íntegra de la cuota) inscripciones
> donde el desnivel con el resto de inscritos sea operativamente inviable
> (p.ej. un niño de 8 años en la categoría 1ª).

---

## §C. Decisiones ya cerradas en conversación previa (referencia, sin cambios)

| #   | Decisión                   | Resultado                                                                |
| --- | -------------------------- | ------------------------------------------------------------------------ |
| C1  | Rama de trabajo de Fase 0  | `claude/tournament-discovery-odMYj`, mergeada a `main`                   |
| C2  | Stack frontend             | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui              |
| C3  | Backend / DB               | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions + RLS)   |
| C4  | Pasarela de pago propuesta | ~~Stripe Checkout~~ → **Bizum / transferencia** (§16)                    |
| C5  | Email transaccional        | Resend                                                                   |
| C6  | Despliegue                 | Vercel. Netlify se descomisiona en Sprint 1                              |
| C7  | Migración del repo         | In-place: borrar visor 2025, reconstruir sobre `main`                    |
| C8  | Reglamento                 | Versionado en `docs/REGLAMENTO_<AÑO>.md`, no embebido en código          |
| C9  | Stop point                 | Tras Fase 0 (✅), tras Fase 1 (este documento), tras Fase 2, tras Fase 3 |

---

## Campos pendientes del organizador

> Tras la 2ª respuesta del organizador del 13-may-2026, **12 de los 15 ítems
> originales quedan resueltos** y se han integrado en las secciones
> correspondientes. Quedan **3 ítems pendientes** y **2 decisiones en
> votación de capitanes**.

### A. Datos críticos pendientes de aportar

> Estos 3 ítems **bloquean** la entrada en producción (live), pero **no
> bloquean ningún sprint de desarrollo**. Plazo orientativo: antes del cierre
> del Sprint 5.

1. **CIF del club**: `__________` (el organizador desconoce el dato en este
   momento; consultarlo en la documentación interna del Club Padel les Coves).
2. **Dirección postal completa** del club: `__________` (calle, nº, CP,
   municipio).
3. **Datos bancarios del club** (§16): teléfono Bizum: `__________` / IBAN
   completo: `__________`. Bloqueantes para Sprint 2 (formulario de pago).
4. **Lista de patrocinadores** (§20): nombres + logos + contrapartida + persona
   de contacto de cada uno. El organizador indicó que son "los que ya
   patrocinan al club" pero no los recuerda todos. **No bloquea Sprint 1**;
   el módulo de sponsors se construye con datos placeholder y se rellena
   antes de Sprint 5.

### B. Decisiones a cerrar mediante votación de capitanes

> El procedimiento, papeletas y método Borda están en
> `docs/PROPUESTA_FORMATOS.md` (2 papeletas independientes en el mismo documento).

4. **Formato deportivo** (§3): 4 opciones (Grupos+KO / Liga / Liga+Playoff / Americana).
5. **Estructura de tarifas** (§14): 3 opciones (Tarifa única / Early bird / Escalonado 3 tramos).

### C. Ítems ya resueltos (referencia)

Todas las RESPUESTAS están integradas en las secciones correspondientes del
documento (no hay que volver a leerlas aquí). Los valores cerrados que el
organizador aportó en las 2 rondas:

- (§21.1) Nombre legal: **Club Padel les Coves**.
- (§21.2) Email institucional: **`clubpadelvinroma@gmail.com`**.
- (§12) Apertura inscripciones: **1 jun 2026**. Cierre: **30 jun 2026**.
  Sorteo: **1 jul 2026**. Primer partido: **6 jul 2026**. Final: **9 ago 2026**.
- (§12) Persona contacto operativo: **Jonatan García** (tel **620 033 053**).
- (§13) **Modelo de pago dual** (1 Bizum por pareja recomendado, 1 Bizum por
  persona como alternativa).
- (§27) Subdominio Vercel: **`torneigpadelvinroma-v-2026.vercel.app`**.

---

## Próximos pasos tras cerrar este documento

1. Completar los 15 campos pendientes anteriores.
2. Lanzar la votación de capitanes (§3) con la papeleta de `docs/PROPUESTA_FORMATOS.md`.
3. **Stop point #2** cerrado tras (1) + (2).
4. Arranca **Fase 2** en paralelo:
   - `docs/PROPUESTA_EDICION_2026.md` (3-5 páginas ejecutivas).
   - `docs/REGLAMENTO_2026.md` v1.0.0.
5. Arranca **Sprint 1** (foundation): no depende de §3 ni de los campos
   pendientes; puede empezar en cuanto se confirme este documento.
