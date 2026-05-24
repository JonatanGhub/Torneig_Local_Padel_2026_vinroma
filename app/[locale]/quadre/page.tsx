import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: Locale }> };

export default async function BracketIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, level, name_ca, name_es')
    .eq('tournament_id', tournament?.id ?? '')
    .order('level');

  const { data: koMatches } = await supabase
    .from('matches')
    .select('category_id, phase')
    .eq('tournament_id', tournament?.id ?? '');

  const hasBracket = (categoryId: string) =>
    (koMatches ?? []).some(
      (m) =>
        m.category_id === categoryId && (m.phase.startsWith('ko_') || m.phase.startsWith('cons_')),
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <Link
        href={`/${locale}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('bracket.title')}</h1>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(categories ?? []).map((c) => {
          const drawn = hasBracket(c.id);
          return (
            <li key={c.id}>
              <Link
                href={drawn ? `/${locale}/quadre/${c.level}` : `/${locale}`}
                aria-disabled={!drawn}
                className={`border-border block rounded-md border p-4 transition-colors ${drawn ? 'hover:bg-[hsl(var(--accent))]' : 'pointer-events-none opacity-50'}`}
              >
                <p className="text-lg font-semibold">{locale === 'ca' ? c.name_ca : c.name_es}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Trophy className="size-3" />
                  {drawn ? t('bracket.available') : t('bracket.not_generated')}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
