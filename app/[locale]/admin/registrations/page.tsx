import Link from 'next/link';
import { Plus } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { AdminWithdrawButton } from './withdraw-button';
import { AdminResendEmailButton } from './resend-email-button';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string; q?: string; category?: string; email?: string }>;
};

const VALID_PAIR_STATUSES = [
  'pending_payment',
  'confirmed',
  'withdrawn',
  'disqualified',
  'draft',
] as const;
type PairStatus = (typeof VALID_PAIR_STATUSES)[number];

function asStatus(value: string | undefined): PairStatus | 'all' {
  if (!value) return 'all';
  if ((VALID_PAIR_STATUSES as readonly string[]).includes(value)) return value as PairStatus;
  return 'all';
}

export default async function RegistrationsAdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const status = asStatus(sp.status);
  const search = (sp.q ?? '').trim().toLowerCase();
  const categoryFilter = (sp.category ?? '').trim();
  const emailFeedback = (sp.email ?? '').trim();
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();

  let pairsQuery = supabase
    .from('pairs')
    .select(
      'id, status, fee_mode_chosen, created_at, category_id, player_a_id, player_b_id, captain_id, group_id, withdrawn_at, withdrawal_reason',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') {
    pairsQuery = pairsQuery.eq('status', status);
  }
  if (categoryFilter) {
    pairsQuery = pairsQuery.eq('category_id', categoryFilter);
  }

  const { data: pairs } = await pairsQuery;

  const playerIds = Array.from(
    new Set((pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id, p.captain_id])),
  );

  const categoryIds = Array.from(new Set((pairs ?? []).map((p) => p.category_id).filter(Boolean)));

  const [{ data: players }, { data: categories }, { data: allCategories }] = await Promise.all([
    playerIds.length
      ? supabase
          .from('players')
          .select(
            'id, first_name, last_name, email, phone, birth_date, declared_level, tshirt_size, emergency_contact_name, emergency_contact_phone, consent_whatsapp, auth_user_id',
          )
          .in('id', playerIds)
      : Promise.resolve({ data: [] }),
    categoryIds.length
      ? supabase
          .from('categories')
          .select('id, level, name_ca, name_es')
          .in('id', categoryIds as string[])
      : Promise.resolve({ data: [] }),
    supabase.from('categories').select('id, level, name_ca, name_es').order('level'),
  ]);

  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);
  const categoryMap = new Map(categories?.map((c) => [c.id, c]) ?? []);

  const filtered = (pairs ?? []).filter((p) => {
    if (!search) return true;
    const a = playerMap.get(p.player_a_id);
    const b = playerMap.get(p.player_b_id);
    const hay = [a?.first_name, a?.last_name, a?.email, b?.first_name, b?.last_name, b?.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(search);
  });

  // Detecció de duplicats: una mateixa persona (per correu) que apareix en més
  // d'una parella ACTIVA (no retirada/desqualificada) dins de la MATEIXA
  // categoria. No bloqueja res; només avisa l'organització.
  const activePairs = (pairs ?? []).filter(
    (p) => p.status !== 'withdrawn' && p.status !== 'disqualified',
  );
  const emailCategoryCount = new Map<string, { count: number; email: string; category: string }>();
  for (const p of activePairs) {
    if (!p.category_id) continue;
    const catName =
      (locale === 'ca'
        ? categoryMap.get(p.category_id)?.name_ca
        : categoryMap.get(p.category_id)?.name_es) ?? '';
    for (const pid of [p.player_a_id, p.player_b_id]) {
      const email = playerMap.get(pid)?.email?.toLowerCase();
      if (!email) continue;
      const key = `${email}|${p.category_id}`;
      const prev = emailCategoryCount.get(key);
      emailCategoryCount.set(key, {
        count: (prev?.count ?? 0) + 1,
        email,
        category: catName,
      });
    }
  }
  const duplicates = Array.from(emailCategoryCount.values()).filter((d) => d.count > 1);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('registrations_title')}</h1>
          <p className="text-muted-foreground text-sm">{t('registrations_subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/admin/registrations/new`}
          className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))]"
        >
          <Plus className="size-4" />
          {t('registrations_new_cta')}
        </Link>
      </header>

      <form className="flex flex-wrap gap-3" action="">
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-sm"
        >
          <option value="all">{t('registrations_filter_all')}</option>
          <option value="pending_payment">{t('pair_status_pending_payment')}</option>
          <option value="confirmed">{t('pair_status_confirmed')}</option>
          <option value="withdrawn">{t('pair_status_withdrawn')}</option>
          <option value="disqualified">{t('pair_status_disqualified')}</option>
          <option value="draft">{t('pair_status_draft')}</option>
        </select>
        <select
          name="category"
          defaultValue={categoryFilter}
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-sm"
        >
          <option value="">{t('registrations_filter_all_categories')}</option>
          {(allCategories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {locale === 'ca' ? c.name_ca : c.name_es}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder={t('registrations_search_placeholder')}
          className="min-w-[200px] flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--accent))]"
        >
          {t('registrations_filter_apply')}
        </button>
      </form>

      {emailFeedback && (
        <EmailFeedbackBanner
          feedback={emailFeedback}
          label={emailFeedbackLabel(emailFeedback, t)}
        />
      )}

      {duplicates.length > 0 && (
        <div className="rounded-md border border-amber-400/60 bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold">{t('registrations_duplicate_warning_title')}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {duplicates.map((d) => (
              <li key={`${d.email}-${d.category}`}>
                {t('registrations_duplicate_warning_item', {
                  email: d.email,
                  category: d.category,
                  count: d.count,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {t('registrations_count', { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('registrations_empty')}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
          {filtered.map((p) => {
            const a = playerMap.get(p.player_a_id);
            const b = playerMap.get(p.player_b_id);
            const category = p.category_id ? categoryMap.get(p.category_id) : null;
            const captainSide = p.captain_id === p.player_a_id ? 'a' : 'b';
            return (
              <li key={p.id} className="p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {formatPlayer(a)} <span className="text-muted-foreground">·</span>{' '}
                      {formatPlayer(b)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {category
                        ? `${locale === 'ca' ? category.name_ca : category.name_es} · `
                        : ''}
                      {t('registrations_captain_short', { side: captainSide.toUpperCase() })}
                      {' · '}
                      {p.fee_mode_chosen === 'per_pair'
                        ? t('registrations_fee_per_pair')
                        : t('registrations_fee_per_player')}
                    </p>
                    {p.withdrawn_at && p.withdrawal_reason && (
                      <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
                        {t('registrations_withdrawn_label')}: {p.withdrawal_reason}
                      </p>
                    )}
                    <details className="mt-2 text-xs">
                      <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                        {t('registrations_detail_toggle')}
                      </summary>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <PlayerDetail label={t('registrations_player_a')} player={a} t={t} />
                        <PlayerDetail label={t('registrations_player_b')} player={b} t={t} />
                      </div>
                    </details>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <PairStatusPill status={p.status} t={t} />
                    <CaptainLinkedPill
                      linked={Boolean(playerMap.get(p.captain_id)?.auth_user_id)}
                      t={t}
                    />
                    {p.status === 'pending_payment' && (
                      <AdminResendEmailButton pairId={p.id} locale={locale} />
                    )}
                    {(p.status === 'pending_payment' || p.status === 'confirmed') && (
                      <AdminWithdrawButton
                        pairId={p.id}
                        locale={locale}
                        pairLabel={`${formatPlayer(a)} / ${formatPlayer(b)}`}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PlayerDetail({
  label,
  player,
  t,
}: {
  label: string;
  player:
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone?: string | null;
        birth_date?: string | null;
        declared_level?: number | null;
        tshirt_size?: string | null;
        emergency_contact_name?: string | null;
        emergency_contact_phone?: string | null;
        consent_whatsapp?: boolean | null;
      }
    | undefined;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
}) {
  if (!player) return null;
  const row = (k: string, v: string | null | undefined) =>
    v ? (
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">{k}</span>
        <span className="text-right font-medium">{v}</span>
      </div>
    ) : null;
  return (
    <div className="border-border space-y-1 rounded-md border p-2">
      <p className="font-semibold">{label}</p>
      {row(t('registrations_detail_email'), player.email)}
      {row(t('registrations_detail_phone'), player.phone)}
      {row(t('registrations_detail_birth'), player.birth_date)}
      {row(
        t('registrations_detail_level'),
        player.declared_level ? `${player.declared_level}ª` : null,
      )}
      {row(t('registrations_detail_tshirt'), player.tshirt_size)}
      {row(t('registrations_detail_emergency'), player.emergency_contact_name)}
      {row(t('registrations_detail_emergency_phone'), player.emergency_contact_phone)}
      {row(
        t('registrations_detail_whatsapp'),
        player.consent_whatsapp ? t('registrations_detail_yes') : t('registrations_detail_no'),
      )}
    </div>
  );
}

function formatPlayer(p: { first_name: string | null; last_name: string | null } | undefined) {
  if (!p) return '—';
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—';
}

function emailFeedbackLabel(
  feedback: string,
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>,
) {
  if (feedback === 'sent') return t('registrations_email_sent');
  if (feedback === 'error_captain_email_missing')
    return t('registrations_email_error_captain_email_missing');
  if (feedback === 'error_send_failed') return t('registrations_email_error_send_failed');
  return null;
}

function EmailFeedbackBanner({ feedback, label }: { feedback: string; label: string | null }) {
  if (!label) return null;
  const isSuccess = feedback === 'sent';
  const tone = isSuccess
    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
    : 'border-amber-400/60 bg-amber-400/10 text-amber-700 dark:text-amber-300';
  return <div className={`rounded-md border px-3 py-2 text-xs ${tone}`}>{label}</div>;
}

function CaptainLinkedPill({
  linked,
  t,
}: {
  linked: boolean;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
}) {
  const tone = linked
    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
    : 'border-slate-400/60 bg-slate-400/10 text-slate-700 dark:text-slate-300';
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${tone}`}
      title={
        linked ? t('registrations_captain_linked_help') : t('registrations_captain_unlinked_help')
      }
    >
      {linked ? t('registrations_captain_linked') : t('registrations_captain_unlinked')}
    </span>
  );
}

function PairStatusPill({
  status,
  t,
}: {
  status: string;
  t: Awaited<ReturnType<typeof getTranslations<'admin'>>>;
}) {
  const tone =
    status === 'confirmed'
      ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
      : status === 'pending_payment'
        ? 'border-amber-400/60 bg-amber-400/10 text-amber-700 dark:text-amber-300'
        : status === 'withdrawn'
          ? 'border-orange-400/60 bg-orange-400/10 text-orange-700 dark:text-orange-300'
          : status === 'disqualified'
            ? 'border-red-400/60 bg-red-400/10 text-red-700 dark:text-red-300'
            : 'border-[hsl(var(--border))] text-muted-foreground';
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${tone}`}>
      {t(`pair_status_${status}` as 'pair_status_confirmed')}
    </span>
  );
}
