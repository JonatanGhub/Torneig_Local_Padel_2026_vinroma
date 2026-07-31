import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { KO_WEEK_DAYS } from '@/lib/scheduling/official-slots';

type Props = { params: Promise<{ locale: Locale }> };

type DayState = 'no' | 'ok' | 'prefer';

const STATE_BADGE: Record<DayState, string> = {
  no: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-300',
  ok: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  prefer: 'border-amber-400/60 bg-amber-400/10 text-amber-700 dark:text-amber-300',
};

const STATE_EMOJI: Record<DayState, string> = { no: '❌', ok: '👍', prefer: '⭐' };

export default async function PreferencesAdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();

  // Preferències + totes les parelles vives (per veure també qui NO ha
  // contestat encara). Consultes independents: es disparen alhora.
  const [{ data: prefs }, { data: pairs }, { data: categories }] = await Promise.all([
    supabase
      .from('knockout_schedule_preferences')
      .select('pair_id, day_prefs, note, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('pairs')
      .select('id, category_id, player_a_id, player_b_id, status')
      .eq('tournament_id', tournament?.id ?? '')
      .in('status', ['pending_payment', 'confirmed']),
    supabase
      .from('categories')
      .select('id, level, name_ca, name_es')
      .eq('tournament_id', tournament?.id ?? '')
      .order('level'),
  ]);

  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = playerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', playerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    return `${fullName(playerMap.get(pair.player_a_id))} / ${fullName(playerMap.get(pair.player_b_id))}`;
  };
  const categoryName = (categoryId: string | null) =>
    (categories ?? []).find((c) => c.id === categoryId)?.[
      locale === 'ca' ? 'name_ca' : 'name_es'
    ] ?? '—';

  const prefByPairId = new Map((prefs ?? []).map((p) => [p.pair_id, p]));
  const answered = (pairs ?? []).filter((p) => prefByPairId.has(p.id));
  const unanswered = (pairs ?? []).filter((p) => !prefByPairId.has(p.id));

  const dayFmt = new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: 'numeric',
  });
  const dayLabel = (iso: string) => dayFmt.format(new Date(`${iso}T12:00:00Z`));

  const updatedFmt = new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">{t('preferences_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('preferences_subtitle')}</p>
      </header>

      {answered.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('preferences_empty')}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
          {answered
            .sort((a, b) => categoryName(a.category_id).localeCompare(categoryName(b.category_id)))
            .map((pair) => {
              const pref = prefByPairId.get(pair.id)!;
              const dayPrefs =
                typeof pref.day_prefs === 'object' && pref.day_prefs !== null
                  ? (pref.day_prefs as Record<string, DayState>)
                  : {};
              return (
                <li key={pair.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{pairLabel(pair.id)}</p>
                    <p className="text-muted-foreground text-xs">
                      {categoryName(pair.category_id)} ·{' '}
                      {updatedFmt.format(new Date(pref.updated_at))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {KO_WEEK_DAYS.map((iso) => {
                      const state = dayPrefs[iso];
                      return (
                        <span
                          key={iso}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
                            state
                              ? STATE_BADGE[state]
                              : 'border-border text-muted-foreground bg-transparent'
                          }`}
                        >
                          {dayLabel(iso)}
                          {state ? ` ${STATE_EMOJI[state]}` : ''}
                        </span>
                      );
                    })}
                  </div>
                  {pref.note && <p className="text-muted-foreground text-sm">📝 {pref.note}</p>}
                </li>
              );
            })}
        </ul>
      )}

      {unanswered.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t('preferences_not_submitted')}</h2>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {unanswered
              .sort((a, b) =>
                categoryName(a.category_id).localeCompare(categoryName(b.category_id)),
              )
              .map((pair) => (
                <li key={pair.id}>
                  {pairLabel(pair.id)}{' '}
                  <span className="text-xs">· {categoryName(pair.category_id)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
