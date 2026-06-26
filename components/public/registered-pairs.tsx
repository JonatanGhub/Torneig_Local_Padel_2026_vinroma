import { Users } from 'lucide-react';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';

type Props = {
  locale: Locale;
  title: string;
  emptyLabel: string;
  pairsCountLabel: (count: number) => string;
};

export async function RegisteredPairs({ locale, title, emptyLabel, pairsCountLabel }: Props) {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('edition', 5)
    .maybeSingle();
  if (!tournament) return null;

  const { data: categories } = await supabase
    .from('categories')
    .select('id, level, name_ca, name_es')
    .eq('tournament_id', tournament.id)
    .order('level');

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, category_id, player_a_id, player_b_id, created_at, status')
    .eq('tournament_id', tournament.id)
    .in('status', ['pending_payment', 'confirmed'])
    .order('created_at', { ascending: true });

  const playerIds = Array.from(
    new Set((pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id])),
  );
  const { data: names } = playerIds.length
    ? await supabase
        .from('public_player_names')
        .select('id, first_name, last_name')
        .in('id', playerIds)
    : { data: [] };
  // Nom complet (nom + cognoms). Si falta alguna part, mostra el que hi hagi.
  const nameMap = new Map(
    (names ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—',
    ]),
  );

  const pairsByCategory = new Map<string, Array<{ id: string; label: string }>>();
  for (const p of pairs ?? []) {
    if (!p.category_id) continue;
    const arr = pairsByCategory.get(p.category_id) ?? [];
    arr.push({
      id: p.id,
      label: `${nameMap.get(p.player_a_id) ?? '—'} / ${nameMap.get(p.player_b_id) ?? '—'}`,
    });
    pairsByCategory.set(p.category_id, arr);
  }

  const totalPairs = (pairs ?? []).filter((p) => p.category_id).length;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75">
          <Users className="size-3.5" />
          {pairsCountLabel(totalPairs)}
        </span>
      </div>

      {totalPairs === 0 ? (
        <p className="text-sm text-white/55">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(categories ?? []).map((c) => {
            const list = pairsByCategory.get(c.id) ?? [];
            const catName = locale === 'ca' ? c.name_ca : c.name_es;
            return (
              <div
                key={c.id}
                className="glass-card hover:border-crimson-400/40 flex flex-col gap-3 rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-white">{catName}</h3>
                  <span className="bg-crimson-500/15 text-crimson-300 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    {pairsCountLabel(list.length)}
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="text-xs text-white/45">{emptyLabel}</p>
                ) : (
                  <ol className="space-y-1.5 text-sm text-white/80">
                    {list.map((pair, idx) => (
                      <li key={pair.id} className="flex gap-2">
                        <span className="w-5 shrink-0 text-right font-mono text-xs text-white/40">
                          {idx + 1}.
                        </span>
                        <span className="flex-1">{pair.label}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
