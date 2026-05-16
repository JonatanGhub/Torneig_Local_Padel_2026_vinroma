import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { LegalPage } from '@/components/legal/legal-page';

type Props = { params: Promise<{ locale: Locale }> };

const TEXTS = {
  ca: {
    title: 'Avís legal',
    updated: 'Actualitzat el 16 de maig de 2026',
    sections: [
      {
        h: '1. Titular del lloc web',
        p: 'Aquest lloc web és titularitat de Club Pàdel Les Coves de Vinromà (en endavant, "el Club"), amb domicili a Les Coves de Vinromà (Castelló) i correu electrònic de contacte clubpadelvinroma@gmail.com.',
      },
      {
        h: '2. Objecte',
        p: 'El lloc web té com a finalitat la gestió i difusió pública del V Torneig de Pàdel les Coves de Vinromà (edició 2026): inscripcions, calendari, classificacions, resultats i comunicacions amb els participants.',
      },
      {
        h: "3. Condicions d'ús",
        p: "L'usuari es compromet a fer un ús lícit del lloc, abstenint-se d'introduir continguts ofensius, falsos, contraris al RGPD o que infringeixin drets de tercers. El Club es reserva el dret a suspendre l'accés a usuaris que infringeixin aquestes condicions.",
      },
      {
        h: '4. Propietat intel·lectual',
        p: 'Tots els continguts del lloc (textos, logotips, fotografies de les instal·lacions, codi font) són propietat del Club o utilitzats amb llicència. Queda prohibida la seva reproducció total o parcial sense autorització expressa, excepte per a ús personal no comercial.',
      },
      {
        h: '5. Responsabilitat',
        p: "El Club fa el possible per garantir la disponibilitat i exactitud del lloc, però no es responsabilitza dels danys derivats d'errors tècnics, interrupcions del servei o continguts publicats per usuaris (resultats reportats per capitans). Els resultats es validen creuadament entre rivals (§25 de les bases) o per l'administració del torneig.",
      },
      {
        h: '6. Llei aplicable i jurisdicció',
        p: 'Aquest avís legal es regeix per la legislació espanyola. Per a qualsevol controvèrsia, les parts se sotmeten als jutjats i tribunals de la ciutat de Castelló de la Plana, llevat que la llei imposi un altre fur.',
      },
    ],
  },
  es: {
    title: 'Aviso legal',
    updated: 'Actualizado el 16 de mayo de 2026',
    sections: [
      {
        h: '1. Titular del sitio web',
        p: 'Este sitio web es titularidad de Club Pádel Les Coves de Vinromà (en adelante, "el Club"), con domicilio en Les Coves de Vinromà (Castellón) y correo electrónico de contacto clubpadelvinroma@gmail.com.',
      },
      {
        h: '2. Objeto',
        p: 'El sitio web tiene como finalidad la gestión y difusión pública del V Torneo de Pádel les Coves de Vinromà (edición 2026): inscripciones, calendario, clasificaciones, resultados y comunicaciones con los participantes.',
      },
      {
        h: '3. Condiciones de uso',
        p: 'El usuario se compromete a hacer un uso lícito del sitio, absteniéndose de introducir contenidos ofensivos, falsos, contrarios al RGPD o que infrinjan derechos de terceros. El Club se reserva el derecho a suspender el acceso a usuarios que infrinjan estas condiciones.',
      },
      {
        h: '4. Propiedad intelectual',
        p: 'Todos los contenidos del sitio (textos, logotipos, fotografías de las instalaciones, código fuente) son propiedad del Club o utilizados con licencia. Queda prohibida su reproducción total o parcial sin autorización expresa, salvo para uso personal no comercial.',
      },
      {
        h: '5. Responsabilidad',
        p: 'El Club hace lo posible para garantizar la disponibilidad y exactitud del sitio, pero no se responsabiliza de los daños derivados de errores técnicos, interrupciones del servicio o contenidos publicados por usuarios (resultados reportados por capitanes). Los resultados se validan cruzadamente entre rivales (§25 de las bases) o por la administración del torneo.',
      },
      {
        h: '6. Ley aplicable y jurisdicción',
        p: 'Este aviso legal se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de la ciudad de Castellón de la Plana, salvo que la ley imponga otro fuero.',
      },
    ],
  },
} as const;

export default async function LegalNoticePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = TEXTS[locale];

  return (
    <LegalPage locale={locale} title={data.title} updatedAt={data.updated}>
      {data.sections.map((s) => (
        <section key={s.h}>
          <h2 className="font-display text-xl font-semibold text-white">{s.h}</h2>
          <p className="mt-2 text-sm leading-relaxed">{s.p}</p>
        </section>
      ))}
    </LegalPage>
  );
}
