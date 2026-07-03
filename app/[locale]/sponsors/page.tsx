import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Plus } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createPublicClient } from '@/lib/supabase/public';
import { LogoLockup } from '@/components/brand/logo-mark';

type Props = { params: Promise<{ locale: Locale }> };

const TIER_ORDER: Array<'gold' | 'silver' | 'bronze' | 'collaborator'> = [
  'gold',
  'silver',
  'bronze',
  'collaborator',
];

// Pàgina 100% pública i que gairebé no canvia: es cacheja 30s (ISR) perquè
// no calgui tornar a consultar Supabase a cada clic.
export const revalidate = 30;

export default async function SponsorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sponsors');

  const supabase = createPublicClient();
  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('id, name, logo_url, website_url, tier, display_order, role_ca, role_es')
    .eq('is_active', true)
    .order('tier', { ascending: true })
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  const byTier = new Map<string, NonNullable<typeof sponsors>>();
  for (const s of sponsors ?? []) {
    const arr = byTier.get(s.tier) ?? [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }

  return (
    <div className="dark bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      <div className="bg-ink-950/85 sticky top-0 z-40 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <LogoLockup />
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {t('back')}
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-12 text-center">
          <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
            {t('eyebrow')}
          </p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight md:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-balance text-white/65">{t('subtitle')}</p>
        </header>

        {(!sponsors || sponsors.length === 0) && (
          <div className="glass-card mx-auto max-w-md rounded-2xl p-8 text-center">
            <p className="font-display text-lg font-semibold">{t('empty_title')}</p>
            <p className="mt-1 text-sm text-white/55">{t('empty_body')}</p>
          </div>
        )}

        {TIER_ORDER.map((tier) => {
          const list = byTier.get(tier);
          if (!list?.length) return null;
          return (
            <section key={tier} className="mb-12">
              <h2 className="font-display text-crimson-400 mb-6 text-center text-sm font-medium tracking-widest uppercase">
                {t(`tier_${tier}` as 'tier_gold')}
              </h2>
              {/*
                Servim les targetes amb flex+wrap+justify-center perquè, si en
                un tier hi ha menys patrocinadors que columnes, quedin
                centrades horitzontalment (un grid les deixaria a l'esquerra).
              */}
              <ul className="flex flex-wrap justify-center gap-5">
                {list.map((s) => {
                  const role = locale === 'ca' ? s.role_ca : s.role_es;
                  return (
                    <li key={s.id} className={`flex flex-col items-center ${tierCardWidth(tier)}`}>
                      {s.website_url ? (
                        <a
                          href={s.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-card hover:border-crimson-400/40 group flex aspect-square w-full items-center justify-center rounded-2xl p-3 transition-colors"
                        >
                          <SponsorLogo src={s.logo_url} alt={s.name} />
                          <span className="sr-only">
                            {s.name} <ExternalLink className="ml-1 inline size-3" />
                          </span>
                        </a>
                      ) : (
                        <div className="glass-card flex aspect-square w-full items-center justify-center rounded-2xl p-3">
                          <SponsorLogo src={s.logo_url} alt={s.name} />
                        </div>
                      )}
                      <div className="mt-2 text-center">
                        <p className="text-sm font-medium text-white/90">{s.name}</p>
                        {role && <p className="text-crimson-300 text-xs">{role}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <section className="mt-16 text-center">
          <h2 className="font-display text-xl font-semibold">{t('propose_title')}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm text-white/65">
            {t('propose_body')}
          </p>
          <Link
            href={`/${locale}/sponsors/proposar`}
            className="bg-crimson-600 hover:bg-crimson-500 mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <Plus className="size-4" />
            {t('propose_cta')}
          </Link>
        </section>
      </main>
    </div>
  );
}

function tierCardWidth(tier: string): string {
  // Amplada de la targeta segons importància del tier. La targeta és quadrada,
  // així que l'amplada determina el tamany del logo.
  if (tier === 'gold') return 'w-56 sm:w-64';
  if (tier === 'silver') return 'w-44 sm:w-52';
  if (tier === 'bronze') return 'w-36 sm:w-44';
  return 'w-32 sm:w-40';
}

function SponsorLogo({ src, alt }: { src: string; alt: string }) {
  // Logos externos: usar <img> normal para no requerir whitelist de dominios
  // en next.config. La página es liviana porque hay pocos sponsors.
  // El logo ocupa todo el cuadrado (object-contain mantiene la proporción y lo
  // centra) para que se vea lo más grande posible dentro de la tarjeta.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-full w-full rounded-lg object-contain opacity-90 transition-opacity group-hover:opacity-100"
    />
  );
}

// Mantener Image import por si lo necesitamos en el futuro (next/image con
// remotePatterns en next.config).
void Image;
