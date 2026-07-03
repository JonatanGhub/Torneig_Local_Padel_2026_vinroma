import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createPublicClient } from '@/lib/supabase/public';

type Props = { params: Promise<{ locale: Locale }> };

// Pàgina 100% pública: es cacheja 30s (ISR) perquè no calgui tornar a
// consultar Supabase a cada clic.
export const revalidate = 30;

export default async function GroupsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = createPublicClient();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  // `categories` i `groups` només depenen de tournament.id: es disparen alhora.
  const [{ data: categories }, { data: groups }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, level, name_ca, name_es')
      .eq('tournament_id', tournament?.id ?? '')
      .order('level'),
    supabase
      .from('groups')
      .select('id, category_id, label')
      .eq('tournament_id', tournament?.id ?? ''),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <Link
        href={`/${locale}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('groups.title')}</h1>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(categories ?? []).map((c) => {
          const catGroups = (groups ?? []).filter((g) => g.category_id === c.id);
          const drawn = catGroups.length > 0;
          return (
            <li key={c.id}>
              <Link
                href={drawn ? `/${locale}/grups/${c.level}` : `/${locale}`}
                aria-disabled={!drawn}
                className={`border-border block rounded-md border p-4 transition-colors ${drawn ? 'hover:bg-[hsl(var(--accent))]' : 'pointer-events-none opacity-50'}`}
              >
                <p className="text-lg font-semibold">{locale === 'ca' ? c.name_ca : c.name_es}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Users className="size-3" />
                  {drawn
                    ? t('groups.groups_count', { count: catGroups.length })
                    : t('groups.not_drawn')}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
