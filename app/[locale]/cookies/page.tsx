import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { LegalPage } from '@/components/legal/legal-page';

type Props = { params: Promise<{ locale: Locale }> };

const TEXTS = {
  ca: {
    title: 'Política de cookies',
    updated: 'Actualitzada el 16 de maig de 2026',
    intro:
      "Aquesta web utilitza únicament cookies tècniques (essencials) i, opcionalment, cookies d'analítica només si hi consents expressament al banner.",
    sections: [
      {
        h: 'Cookies essencials',
        p: "Necessàries per al funcionament del lloc: gestió de la sessió d'autenticació (Supabase), preferència d'idioma (NEXT_LOCALE) i memòria del teu consentiment cookies (cookie-consent-v1, localStorage). No es poden desactivar perquè el lloc no funcionaria.",
        items: [
          {
            name: 'sb-access-token / sb-refresh-token',
            purpose: "Sessió d'autenticació",
            origin: 'Supabase',
            duration: '1 hora / 1 setmana',
          },
          {
            name: 'NEXT_LOCALE',
            purpose: 'Idioma preferit',
            origin: 'next-intl',
            duration: '1 any',
          },
          {
            name: 'cookie-consent-v1',
            purpose: 'El teu consentiment a aquesta política',
            origin: 'Propi (localStorage)',
            duration: 'Fins que el retiris',
          },
        ],
      },
      {
        h: "Cookies d'analítica (opcional)",
        p: "Si acceptes al banner, activem mètriques bàsiques de visites sense identificar-te (només estadístiques agregades). De moment no n'utilitzem cap. Si en el futur n'afegim, actualitzarem aquesta llista i et tornarem a demanar consentiment.",
        items: [],
      },
      {
        h: 'Com retirar el consentiment',
        p: "Pots retirar el teu consentiment en qualsevol moment esborrant l'entrada `cookie-consent-v1` del localStorage del teu navegador. La propera visita et tornarem a mostrar el banner.",
        items: [],
      },
    ],
  },
  es: {
    title: 'Política de cookies',
    updated: 'Actualizada el 16 de mayo de 2026',
    intro:
      'Esta web utiliza únicamente cookies técnicas (esenciales) y, opcionalmente, cookies de analítica solo si lo consientes expresamente en el banner.',
    sections: [
      {
        h: 'Cookies esenciales',
        p: 'Necesarias para el funcionamiento del sitio: gestión de la sesión de autenticación (Supabase), preferencia de idioma (NEXT_LOCALE) y memoria de tu consentimiento cookies (cookie-consent-v1, localStorage). No se pueden desactivar porque el sitio no funcionaría.',
        items: [
          {
            name: 'sb-access-token / sb-refresh-token',
            purpose: 'Sesión de autenticación',
            origin: 'Supabase',
            duration: '1 hora / 1 semana',
          },
          {
            name: 'NEXT_LOCALE',
            purpose: 'Idioma preferido',
            origin: 'next-intl',
            duration: '1 año',
          },
          {
            name: 'cookie-consent-v1',
            purpose: 'Tu consentimiento a esta política',
            origin: 'Propio (localStorage)',
            duration: 'Hasta que lo retires',
          },
        ],
      },
      {
        h: 'Cookies de analítica (opcional)',
        p: 'Si aceptas en el banner, activamos métricas básicas de visitas sin identificarte (solo estadísticas agregadas). De momento no usamos ninguna. Si en el futuro añadimos, actualizaremos esta lista y volveremos a pedir consentimiento.',
        items: [],
      },
      {
        h: 'Cómo retirar el consentimiento',
        p: 'Puedes retirar tu consentimiento en cualquier momento borrando la entrada `cookie-consent-v1` del localStorage de tu navegador. En la próxima visita te volveremos a mostrar el banner.',
        items: [],
      },
    ],
  },
} as const;

export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = TEXTS[locale];

  return (
    <LegalPage locale={locale} title={data.title} updatedAt={data.updated}>
      <p className="text-sm leading-relaxed">{data.intro}</p>
      {data.sections.map((s) => (
        <section key={s.h}>
          <h2 className="font-display text-xl font-semibold text-white">{s.h}</h2>
          <p className="mt-2 text-sm leading-relaxed">{s.p}</p>
          {s.items.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-white/55">
                  <tr>
                    <th className="py-2 pr-3">Nom</th>
                    <th className="py-2 pr-3">{locale === 'ca' ? 'Finalitat' : 'Finalidad'}</th>
                    <th className="py-2 pr-3">{locale === 'ca' ? 'Origen' : 'Origen'}</th>
                    <th className="py-2">{locale === 'ca' ? 'Durada' : 'Duración'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {s.items.map((it) => (
                    <tr key={it.name}>
                      <td className="py-2 pr-3 font-mono">{it.name}</td>
                      <td className="py-2 pr-3">{it.purpose}</td>
                      <td className="py-2 pr-3">{it.origin}</td>
                      <td className="py-2">{it.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </LegalPage>
  );
}
