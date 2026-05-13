# Propuestas a votación de capitanes — V Torneig de Pàdel les Coves de Vinromà (2026)

> **Estado.** Borrador interno destinado a someterse a la votación de capitanes.
> Decisión final del comité organizador a la vista del voto (no vinculante, pero
> con compromiso público de respetar la opción más votada en cada bloque salvo
> veto técnico justificado).
>
> **Audiencia.** Capitanes / co-capitanes inscritos a la V edición.
>
> **Distribución.** Se publicará en su versión definitiva en `ca/` y `es/`
> cuando esté cerrado el `docs/REGLAMENTO_2026.md` (Fase 2). La versión que
> aquí se redacta está en castellano para acelerar la revisión interna.
>
> **Estructura del documento.** Contiene **2 papeletas independientes** que se
> votan en un único formulario:
> - **Parte 1**: formato deportivo (§3 de `DECISIONES.md`) — 4 opciones.
> - **Parte 2**: estructura de tarifas (§14 de `DECISIONES.md`) — 3 opciones.
> Cada capitán rellena ambas papeletas. Recuento independiente por método Borda
> en cada parte.

---

## 0. Contexto fijo común (no se vota)

Las siguientes premisas YA están cerradas y NO se someten a votación, sólo
limitan los formatos y las tarifas posibles:

| Parámetro | Valor cerrado | Origen |
|---|---|---|
| Edición | V Torneig 2026 | §1 |
| Idioma público | Catalán por defecto + castellano | §2 |
| Categorías | 4 por nivel (1ª, 2ª, 3ª, 4ª) mixtas en género | §4 |
| Capacidad orientativa | 28-32 parejas total (pendiente ajustar) | §6 |
| Pistas disponibles | 3 pistas en les Coves de Vinromà, reservadas vía Sporttia | §12 |
| Calendario | 1 jun (apertura) → 30 jun (cierre) → 6 jul - 9 ago (partidos) | §12 |
| Set decisivo | Tercer set completo al 6 (TB a 7 si 6-6); **sin** super tie-break | §8 |
| Duración media por partido | ~95 min (set completo + descanso) | derivado §8 |
| Capacidad práctica por pista | ~14 partidos/día entre semana, ~27/día en finde | derivado |
| Pago | Bizum **o** transferencia bancaria al club (equivalentes), conciliación manual, modelo dual (por pareja o por persona) | §13, §16 |

---

# PARTE 1 — Formato deportivo

## 1.1. Opciones sometidas a votación

### Opción A — Grupos round-robin + KO con consolación (formato 2025)

**Mecánica.**
Cada categoría se divide en *grupos* de 3-4 parejas. Cada pareja juega contra
todas las del grupo (round-robin). Las dos primeras de cada grupo pasan al
*cuadro principal* eliminatorio (KO). Las eliminadas pasan al *cuadro de
consolación* para que cada pareja juegue ≥3 partidos garantizados.

**Esquema típico (8 parejas/categoría, 32 totales):**
```
Fase grupos        →  KO principal      →  Final
2 grupos de 4         4 parejas (SF)       2 parejas
Cada pareja x3       Cada pareja x1-2     Cada pareja x1
```
≈ 16 partidos/categoría × 4 categorías = **~64 partidos torneo**.

**Pros.**
- Drama final claro (semifinales + final).
- Garantía mínima de 3 partidos por pareja gracias al cuadro de consolación.
- Formato familiar para los inscritos (es el que conocieron en 2025).
- Calendario denso y predecible.

**Contras.**
- 1 partido KO decisivo: lo malo de un día puede eliminarte.
- En grupo único de 4ª (si tiene <8 parejas) la fase de grupos se reduce y el formato pierde gracia.

### Opción B — Liga única round-robin (sin KO)

**Mecánica.**
Cada categoría es una liga: todas las parejas se enfrentan a todas. Gana quien
sume más partidos al final. Sin fase eliminatoria.

**Esquema típico (8 parejas/categoría):**
```
8 parejas → cada una juega 7 partidos
Total: 28 partidos/categoría × 4 categorías = ~112 partidos
```
≈ 75 % más partidos que la opción A.

**Pros.**
- Máxima justicia deportiva: el campeón es el más regular, no el que tuvo suerte en el cuadro.
- Cada pareja juega muchos partidos (7 con 8 parejas; 11 con 12).
- Sin dramas de "salí en el cuadro malo".

**Contras.**
- **Sin final espectacular.** El último día puede no decidir nada si el líder ya es matemático.
- Calendario significativamente más largo (~4-5 finsdes vs. ~3 finsdes de A).
- Empates múltiples a final de liga obligan a aplicar los desempates (§7) — explicación complicada en público.

### Opción C — Liga regular + playoff de los N primeros

**Mecánica.**
Fase de liga regular como en B, pero **acortada**: cada pareja juega contra
~N-1 rivales (no contra todas). Las N mejores parejas pasan a un playoff
eliminatorio corto que decide campeón.

**Esquema típico (8 parejas, top-4 al playoff):**
```
Liga regular: 8 parejas, 5 jornadas
            (cada pareja juega 5 partidos)
            = 20 partidos/categoría
Playoff: SF (1º vs 4º, 2º vs 3º) + Final
       = 3 partidos/categoría
Total: 23 partidos/categoría × 4 categorías = ~92 partidos
```

**Pros.**
- Combina lo bueno de A (drama final con SF+Final) y lo bueno de B (regularidad pondera más que un solo mal día).
- Calendario similar al de A (~3-4 finsdes).

**Contras.**
- Más complejo de comunicar ("¿cuántos partidos juego en la liga? ¿cuáles cuentan para el playoff?").
- Requiere algoritmo de scheduling cuidadoso para que la liga regular sea balanceada (no todas las parejas se enfrentan a las mismas).

### Opción D — Americana (rotación libre de parejas)

> ⚠️ **Aviso.** Esta opción es **estructuralmente incompatible** con el modelo
> actual de "parejas fijas inscritas". En una Americana, los jugadores no juegan
> con su pareja fija sino que las parejas se forman aleatoriamente partido a
> partido. Si esta opción ganase la votación, el comité organizador tendría que
> rediseñar el torneo entero: inscripción individual (no por pareja), categorías
> por jugador (no por pareja), sistema de puntuación individual, eliminación de
> los premios de "campeón de pareja".
>
> Se incluye en la papeleta por transparencia: que los capitanes puedan votar
> si lo desean, pero queda implícito que **votar D implica reabrir el diseño completo del torneo**.

**Mecánica.**
Cada ronda, las parejas se forman al azar (o por rotación predefinida). Cada
jugador acumula puntos individuales según las victorias de la pareja efímera
en la que ha jugado.

**Pros.**
- Muy social: juegas con todos.
- Permite acomodar inscritos sin pareja predefinida.

**Contras.**
- No hay "campeón de pareja" — rompe la identidad del torneo 2025.
- Necesita rediseño total del modelo de datos.
- Más conocido como formato de fiesta deportiva que como torneo formal.

---

## 1.2. Matriz de comparación rápida (formato)

| Criterio | A: Grupos+KO | B: Liga | C: Liga+Playoff | D: Americana |
|---|---|---|---|---|
| Partidos garantizados por pareja | 3-6 | 7 (con 8 parejas) | 5-7 | 4-6 |
| Drama final | **Alto** | Bajo | **Alto** | Nulo |
| Justicia deportiva (≠ azar) | Media | **Máxima** | Alta | Media |
| Calendario total (finsdes) | ~3 | ~4-5 | ~3-4 | ~1-2 |
| Total partidos a programar | ~64 | ~112 | ~92 | ~50-70 |
| Encaja en 3 pistas + ventana julio/agosto | ✅ | ⚠️ ajustado | ✅ | ✅ |
| Compatible con parejas fijas | ✅ | ✅ | ✅ | ❌ |
| Familiar para inscritos 2025 | ✅ | ⚠️ | ❌ | ❌ |
| Esfuerzo de comunicación | Bajo | Bajo | Medio | Alto |
| Coste de implementación técnica | Bajo (ya casi modelado) | Medio | Alto | Muy alto |

---

## 1.3. Papeleta de votación — Formato deportivo

> **Ordena las opciones por preferencia**, asignando una posición de 1 a 4 a cada una.
> 1 = la que más prefiero, 4 = la que menos prefiero. Cada número se usa una sola vez.
>
> - [ ] Opción A — Grupos + KO (formato 2025)
> - [ ] Opción B — Liga única round-robin
> - [ ] Opción C — Liga regular + playoff
> - [ ] Opción D — Americana (implica rediseño del torneo)
>
> Comentario libre (opcional): _________________________________________

---

# PARTE 2 — Estructura de tarifas

## 2.1. Opciones sometidas a votación

> Premisas comunes a las 3 opciones:
> - Cuota expresada **por persona** (cada pareja paga 2 cuotas).
> - Modelo de pago dual: 1 transacción por pareja *(recomendado)* o 1 por persona.
> - Métodos de pago aceptados (equivalentes): **Bizum** al teléfono del club
>   **o** **transferencia bancaria** al IBAN del club.
> - Cero descuentos por condición de socio del club o federado RFEP.
> - Coherente con el reembolso de §15 (100 % hasta cierre, 0 % después).

### Opción A — Tarifa única por pareja (la más simple)

**Mecánica.**
Una sola tarifa para todo el periodo de inscripción. No hay descuentos ni
recargos. Lo mismo paga el primero que el último.

**Importes propuestos:**
| Periodo | Importe por persona | Pareja completa |
|---|---|---|
| 1 jun → 30 jun 2026 | **25 €** | 50 € |
| Fuera de plazo (discrecional, si quedan plazas) | **30 €** | 60 € |

Total ingresos esperados (32 parejas confirmadas): **1.600 €**.

**Pros.**
- Comunicación extremadamente simple ("son 25 €").
- Cero fricción operativa: una tarifa única, sin tramos que vigilar.
- Sin "carrera" por inscribirse pronto: cada uno se inscribe cuando le viene.

**Contras.**
- Sin incentivo financiero a inscribirse pronto → riesgo de que la inscripción se concentre en la última semana, lo que dificulta el cierre del cuadro y la logística.
- Recaudación inferior si la mayoría hubiera estado dispuesta a pagar más.

### Opción B — Early bird simple

**Mecánica.**
Dos tarifas: una reducida hasta una fecha intermedia (early bird) y una
estándar después. Sin recargo posterior. Incentiva inscripción temprana sin
penalizar al retrasado.

**Importes propuestos:**
| Periodo | Importe por persona | Pareja completa |
|---|---|---|
| 1 jun → 15 jun 2026 (early bird) | **20 €** | 40 € |
| 16 jun → 30 jun 2026 (estándar) | **25 €** | 50 € |
| Fuera de plazo (discrecional, si quedan plazas) | **30 €** | 60 € |

Total ingresos esperados (32 parejas, 50 % en early bird, 50 % en estándar): **1.440 €**.

**Pros.**
- Incentiva inscripción temprana → mejor planificación del cuadro y la logística.
- Más fácil de comunicar que la C (sólo 2 fechas a recordar).
- Ofrece a los inscritos disciplinados un descuento como recompensa.

**Contras.**
- Sigue habiendo riesgo de que la inscripción se concentre el día 15-jun (último día del descuento).
- Recaudación intermedia.

### Opción C — Escalonado 3 tramos + recargo fuera de plazo (propuesta inicial del organizador)

**Mecánica.**
3 tarifas crecientes de 10 días cada una, más un recargo si el organizador
abre periodo fuera de plazo. Penaliza la inscripción tardía progresivamente.

**Importes propuestos (tal como los planteó el organizador):**
| Periodo | Importe por persona | Pareja completa |
|---|---|---|
| 1 jun → 10 jun 2026 (Tramo 1) | **15 €** | 30 € |
| 11 jun → 20 jun 2026 (Tramo 2) | **20 €** | 40 € |
| 21 jun → 30 jun 2026 (Tramo 3) | **25 €** | 50 € |
| Fuera de plazo (discrecional, si quedan plazas) | **30 €** | 60 € |

Total ingresos esperados (32 parejas, distribución pareja entre los 3 tramos): **1.280 €**.

**Pros.**
- Distribuye la inscripción de forma más uniforme en el mes de junio (cada
  tramo de 10 días tiene su propia carrera).
- Recompensa generosamente al inscrito muy temprano (15 € es la mitad del
  recargo).
- Más opciones de planificación interna del comité (puedes ver cómo va el
  ritmo de inscripción cada 10 días).

**Contras.**
- Mayor complejidad de comunicación (3 fechas + recargo).
- Recaudación inferior si la mayoría se inscribe en el Tramo 1.
- Más riesgo de error de conciliación (el admin tiene que aplicar la tarifa
  correcta según fecha de pago).

---

## 2.2. Matriz de comparación rápida (tarifas)

| Criterio | A: Única | B: Early bird | C: Escalonado |
|---|---|---|---|
| Importe mín. / máx. por persona | 25 / 30 € | 20 / 30 € | 15 / 30 € |
| Importe medio esperado | 25 € | 22.5 € | 20 € |
| Nº de fechas a comunicar | 1 (cierre) | 2 | 3 + recargo |
| Incentivo a inscribirse pronto | Nulo | Medio | Alto |
| Recaudación esperada (32 parejas) | 1.600 € | 1.440 € | 1.280 € |
| Complejidad de conciliación admin | Baja | Media | Alta |
| Riesgo de error de tarifa | Bajo | Bajo | Medio |
| Comunicación a inscritos | Trivial | Sencilla | Necesita gráfica |

---

## 2.3. Papeleta de votación — Estructura de tarifas

> **Ordena las opciones por preferencia**, asignando una posición de 1 a 3 a cada una.
> 1 = la que más prefiero, 3 = la que menos prefiero. Cada número se usa una sola vez.
>
> - [ ] Opción A — Tarifa única por pareja
> - [ ] Opción B — Early bird simple (2 tarifas)
> - [ ] Opción C — Escalonado 3 tramos + recargo
>
> Comentario libre (opcional): _________________________________________

---

# Recuento y procedimiento (común a las 2 papeletas)

**Recuento.** Se aplica el método **Borda** independientemente en cada papeleta:
- **Parte 1 (formato, 4 opciones):** 1=4pts, 2=3pts, 3=2pts, 4=1pt.
- **Parte 2 (tarifas, 3 opciones):** 1=3pts, 2=2pts, 3=1pt.

Suma de puntos por opción → la opción con más suma es la ganadora **en cada parte**.
En caso de empate técnico (diferencia < 5 % del total), el comité organizador
desempata con criterio operativo (calendario, complejidad, riesgo).

**Procedimiento y plazos:**
1. **Día D**: el comité envía esta propuesta a los capitanes vía email +
   WhatsApp (en versión catalana/castellana traducida).
2. **D + 7 a D + 10**: ventana para votar.
3. **D + 12**: el comité publica el resultado del recuento de las 2 papeletas
   y la decisión final (incluyendo eventual desempate o reserva técnica).
4. **D + 14**: arranca redacción de `docs/REGLAMENTO_2026.md` con el formato
   y la estructura de tarifas elegidos como decisiones cerradas.

---

# Notas técnicas para el comité (no para los capitanes)

## Sobre formato (Parte 1)

- El motor de cuadros y standings de la edición 2025 (`getStandings`) cubre
  bien las opciones **A** y **B**. La opción **C** exige adaptaciones
  moderadas (algoritmo de scheduling balanceado de liga regular + bracket
  generator de playoff). La **D** exige rediseño completo.
- Recomendación interna **no comunicada en la papeleta**: si el voto saliera
  como **A** o **C** (ambas plausibles), Sprint 2 puede arrancar en paralelo a
  la votación. Si saliera **B**, recalibrar calendario y capacidad. Si saliera
  **D**, ejecutar **stop point** y replantear.

## Sobre tarifas (Parte 2)

- Las 3 opciones están **parametrizadas en una tabla `tournament_fees`**
  de la base de datos: aplicar el resultado del voto es **cambiar 1-2 filas
  en una tabla** y un redeploy de configuración (~5 min de trabajo admin),
  no implica cambio de código.
- El sistema asume desde Sprint 1 la **opción C como valor por defecto**
  (las cifras del organizador) para no bloquear el desarrollo del formulario
  de inscripción ni el módulo de conciliación. Si gana A o B, se sustituyen
  las filas de `tournament_fees` antes del 1 jun 2026.
