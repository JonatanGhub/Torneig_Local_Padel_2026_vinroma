import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createPublicClient } from '@/lib/supabase/public';

type Props = { params: Promise<{ locale: Locale }> };

// Pàgina 100% pública: es cacheja 30s (ISR) perquè no calgui tornar a
// consultar Supabase a cada clic.
export const revalidate = 30;

export default async function BracketIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = createPublicClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  // `categories` i `koMatches` només depenen de tournament.id: es disparen
  // alhora.
  const [{ data: categories }, { data: koMatches }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, level, name_ca, name_es')
      .eq('tournament_id', tournament?.id ?? '')
      .order('level'),
    supabase
      .from('matches')
      .select('category_id, phase')
      .eq('tournament_id', tournament?.id ?? ''),
  ]);

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
              {/* Sempre es pot entrar: si el quadre real encara no existeix,
                  la pàgina de la categoria mostra la previsió (segons
                  classificacions actuals) amb l'horari fix de cada ronda. */}
              <Link
                href={`/${locale}/quadre/${c.level}`}
                className="border-border block rounded-md border p-4 transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <p className="text-lg font-semibold">{locale === 'ca' ? c.name_ca : c.name_es}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Trophy className="size-3" />
                  {drawn ? t('bracket.available') : t('bracket.preview_available')}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
