import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { EditRegistrationForm, type PlayerInitial } from './edit-form';

type Props = { params: Promise<{ locale: Locale; pairId: string }> };

export default async function EditRegistrationPage({ params }: Props) {
  const { locale, pairId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const { data: pair } = await supabase
    .from('pairs')
    .select(
      'id, category_id, captain_id, player_a_id, player_b_id, group_id, tournament_id, fee_mode_chosen, status',
    )
    .eq('id', pairId)
    .maybeSingle();
  if (!pair) notFound();

  const [{ data: players }, { data: categories }, { count: matchesCount }] = await Promise.all([
    supabase
      .from('players')
      .select(
        'id, first_name, last_name, email, phone, birth_date, declared_level, tshirt_size, emergency_contact_name, emergency_contact_phone, consent_whatsapp',
      )
      .in('id', [pair.player_a_id, pair.player_b_id]),
    supabase
      .from('categories')
      .select('id, level, name_ca, name_es')
      .eq('tournament_id', pair.tournament_id)
      .order('level'),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`pair_a_id.eq.${pair.id},pair_b_id.eq.${pair.id}`),
  ]);

  const a = (players ?? []).find((p) => p.id === pair.player_a_id);
  const b = (players ?? []).find((p) => p.id === pair.player_b_id);
  if (!a || !b) notFound();

  const captainSide = pair.captain_id === pair.player_a_id ? 'a' : 'b';
  const categoryLocked = Boolean(pair.group_id) || (matchesCount ?? 0) > 0;
  const categoryLockedReason: 'draw' | 'matches' | null = pair.group_id
    ? 'draw'
    : (matchesCount ?? 0) > 0
      ? 'matches'
      : null;

  const initialA: PlayerInitial = {
    id: a.id,
    first_name: a.first_name ?? '',
    last_name: a.last_name ?? '',
    email: a.email ?? '',
    phone: a.phone ?? '',
    birth_date: a.birth_date ?? '',
    tshirt_size: (a.tshirt_size as PlayerInitial['tshirt_size']) ?? '',
    emergency_contact_name: a.emergency_contact_name ?? '',
    emergency_contact_phone: a.emergency_contact_phone ?? '',
    consent_whatsapp: Boolean(a.consent_whatsapp),
  };
  const initialB: PlayerInitial = {
    id: b.id,
    first_name: b.first_name ?? '',
    last_name: b.last_name ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
    birth_date: b.birth_date ?? '',
    tshirt_size: (b.tshirt_size as PlayerInitial['tshirt_size']) ?? '',
    emergency_contact_name: b.emergency_contact_name ?? '',
    emergency_contact_phone: b.emergency_contact_phone ?? '',
    consent_whatsapp: Boolean(b.consent_whatsapp),
  };

  const cats = (categories ?? []).map((c) => ({
    id: c.id,
    label: locale === 'ca' ? c.name_ca : c.name_es,
  }));

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <Link
            href={`/${locale}/admin/registrations`}
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> {t('registrations_back')}
          </Link>
          <h1 className="text-2xl font-bold">{t('registrations_edit_title')}</h1>
          <p className="text-muted-foreground text-sm">{t('registrations_edit_subtitle')}</p>
        </div>
      </header>

      <EditRegistrationForm
        pairId={pair.id}
        categoryId={pair.category_id ?? cats[0]?.id ?? ''}
        captainSide={captainSide}
        locale={locale}
        categories={cats}
        categoryLocked={categoryLocked}
        categoryLockedReason={categoryLockedReason}
        playerA={initialA}
        playerB={initialB}
      />
    </section>
  );
}
