# Proposta de la V edició — Torneig de Pàdel les Coves de Vinromà 2026

> **Audiència.** Capitans i co-capitans de les parelles inscrites (i comitè
> organitzador). Document executiu de presentació.
> **Idioma.** Redactat en català (llengua per defecte de la web, §2). Es pot
> traduir al castellà sota demanda.
> **Estat.** Esborrany per presentar. Conté **2 decisions pendents de votació**
> dels capitans (format esportiu i estructura de tarifes) — el detall complet
> de les opcions és a `docs/PROPUESTA_FORMATOS.md`.
> **Data de referència.** Maig 2026.

---

## 1. En una frase

La V edició del torneig estrena una **plataforma web pròpia** per inscriure's,
pagar, consultar cuadres, horaris i resultats en directe — substituint el full
de càlcul i els missatges de WhatsApp de les edicions anteriors. Aquest document
resumeix com funcionarà i les **dues coses que els capitans heu de votar**
abans d'obrir les inscripcions.

## 2. Què és nou aquest any

| Abans (edicions anteriors)      | A partir del 2026                                                      |
| ------------------------------- | ---------------------------------------------------------------------- |
| Inscripció per WhatsApp / paper | Formulari web bilingüe (ca/es), 24 h                                   |
| Pagament i seguiment manual     | Pantalla de pagament amb Bizum/transferència + concepte automàtic      |
| Resultats publicats a mà        | Resultats amb validació dels dos capitans i classificacions en directe |
| Horaris per missatge            | Calendari per categoria + subscripció al teu propi calendari (iCal)    |
| Sense històric estructurat      | Base de dades amb auditoria de tots els canvis                         |

La feina tècnica ja està **enllestida**: el sistema fa inscripció amb control
d'aforament, pagament, conciliació, sorteig, cuadres, resultats amb validació
creuada, gestió d'incidències i publicació pública. Falten dues decisions
vostres i carregar les dades reals.

## 3. El que ja està decidit (no es vota)

Aquests paràmetres estan tancats pel comitè i emmarquen tota la resta:

- **Categories:** 4 per nivell (1a, 2a, 3a, 4a), mixtes en gènere.
- **Capacitat orientativa:** 28-32 parelles en total (configurable per categoria).
- **Seu i pistes:** 3 pistes del club de les Coves de Vinromà, reservades via Sporttia.
- **Set decisiu:** tercer set complet al 6 (tie-break a 7 si s'arriba a 6-6).
  **No** es juga super tie-break enlloc.
- **No presentació (walkover):** 6-0 6-0 a favor del rival, amb 15 min de cortesia.
- **Retirada / lesió / desqualificació:** es mantenen els partits ja jugats; els
  pendents es donen per walkover a favor del rival (no s'anul·la res del que ja
  s'ha jugat).
- **Pagament:** Bizum **o** transferència bancària al club (equivalents),
  conciliació manual, amb dos models a triar per la parella:
  - **A. Per parella** (recomanat): un sol pagament que cobreix les dues quotes.
  - **B. Per persona:** cada jugador paga la seva quota per separat.
- **Devolucions:** 100 % fins al tancament d'inscripcions; 0 % després (excepte
  cancel·lació del torneig per part de l'organització).

## 4. Calendari de la V edició

| Fita                                      | Data                              |
| ----------------------------------------- | --------------------------------- |
| Obertura d'inscripcions                   | **1 de juny de 2026**             |
| Tancament estàndard                       | **30 de juny de 2026**            |
| Tancament amb recàrrec (si queden places) | discrecional del comitè           |
| Sorteig de cuadres                        | **1 de juliol de 2026**           |
| Primer partit                             | **6 de juliol de 2026** (dilluns) |
| Final                                     | **9 d'agost de 2026** (dissabte)  |
| Finestra de joc                           | 6 jul – 9 ago (5 setmanes)        |

Franja horària de joc: dilluns a divendres de 16:00 a 23:30; dissabtes i
diumenges de 09:00 a 23:30. Capacitat de sobres per als ~64-112 partits
previstos segons el format que es voti.

## 5. DECISIÓ 1 — Format esportiu (a votar)

Cal triar com es competeix dins de cada categoria. Hi ha **4 opcions**
(detall, pros i contres a `docs/PROPUESTA_FORMATOS.md`, Part 1):

| Opció                                          | Mecànica                                                | Partits aprox. | Idea clau                                   |
| ---------------------------------------------- | ------------------------------------------------------- | -------------- | ------------------------------------------- |
| **A. Grups + KO amb consolació** (format 2025) | Grups round-robin → eliminatòria principal + consolació | ~64            | Mínim 3 partits garantits + drama de finals |
| **B. Lliga única**                             | Tothom contra tothom, guanya qui més sumi               | ~112           | Màxim joc, sense sorpresa d'un sol dia      |
| **C. Lliga + Playoff**                         | Lliga curta i després eliminatòria dels millors         | ~85            | Equilibri entre joc i emoció final          |
| **D. Americana**                               | Rotació de parelles/punts en jornades                   | variable       | Social, ràpid, menys "competitiu"           |

> Recompte pel mètode Borda. El comitè es compromet a respectar l'opció més
> votada llevat de veto tècnic justificat.

## 6. DECISIÓ 2 — Estructura de tarifes (a votar)

Cal triar com es cobra la quota. Hi ha **3 opcions** (detall a
`docs/PROPUESTA_FORMATOS.md`, Part 2):

| Opció                                                   | Descripció                                           | Preu per persona                        |
| ------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| **A. Tarifa única**                                     | Mateix preu tota la finestra                         | preu fix                                |
| **B. Early bird simple**                                | Descompte si t'apuntes aviat, després preu estàndard | 2 trams                                 |
| **C. Escalonada 3 trams + recàrrec** (proposta inicial) | El preu puja per franges; recàrrec fora de termini   | 15 € → 20 € → 25 € (+30 € fora termini) |

Valor per defecte mentre es vota (opció C, parametritzable sense tocar codi):

| Tram                               | Finestra            | Per persona | Parella |
| ---------------------------------- | ------------------- | ----------- | ------- |
| Super early                        | 1-10 jun            | 15 €        | 30 €    |
| Early                              | 11-20 jun           | 20 €        | 40 €    |
| Estàndard                          | 21-30 jun           | 25 €        | 50 €    |
| Fora de termini (si queden places) | a partir de l'1 jul | 30 €        | 60 €    |

> Ingrés previst orientatiu: ~32 parelles × 2 persones × ~22,5 € de mitjana ≈
> **1.440 €** per edició. Molt per sota de qualsevol llindar fiscal per a una
> entitat esportiva amateur.

## 7. Com serà la inscripció per a les parelles

1. Entren a la web (catalá o castellà) i, durant la finestra, veuen el
   **calendari de tarifes** i les **places lliures per categoria**.
2. Omplen les dades dels dos jugadors (incloent contacte d'emergència i una
   pregunta de salut bàsica) i accepten la política de privacitat.
3. Trien model de pagament (per parella o per persona) i veuen una **pantalla
   amb el Bizum i l'IBAN del club** + el concepte ja format per copiar.
4. L'organització concilia el pagament i la parella passa a **confirmada**;
   reben confirmació per email.
5. Després del sorteig, cada capità té un **panell** amb els seus partits,
   pot proposar canvis d'horari, reportar resultats (validats per l'altre
   capità) i subscriure's al calendari.

Si una categoria s'omple, la web ho indica i bloqueja noves inscripcions en
aquella categoria. Mentre les inscripcions encara no estan obertes, qui vulgui
pot deixar el correu per rebre **un sol avís** el dia que s'obrin.

## 8. Què falta per obrir el torneig al públic

**Decisions (vosaltres):**

- [ ] Votació del format esportiu (§5).
- [ ] Votació de l'estructura de tarifes (§6).

**Dades del club (organització):**

- [ ] CIF i adreça postal completa (per als textos legals).
- [ ] Telèfon Bizum + IBAN del club (per a la pantalla de pagament).
- [ ] Llista de patrocinadors amb logos.

**Posada en marxa tècnica (equip):**

- [ ] Crear el projecte de base de dades real i aplicar les migracions.
- [ ] Configurar el domini d'enviament d'emails.
- [ ] Carregar dates, categories, aforaments i tarifes des del panell d'admin.
- [ ] Provar el flux complet d'inscripció i pagament abans de l'1 de juny.

## 9. Pròxims passos i dates

1. **Presentació d'aquest document** als capitans.
2. **Votació** de les dues papeletes (`docs/PROPUESTA_FORMATOS.md`).
3. Tancament del **reglament 2026** amb el format guanyador.
4. Càrrega de dades + proves finals.
5. **Obertura d'inscripcions: 1 de juny de 2026.**

> Contacte de l'organització: Jonatan García · 620 033 053 ·
> clubpadelvinroma@gmail.com
