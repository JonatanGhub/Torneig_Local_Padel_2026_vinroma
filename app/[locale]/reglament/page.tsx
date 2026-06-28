import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { LegalPage } from '@/components/legal/legal-page';
import { PrintButton } from './print-button';

type Props = { params: Promise<{ locale: Locale }> };

type Section = { h: string; p: string };

const TEXTS = {
  ca: {
    title: 'Reglament del torneig',
    updated: 'Edició 2026 · Actualitzat el 30 de maig de 2026',
    intro:
      "Aquest reglament regeix la V edició del Torneig de Pàdel les Coves de Vinromà. La inscripció implica l'acceptació íntegra de totes les seves clàusules.",
    download: 'Descarregar PDF',
    sections: [
      {
        h: 'I — Aspectes generals',
        items: [
          {
            h: '§1. Organització',
            p: "L'organització del torneig correspon al Club Pàdel les Coves de Vinromà, amb domicili a les Coves de Vinromà (Castelló) i correu de contacte clubpadelvinroma@gmail.com.",
          },
          {
            h: '§2. Dates',
            p: "L'edició 2026 es disputarà entre el 29 de juny i el 6 d'agost de 2026, tots dos inclosos. Els partits es jugaran de dilluns a dijous, entre les 19:00 i les 22:00 hores.",
          },
          {
            h: '§3. Instal·lacions',
            p: "Tots els partits es disputaran a les pistes del Club Pàdel les Coves de Vinromà. L'horari oficial del torneig és de dilluns a dijous, a la Pista 2 i la Pista 3, a les 20:30 i a les 22:00. A la fase eliminatòria (última setmana) també s'obre la Pista 1 a les mateixes hores. IMPORTANT: si una parella decideix jugar un partit fora d'aquest horari oficial (un altre dia, hora o pista), la reserva de la pista, les pilotes i la llum van a càrrec d'algun dels 4 jugadors del partit; l'organització només cobreix els partits jugats en horari oficial.",
          },
          {
            h: '§4. Categories',
            p: "El torneig consta de quatre categories per nivell (1a, 2a, 3a i 4a). Cada categoria té un màxim de parelles. La 1a categoria és la d'avançats; la 4a és la d'iniciació. La participació és mixta en gènere.",
          },
        ],
      },
      {
        h: 'II — Inscripció',
        items: [
          {
            h: '§5. Modalitat',
            p: "La inscripció es fa per parelles a través del formulari oficial al web. Cada parella tria una categoria. Els jugadors han de declarar les seves dades, nivell, contacte d'emergència i acceptar la declaració de salut.",
          },
          {
            h: '§6. Quotes',
            p: 'La quota es paga per jugador, segons tres trams (early, estàndard i recàrrec fora de termini). El pagament es fa per transferència o ingrés en compte; la parella queda confirmada un cop el club concilia el pagament.',
          },
          {
            h: "§7. Termini d'inscripció",
            p: "Les inscripcions s'obren el 25 de maig de 2026 i es tanquen el 20 de juny de 2026. Les inscripcions rebudes fora d'aquest termini només s'admeten a discreció de l'organització.",
          },
          {
            h: '§8. Vinculació al club',
            p: "Per inscriure's, almenys un dels dos jugadors ha de ser resident, empadronat o vinculat al Club Pàdel les Coves de Vinromà (§31).",
          },
          {
            h: "§9. Menors d'edat",
            p: "Els menors de 18 anys poden participar amb el permís explícit del seu pare, mare o tutor legal. La conformitat ha de quedar confirmada amb el club abans del primer partit. L'inscripció no es bloqueja per minoria d'edat (§32).",
          },
        ],
      },
      {
        h: 'III — Format de joc',
        items: [
          {
            h: '§10. Fase de grups',
            p: 'A cada categoria es formen entre 1 i 4 grups segons el nombre de parelles inscrites. Dins de cada grup es juga round-robin (totes contra totes).',
          },
          {
            h: '§11. Format dels partits',
            p: "Els partits es disputen al millor de tres sets de 6 jocs. El tercer set és complet al 6 (no super tie-break). En cas d'empat a 6, es juga tie-break a 7 amb diferència de 2.",
          },
          {
            h: '§12. Sorteig de grups i emparellaments',
            p: 'El sorteig de grups es realitza un cop tancada la inscripció. La distribució és per serpiente (snake) amb seed reproducible per garantir equilibri.',
          },
          {
            h: '§13. Eliminatòria',
            p: "Es classifiquen les dues primeres parelles de cada grup. La fase eliminatòria és a partit únic. Hi ha quadre de consolació per als no classificats si l'organització ho considera oportú.",
          },
          {
            h: '§14. Walkover',
            p: "Si una parella no es presenta en el moment del partit, l'organització pot declarar walkover a favor del rival, comptabilitzant-se com a victòria per 6-0, 6-0.",
          },
        ],
      },
      {
        h: 'IV — Capitania i resultats',
        items: [
          {
            h: '§15. Capità de parella',
            p: "Cada parella designa un capità durant la inscripció. El capità és l'interlocutor amb l'organització i el responsable de reportar resultats i acceptar propostes de canvi de partit.",
          },
          {
            h: '§16. Accés al portal del capità',
            p: 'El capità accedeix al portal /captain mitjançant correu electrònic (enllaç màgic + codi de 4 a 8 dígits). Pot configurar un PIN de 4 dígits que li permet entrar més àgilment des del mateix dispositiu.',
          },
          {
            h: '§17. Reportar resultats',
            p: "Acabat el partit, cada capità ha d'introduir el resultat al portal. El resultat queda pendent fins que el rival el confirma. Per agilitzar la validació, es notifica per correu i WhatsApp.",
          },
          {
            h: '§18. Disputes',
            p: "Si els dos capitans reporten resultats diferents, el partit queda en disputa i l'organització el resol manualment, contactant les dues parelles si cal.",
          },
          {
            h: '§19. Termini per a reportar',
            p: "El resultat s'ha de reportar dins de les 24 hores següents al partit. Passat aquest termini, l'organització pot validar el resultat d'ofici.",
          },
        ],
      },
      {
        h: 'V — Reprogramació de partits',
        items: [
          {
            h: '§20. Proposta de canvi',
            p: "Qualsevol capità pot proposar un canvi de data o pista d'un partit a través del portal /captain. El portal mostra els buits oficials lliures (Dl–Dj, Pista 2/3, 20:30 i 22:00) per triar-ne un fàcilment. La proposta s'envia al capità rival per correu i WhatsApp. Recorda: si es proposa jugar fora de l'horari oficial, la reserva, les pilotes i la llum van a càrrec dels 4 jugadors (§3).",
          },
          {
            h: '§21. Acceptació',
            p: "El canvi és vàlid quan el capità rival l'accepta. Si el rebutja o no respon abans del partit original, el partit es disputa a la data prevista. Un cop acceptada, la nova data es publica al grup de gestió.",
          },
        ],
      },
      {
        h: 'VI — Conducta i sancions',
        items: [
          {
            h: '§22. Esportivitat',
            p: "Es demana respecte als rivals, àrbitres si n'hi ha, organització i instal·lacions. Conductes antiesportives poden suposar amonestació o desqualificació.",
          },
          {
            h: '§23. Material',
            p: 'Cada jugador és responsable del seu material (pala, sabatilles, equipament). El club proporciona les pilotes oficials.',
          },
          {
            h: '§24. Vestuari',
            p: "És obligatòria roba esportiva i sabatilles de pàdel o tenis. No s'admeten sabatilles que puguin malmetre la superfície de les pistes.",
          },
          {
            h: '§25. Validació creuada',
            p: "Els resultats es validen creuadament entre rivals (capità rival confirma el marcador reportat). Si no hi ha consens, l'administració resol.",
          },
          {
            h: '§26. Retirada',
            p: 'La parella pot retirar-se abans del sorteig sense conseqüències i amb devolució de la quota. Després del sorteig, no hi ha devolució excepte causa de força major degudament justificada.',
          },
        ],
      },
      {
        h: 'VII — Publicació de dades i RGPD',
        items: [
          {
            h: '§27. Publicació de resultats',
            p: "Els resultats, classificacions i quadres es publiquen al web amb el nom dels jugadors. La inscripció implica l'acceptació d'aquesta publicació, llevat que el jugador retiri el consentiment explícitament.",
          },
          {
            h: '§28. Comunicacions',
            p: "Les comunicacions oficials (confirmació d'inscripció, recordatoris, resultats validats, etc.) s'envien per correu electrònic. Si el jugador ho consent, també per WhatsApp.",
          },
          {
            h: '§29. Drets dels usuaris',
            p: "Els jugadors poden exercir els drets d'accés, rectificació, supressió, portabilitat i oposició al tractament de les seves dades segons el que preveu la Política de Privacitat del web.",
          },
          {
            h: '§30. Anonimització',
            p: "Les dades personals identificables s'anonimitzen 30 dies després de la final del torneig. Els resultats i classificacions es conserven indefinidament en forma agregada o seudonimitzada amb finalitats històriques i estadístiques.",
          },
        ],
      },
      {
        h: 'VIII — Disposicions finals',
        items: [
          {
            h: '§31. Vinculació al club (clàusula completa)',
            p: 'A efectes d\'aquest reglament, es consideren "vinculats al club" els residents i empadronats al municipi de les Coves de Vinromà, així com els socis del club i els jugadors habituals que el club determini cas per cas.',
          },
          {
            h: "§32. Menors d'edat (clàusula completa)",
            p: "Els menors de 18 anys poden inscriure's i participar amb el consentiment del pare, mare o tutor legal. La inscripció no es bloqueja a l'app: el sistema mostra un avís perquè la família contacti amb l'organització i confirmi l'autorització abans del primer partit. L'organització es reserva el dret a no admetre la inscripció si no es proporciona aquest consentiment.",
          },
          {
            h: '§33. Casos no previstos',
            p: "Tot el que no quedi expressament regulat en aquest reglament es resoldrà per decisió de l'organització, atenent l'esperit del torneig i el principi de bona fe esportiva.",
          },
          {
            h: '§34. Acceptació',
            p: "La inscripció al torneig implica el coneixement i l'acceptació íntegra del present reglament.",
          },
        ],
      },
    ] as { h: string; items: Section[] }[],
  },
  es: {
    title: 'Reglamento del torneo',
    updated: 'Edición 2026 · Actualizado el 30 de mayo de 2026',
    intro:
      'Este reglamento rige la V edición del Torneo de Pádel les Coves de Vinromà. La inscripción implica la aceptación íntegra de todas sus cláusulas.',
    download: 'Descargar PDF',
    sections: [
      {
        h: 'I — Aspectos generales',
        items: [
          {
            h: '§1. Organización',
            p: 'La organización del torneo corresponde al Club Pádel les Coves de Vinromà, con domicilio en les Coves de Vinromà (Castellón) y correo de contacto clubpadelvinroma@gmail.com.',
          },
          {
            h: '§2. Fechas',
            p: 'La edición 2026 se disputará entre el 29 de junio y el 6 de agosto de 2026, ambos inclusive. Los partidos se jugarán de lunes a jueves, entre las 19:00 y las 22:00 horas.',
          },
          {
            h: '§3. Instalaciones',
            p: 'Todos los partidos se disputarán en las pistas del Club Pádel les Coves de Vinromà. El horario oficial del torneo es de lunes a jueves, en la Pista 2 y la Pista 3, a las 20:30 y a las 22:00. En la fase eliminatoria (última semana) también se abre la Pista 1 a las mismas horas. IMPORTANTE: si una pareja decide jugar un partido fuera de ese horario oficial (otro día, hora o pista), la reserva de la pista, las pelotas y la luz corren a cargo de alguno de los 4 jugadores del partido; la organización solo cubre los partidos jugados en horario oficial.',
          },
          {
            h: '§4. Categorías',
            p: 'El torneo consta de cuatro categorías por nivel (1ª, 2ª, 3ª y 4ª). Cada categoría tiene un máximo de parejas. La 1ª categoría es la de avanzados; la 4ª es la de iniciación. La participación es mixta en género.',
          },
        ],
      },
      {
        h: 'II — Inscripción',
        items: [
          {
            h: '§5. Modalidad',
            p: 'La inscripción se hace por parejas a través del formulario oficial en el web. Cada pareja elige una categoría. Los jugadores deben declarar sus datos, nivel, contacto de emergencia y aceptar la declaración de salud.',
          },
          {
            h: '§6. Cuotas',
            p: 'La cuota se paga por jugador, según tres tramos (early, estándar y recargo fuera de plazo). El pago se realiza por transferencia o ingreso en cuenta; la pareja queda confirmada una vez el club concilia el pago.',
          },
          {
            h: '§7. Plazo de inscripción',
            p: 'Las inscripciones se abren el 25 de mayo de 2026 y se cierran el 20 de junio de 2026. Las inscripciones recibidas fuera de este plazo solo se admiten a discreción de la organización.',
          },
          {
            h: '§8. Vinculación al club',
            p: 'Para inscribirse, al menos uno de los dos jugadores debe ser residente, empadronado o vinculado al Club Pádel les Coves de Vinromà (§31).',
          },
          {
            h: '§9. Menores de edad',
            p: 'Los menores de 18 años pueden participar con el permiso explícito de su padre, madre o tutor legal. La conformidad debe quedar confirmada con el club antes del primer partido. La inscripción no se bloquea por minoría de edad (§32).',
          },
        ],
      },
      {
        h: 'III — Formato de juego',
        items: [
          {
            h: '§10. Fase de grupos',
            p: 'En cada categoría se forman entre 1 y 4 grupos según el número de parejas inscritas. Dentro de cada grupo se juega round-robin (todas contra todas).',
          },
          {
            h: '§11. Formato de los partidos',
            p: 'Los partidos se disputan al mejor de tres sets de 6 juegos. El tercer set es completo al 6 (no super tie-break). En caso de empate a 6, se juega tie-break a 7 con diferencia de 2.',
          },
          {
            h: '§12. Sorteo de grupos y emparejamientos',
            p: 'El sorteo de grupos se realiza una vez cerrada la inscripción. La distribución es por serpiente (snake) con seed reproducible para garantizar equilibrio.',
          },
          {
            h: '§13. Eliminatoria',
            p: 'Se clasifican las dos primeras parejas de cada grupo. La fase eliminatoria es a partido único. Hay cuadro de consolación para los no clasificados si la organización lo considera oportuno.',
          },
          {
            h: '§14. Walkover',
            p: 'Si una pareja no se presenta en el momento del partido, la organización puede declarar walkover a favor del rival, contabilizándose como victoria por 6-0, 6-0.',
          },
        ],
      },
      {
        h: 'IV — Capitanía y resultados',
        items: [
          {
            h: '§15. Capitán de pareja',
            p: 'Cada pareja designa un capitán durante la inscripción. El capitán es el interlocutor con la organización y el responsable de reportar resultados y aceptar propuestas de cambio de partido.',
          },
          {
            h: '§16. Acceso al portal del capitán',
            p: 'El capitán accede al portal /captain mediante correo electrónico (enlace mágico + código de 4 a 8 dígitos). Puede configurar un PIN de 4 dígitos que le permite entrar más ágilmente desde el mismo dispositivo.',
          },
          {
            h: '§17. Reportar resultados',
            p: 'Terminado el partido, cada capitán debe introducir el resultado en el portal. El resultado queda pendiente hasta que el rival lo confirma. Para agilizar la validación, se notifica por correo y WhatsApp.',
          },
          {
            h: '§18. Disputas',
            p: 'Si los dos capitanes reportan resultados distintos, el partido queda en disputa y la organización lo resuelve manualmente, contactando a las dos parejas si es necesario.',
          },
          {
            h: '§19. Plazo para reportar',
            p: 'El resultado debe reportarse dentro de las 24 horas siguientes al partido. Pasado este plazo, la organización puede validar el resultado de oficio.',
          },
        ],
      },
      {
        h: 'V — Reprogramación de partidos',
        items: [
          {
            h: '§20. Propuesta de cambio',
            p: 'Cualquier capitán puede proponer un cambio de fecha o pista de un partido a través del portal /captain. El portal muestra los huecos oficiales libres (Lu–Ju, Pista 2/3, 20:30 y 22:00) para elegir uno fácilmente. La propuesta se envía al capitán rival por correo y WhatsApp. Recuerda: si se propone jugar fuera del horario oficial, la reserva, las pelotas y la luz corren a cargo de los 4 jugadores (§3).',
          },
          {
            h: '§21. Aceptación',
            p: 'El cambio es válido cuando el capitán rival lo acepta. Si lo rechaza o no responde antes del partido original, el partido se disputa en la fecha prevista. Una vez aceptada, la nueva fecha se publica en el grupo de gestión.',
          },
        ],
      },
      {
        h: 'VI — Conducta y sanciones',
        items: [
          {
            h: '§22. Deportividad',
            p: 'Se pide respeto a rivales, árbitros si los hay, organización e instalaciones. Conductas antideportivas pueden suponer amonestación o descalificación.',
          },
          {
            h: '§23. Material',
            p: 'Cada jugador es responsable de su material (pala, zapatillas, equipamiento). El club proporciona las pelotas oficiales.',
          },
          {
            h: '§24. Vestuario',
            p: 'Es obligatoria ropa deportiva y zapatillas de pádel o tenis. No se admiten zapatillas que puedan dañar la superficie de las pistas.',
          },
          {
            h: '§25. Validación cruzada',
            p: 'Los resultados se validan cruzadamente entre rivales (capitán rival confirma el marcador reportado). Si no hay consenso, la administración resuelve.',
          },
          {
            h: '§26. Retirada',
            p: 'La pareja puede retirarse antes del sorteo sin consecuencias y con devolución de la cuota. Tras el sorteo, no hay devolución salvo causa de fuerza mayor debidamente justificada.',
          },
        ],
      },
      {
        h: 'VII — Publicación de datos y RGPD',
        items: [
          {
            h: '§27. Publicación de resultados',
            p: 'Los resultados, clasificaciones y cuadros se publican en el web con el nombre de los jugadores. La inscripción implica la aceptación de esta publicación, salvo que el jugador retire el consentimiento explícitamente.',
          },
          {
            h: '§28. Comunicaciones',
            p: 'Las comunicaciones oficiales (confirmación de inscripción, recordatorios, resultados validados, etc.) se envían por correo electrónico. Si el jugador lo consiente, también por WhatsApp.',
          },
          {
            h: '§29. Derechos de los usuarios',
            p: 'Los jugadores pueden ejercer los derechos de acceso, rectificación, supresión, portabilidad y oposición al tratamiento de sus datos según lo previsto en la Política de Privacidad del web.',
          },
          {
            h: '§30. Anonimización',
            p: 'Los datos personales identificables se anonimizan 30 días después de la final del torneo. Los resultados y clasificaciones se conservan indefinidamente en forma agregada o seudonimizada con fines históricos y estadísticos.',
          },
        ],
      },
      {
        h: 'VIII — Disposiciones finales',
        items: [
          {
            h: '§31. Vinculación al club (cláusula completa)',
            p: 'A efectos de este reglamento, se consideran "vinculados al club" los residentes y empadronados en el municipio de les Coves de Vinromà, así como los socios del club y los jugadores habituales que el club determine caso por caso.',
          },
          {
            h: '§32. Menores de edad (cláusula completa)',
            p: 'Los menores de 18 años pueden inscribirse y participar con el consentimiento del padre, madre o tutor legal. La inscripción no se bloquea en la app: el sistema muestra un aviso para que la familia contacte con la organización y confirme la autorización antes del primer partido. La organización se reserva el derecho a no admitir la inscripción si no se proporciona este consentimiento.',
          },
          {
            h: '§33. Casos no previstos',
            p: 'Todo lo que no quede expresamente regulado en este reglamento se resolverá por decisión de la organización, atendiendo al espíritu del torneo y al principio de buena fe deportiva.',
          },
          {
            h: '§34. Aceptación',
            p: 'La inscripción al torneo implica el conocimiento y la aceptación íntegra del presente reglamento.',
          },
        ],
      },
    ] as { h: string; items: Section[] }[],
  },
} as const;

export default async function ReglamentPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = TEXTS[locale];

  return (
    <LegalPage locale={locale} title={data.title} updatedAt={data.updated}>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="max-w-prose text-sm text-white/65 italic">{data.intro}</p>
        <PrintButton label={data.download} />
      </div>

      <p className="hidden text-sm leading-relaxed print:block">{data.intro}</p>

      {data.sections.map((part) => (
        <div key={part.h} className="space-y-4">
          <h2 className="font-display border-crimson-500/40 mt-8 border-b pb-2 text-2xl font-semibold text-white print:border-black print:text-black">
            {part.h}
          </h2>
          {part.items.map((s) => (
            <section key={s.h}>
              <h3 className="font-display text-lg font-semibold text-white print:text-black">
                {s.h}
              </h3>
              <p className="mt-1 text-sm leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>
      ))}
    </LegalPage>
  );
}
