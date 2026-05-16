import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { LogoLockup } from '@/components/brand/logo-mark';
import { EntryForm } from './entry-form';
import { DeleteButton } from './delete-button';

type Props = { params: Promise<{ locale: Locale }> };

const euro = (cents: number, locale: string) =>
  new Intl.NumberFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);

export default async function FinancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('finance');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/captain/finance`);

  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!player) redirect(`/${locale}/captain`);

  // Parejas donde soy capitán
  const { data: myPairs } = await supabase
    .from('pairs')
    .select('id, category_id, player_a_id, player_b_id')
    .eq('captain_id', player.id);

  // Tomamos la primera (en este torneo cada player es captain de máx 1 pareja).
  const pair = myPairs?.[0];
  if (!pair) {
    return <EmptyFinanceLayout locale={locale} t={t} />;
  }

  // Pareja: nombres
  const { data: pairPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .in('id', [pair.player_a_id, pair.player_b_id]);
  const pairLabel = (pairPlayers ?? [])
    .map((p) => p.last_name ?? p.first_name ?? '')
    .filter(Boolean)
    .join(' / ');

  // Categoría
  const { data: cat } = pair.category_id
    ? await supabase
        .from('categories')
        .select('name_ca, name_es')
        .eq('id', pair.category_id)
        .maybeSingle()
    : { data: null };
  const categoryName = cat ? (locale === 'ca' ? cat.name_ca : cat.name_es) : null;

  // Entradas
  const { data: entries } = await supabase
    .from('pair_finance_entries')
    .select('id, kind, amount_cents, label, notes, occurred_on, created_at')
    .eq('pair_id', pair.id)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  const list = entries ?? [];
  const incomeCents = list
    .filter((e) => e.kind === 'income')
    .reduce((s, e) => s + e.amount_cents, 0);
  const expenseCents = list
    .filter((e) => e.kind === 'expense')
    .reduce((s, e) => s + e.amount_cents, 0);
  const balanceCents = incomeCents - expenseCents;

  return (
    <div className="bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />

      {/* Top bar */}
      <div className="bg-ink-950/85 sticky top-0 z-40 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <LogoLockup />
          <Link
            href={`/${locale}/captain`}
            className="inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {t('back_to_captain')}
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <p className="text-crimson-400 text-xs font-medium tracking-widest uppercase">
            {t('eyebrow')}
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-white/65">
            {pairLabel}
            {categoryName ? ` · ${categoryName}` : ''}
          </p>
        </header>

        {/* Balance */}
        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={<ArrowDownCircle className="size-5" />}
            label={t('summary_income')}
            value={euro(incomeCents, locale)}
            tone="emerald"
          />
          <SummaryCard
            icon={<ArrowUpCircle className="size-5" />}
            label={t('summary_expense')}
            value={euro(expenseCents, locale)}
            tone="crimson"
          />
          <SummaryCard
            icon={<Wallet className="size-5" />}
            label={t('summary_balance')}
            value={euro(balanceCents, locale)}
            tone={balanceCents < 0 ? 'crimson' : 'neutral'}
          />
        </section>

        {/* Add */}
        <div className="mb-6">
          <EntryForm pairId={pair.id} />
        </div>

        {/* List */}
        {list.length === 0 ? (
          <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
            <div className="bg-crimson-500/15 text-crimson-300 mb-3 inline-flex size-12 items-center justify-center rounded-2xl">
              <Wallet className="size-6" />
            </div>
            <p className="font-display text-lg font-semibold text-white">{t('empty_title')}</p>
            <p className="mt-1 max-w-sm text-sm text-white/55">{t('empty_body')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((e) => {
              const isIncome = e.kind === 'income';
              return (
                <li
                  key={e.id}
                  className="glass-card flex items-center justify-between gap-3 rounded-xl p-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        isIncome
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : 'bg-crimson-500/15 text-crimson-300'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownCircle className="size-4" />
                      ) : (
                        <ArrowUpCircle className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{e.label}</p>
                      <p className="text-xs text-white/55">
                        {new Date(e.occurred_on).toLocaleDateString(
                          locale === 'ca' ? 'ca-ES' : 'es-ES',
                          { day: 'numeric', month: 'short', year: 'numeric' },
                        )}
                        {e.notes ? ` · ${e.notes}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-sm font-semibold ${
                        isIncome ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {isIncome ? '+' : '−'}
                      {euro(e.amount_cents, locale)}
                    </span>
                    <DeleteButton entryId={e.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-8 text-xs text-white/45">{t('disclaimer')}</p>
      </main>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'emerald' | 'crimson' | 'neutral';
}) {
  const palette =
    tone === 'emerald'
      ? 'bg-emerald-400/10 text-emerald-300'
      : tone === 'crimson'
        ? 'bg-crimson-500/15 text-crimson-300'
        : 'bg-white/10 text-white';
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className={`mb-2 inline-flex size-9 items-center justify-center rounded-lg ${palette}`}>
        {icon}
      </div>
      <p className="text-[10px] tracking-widest text-white/55 uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyFinanceLayout({
  locale,
  t,
}: {
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="bg-ink-950 relative min-h-screen text-white">
      <div className="hero-gradient pointer-events-none absolute inset-0 -z-10" />
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <div className="glass-card w-full rounded-2xl p-8">
          <Wallet className="text-crimson-300 mx-auto size-8" />
          <h1 className="font-display mt-3 text-2xl font-semibold">{t('no_pair_title')}</h1>
          <p className="mt-2 text-sm text-white/65">{t('no_pair_body')}</p>
          <Link
            href={`/${locale}/captain`}
            className="bg-crimson-600 hover:bg-crimson-500 mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
          >
            <ArrowLeft className="size-4" />
            {t('back_to_captain')}
          </Link>
        </div>
      </main>
    </div>
  );
}
