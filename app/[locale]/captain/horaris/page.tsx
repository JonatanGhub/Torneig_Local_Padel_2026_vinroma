import { CalendarClock } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createServiceClient } from '@/lib/supabase/service';
import { loadCaptainContext } from '@/lib/captain/data';
import { KO_WEEK_DAYS } from '@/lib/scheduling/official-slots';
import { NoProfilePanel } from '../no-profile-panel';
import { PreferenceForm, type DayState } from './preference-form';

type Props = { params: Promise<{ locale: Locale }> };

export default async function CaptainSchedulePrefsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const ctx = await loadCaptainContext(locale);
  if (!ctx.player) return <NoProfilePanel locale={locale} />;

  const { myPairs, categoryLabels, partnerLabels } = ctx;
  // Només parelles vives del torneig (les retirades/desqualificades no
  // juguen l'eliminatòria).
  const activePairs = myPairs.filter(
    (p) => p.status === 'confirmed' || p.status === 'pending_payment',
  );

  // Preferències ja desades (lectura amb service client: la RLS d'aquesta
  // taula només contempla l'admin; aquí ja hem validat la identitat del
  // capità via loadCaptainContext).
  const service = createServiceClient();
  const { data: existing } = activePairs.length
    ? await service
        .from('knockout_schedule_preferences')
        .select('pair_id, day_prefs, note')
        .in(
          'pair_id',
          activePairs.map((p) => p.id),
        )
    : { data: [] };

  const dayFormatter = new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const days = KO_WEEK_DAYS.map((iso) => ({
    iso,
    label: dayFormatter.format(new Date(`${iso}T12:00:00Z`)),
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
          {t('captain.tab_schedule_prefs')}
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {t('captain.prefs_title')}
        </h1>
        <p className="mt-2 text-sm text-white/65">{t('captain.prefs_subtitle')}</p>
        <p className="mt-2 text-xs text-white/45">{t('captain.prefs_legend')}</p>
      </header>

      {activePairs.length === 0 ? (
        <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
          <div className="bg-crimson-500/15 text-crimson-300 mb-4 inline-flex size-12 items-center justify-center rounded-2xl">
            <CalendarClock className="size-6" />
          </div>
          <p className="font-display text-lg font-semibold text-white">{t('captain.no_matches')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activePairs.map((pair) => {
            const saved = (existing ?? []).find((e) => e.pair_id === pair.id);
            const savedPrefs =
              saved && typeof saved.day_prefs === 'object' && saved.day_prefs !== null
                ? (saved.day_prefs as Record<string, DayState>)
                : {};
            const title = `${pair.category_id ? (categoryLabels.get(pair.category_id) ?? '') : ''} · ${partnerLabels.get(pair.id) ?? '—'}`;
            return (
              <PreferenceForm
                key={pair.id}
                pairId={pair.id}
                pairTitle={title}
                days={days}
                initialPrefs={savedPrefs}
                initialNote={saved?.note ?? null}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
