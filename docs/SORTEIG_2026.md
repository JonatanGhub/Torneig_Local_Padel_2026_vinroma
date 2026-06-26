# Sorteig 2026 — decisions de format i calendari

Document de referència per a l'equip d'organització. Recull les decisions
preses el 26 de juny de 2026 per al sorteig i el calendari de la V edició.

## 1. Parelles inscrites (font: Supabase, 26 jun 2026)

| Categoria | Parelles | Format                     |
| --------- | -------- | -------------------------- |
| 1a        | 8        | 2 grups de 4               |
| 2a        | 14       | 2 grups de 5 + 1 grup de 4 |
| 3a        | 9        | 1 grup de 5 + 1 grup de 4  |
| 4a        | 5        | 1 grup de 5                |

## 2. Format per categoria

### 1a categoria (8 parelles)

- **Grups**: 2 grups de 4 (round-robin) — 6 partits per grup, 12 en total.
- **Quadre principal**: 1r i 2n de cada grup (4 parelles) → SF + F (3 partits).
- **Quadre consolació**: 3r i 4t de cada grup (4 parelles) → SF + F (3 partits).
- **Total**: 18 partits · cada parella en juga 4 o 5.

### 2a categoria (14 parelles)

- **Grups**: 2 grups de 5 (A i B) + 1 grup de 4 (C). Total 26 partits de grup
  (10+10+6).
- **Quadre principal** (8 parelles): 1r i 2n de cada grup (6 parelles) + els
  dos 3rs dels grups de 5 (2 parelles) → quarts + SF + F (7 partits).
- **Quadre consolació** (4 parelles): 3r i 4t del grup C + 4t del grup A + 4t
  del grup B → SF + F (3 partits).
  - Emparellaments consolació: 3r-C vs. millor 4t (A o B), i 4t-C vs. l'altre 4t.
- **Fora del quadre**: 5è de A i 5è de B (es queden amb els partits del grup).
- **Total**: 36 partits · cada parella en juga entre 4 i 7 (segons recorregut).

### 3a categoria (9 parelles)

- **Grups**: 1 grup de 5 (A) + 1 grup de 4 (B) — 10 + 6 = 16 partits.
- **Quadre principal**: 1r i 2n de cada grup (4 parelles) → SF + F (3 partits).
- **Quadre consolació**: 3r i 4t de cada grup (4 parelles) → SF + F (3 partits).
- **Fora del quadre**: 5è del grup A (queda amb els 4 partits del grup).
- **Total**: 22 partits · cada parella en juga entre 4 i 6.

### 4a categoria (5 parelles)

- **Grup únic** de 5: lliga a una volta (10 partits).
- **Eliminatòria**: SF amb creuaments 1-4 i 2-3 (2 partits) + F (1 partit).
- **Fora del quadre**: 5è (queda amb els 4 partits de grup).
- **Total**: 13 partits · cada parella en juga entre 4 i 6.

### Resum

|           | Grups  | Eliminatòria | Total  | Mín/parella |
| --------- | ------ | ------------ | ------ | ----------- |
| 1a        | 12     | 3 + 3        | 18     | 4           |
| 2a        | 26     | 7 + 3        | 36     | 4           |
| 3a        | 16     | 3 + 3        | 22     | 4           |
| 4a        | 10     | 2 + 1        | 13     | 4           |
| **Total** | **64** | **25**       | **89** | —           |

> **Tothom juga com a mínim 4 partits** garantits. El recompte inicial de
> l'organització (≈150) es va revisar i es confirma que el total correcte és
> de **89 partits** (round-robin simple als grups).

## 3. Pistes i franges

- Només **Pista 2** i **Pista 3**.
- Franges: **20:30** i **22:00**.

**4 partits per nit · 4 nits per setmana (Dl–Dj) → 16 partits/setmana.**

## 4. Calendari

### Fase de grups → acabada el 30 de juliol

Tots els partits de tots els grups (**64**) han d'estar **acabats el dijous 30
de juliol**. Amb només Pista 2 i Pista 3 (4 partits/nit), les 5 setmanes del 29
de juny al 30 de juliol donen 80 slots, suficients per als 64 partits de grup.

### Última setmana (3 – 7 d'agost)

Es reserva per a l'eliminatòria: **quarts de final** (les categories que en
tinguin), **semifinals** i **finals**.

### Dies de finals especials

- **Dj 6 ag** (per aquest ordre):
  1. Final consolació 1a
  2. Final consolació 2a
  3. Final consolació 3a
  4. Final 3a
  5. Final 4a
- **Dv 7 ag**:
  1. Final 1a
  2. Final 2a

## 5. Capacitat

| Fase                      | Partits | Slots disponibles                 |
| ------------------------- | ------- | --------------------------------- |
| Grups (29 jun – 30 jul)   | 64      | 80 (5 setm. × 16)                 |
| Eliminatòries (3 – 7 ago) | 25      | última setmana + tardes de finals |
| **Total**                 | **89**  | —                                 |

La fase de grups té marge ampli (80 slots per a 64 partits). L'última setmana
és més justa: amb 4 partits/nit de dilluns a dijous (16 slots) més les finals,
cal aprofitar les tardes dels dies 6 i 7 d'agost per encabir els 25 partits
d'eliminatòria. El diumenge queda com a vàlvula de seguretat si cal.

## 6. Sorteig

- Es fa el **dissabte 27 de juny a la tarda** (tancament inscripcions: 27 jun
  12:00).
- És un sorteig amb seed reproducible (serpiente / snake) per garantir
  equilibri (§12 del Reglament).
- **Resultat públic immediatament** a l'app: `/grups` (grups per categoria) i
  `/captain/grup` per als capitans.

## 7. Recordatoris operatius (extracte del Reglament)

- **Puntualitat (§14)**: si una parella no es presenta a l'hora indicada,
  l'organització pot declarar walkover a favor del rival amb 6-0, 6-0.
- **Reprogramació (§20–§21)**: qualsevol capità pot proposar un canvi de
  data/pista des de `/captain`. El canvi és vàlid només quan el capità rival
  l'accepta abans del partit original. Si no respon, el partit es disputa
  a la data prevista. Un cop acceptada, la nova data es publica al grup
  de gestió.
- **Reportar resultats (§17, §19)**: cada capità introdueix el resultat al
  portal després del partit. El resultat queda _pendent_ fins que el rival el
  confirma. Termini: **24 hores**. Passat el termini, l'organització pot
  validar d'ofici.
- **Disputes (§18)**: si els capitans reporten resultats diferents, el partit
  queda en disputa i l'organització el resol manualment.

---

_Document generat el 26 de juny de 2026 a partir de les decisions de
l'organització i de la base de dades del torneig._
