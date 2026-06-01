import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { formatMatchTime, madridDateKey } from '@/lib/format-date';

type Props = { params: Promise<{ locale: Locale }> };

export default async function CalendariPage({ params }: Props) {
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
    .eq('tournament_id', tournament?.id ?? '');
  const categoriesById = new Map(
    (categories ?? []).map((c) => [c.id, locale === 'ca' ? c.name_ca : c.name_es]),
  );

  const { data: matches } = await supabase
    .from('matches')
    .select('id, category_id, group_label, scheduled_at, court_label, pair_a_id, pair_b_id, status')
    .eq('tournament_id', tournament?.id ?? '')
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true });

  const pairIds = (matches ?? []).flatMap((m) => [m.pair_a_id, m.pair_b_id]);
  const { data: pairs } = pairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
    : { data: [] };
  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = playerIds.length
    ? await supabase.from('public_player_names').select('id, last_name').in('id', playerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${a?.last_name ?? '—'} / ${b?.last_name ?? '—'}`;
  };

  // Agrupem per dia en hora de Madrid (no UTC), si no els partits de nit poden
  // caure al dia equivocat.
  const byDay = new Map<string, typeof matches>();
  for (const m of matches ?? []) {
    if (!m.scheduled_at) continue;
    const day = madridDateKey(m.scheduled_at);
    const list = byDay.get(day) ?? [];
    list.push(m);
    byDay.set(day, list);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <Link
        href={`/${locale}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('calendar.title')}</h1>

      {(!matches || matches.length === 0) && (
        <p className="text-muted-foreground text-sm">{t('calendar.empty')}</p>
      )}

      {Array.from(byDay.entries()).map(([day, dayMatches]) => (
        <section key={day} className="mb-8">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium tracking-wider uppercase">
            {new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
              timeZone: 'Europe/Madrid',
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h2>
          <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
            {(dayMatches ?? []).map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-1 p-3 text-sm md:flex-row md:items-center md:justify-between"
              >
                <span className="text-muted-foreground font-mono text-xs">
                  {formatMatchTime(m.scheduled_at, locale)} · {m.court_label ?? '—'}
                </span>
                <span>
                  {pairLabel(m.pair_a_id)} vs {pairLabel(m.pair_b_id)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {categoriesById.get(m.category_id) ?? ''}{' '}
                  {m.group_label ? `· ${m.group_label}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
