import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { WalkoverButton } from '../walkover-button';
import { AcceptReportButton } from '../accept-report-button';

type Props = { params: Promise<{ locale: Locale }> };

export default async function DisputesAdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createClient();

  const { data: matches } = await supabase
    .from('matches')
    .select('id, category_id, group_label, pair_a_id, pair_b_id, scheduled_at, court_label, status')
    .in('status', ['disputed', 'pending_validation'])
    .order('scheduled_at', { ascending: true });

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: reports } = matchIds.length
    ? await supabase
        .from('match_reports')
        .select('id, match_id, reporter_pair_side, score_json, reported_at')
        .in('match_id', matchIds)
    : { data: [] };

  const pairIds = (matches ?? []).flatMap((m) => [m.pair_a_id, m.pair_b_id]);
  const { data: pairs } = pairIds.length
    ? await supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
    : { data: [] };

  const playerIds = (pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]);
  const { data: players } = playerIds.length
    ? await supabase.from('players').select('id, first_name, last_name').in('id', playerIds)
    : { data: [] };
  const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);

  const pairLabel = (pairId: string) => {
    const pair = pairs?.find((p) => p.id === pairId);
    if (!pair) return '—';
    const a = playerMap.get(pair.player_a_id);
    const b = playerMap.get(pair.player_b_id);
    return `${fullName(a)} / ${fullName(b)}`;
  };

  function scoreToText(score: unknown) {
    if (!Array.isArray(score)) return '—';
    return score
      .map((s) =>
        typeof s === 'object' && s !== null && 'a' in s && 'b' in s
          ? `${(s as { a: number }).a}-${(s as { b: number }).b}`
          : '',
      )
      .filter(Boolean)
      .join(', ');
  }

  const disputed = (matches ?? []).filter((m) => m.status === 'disputed');
  const pending = (matches ?? []).filter((m) => m.status === 'pending_validation');

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">{t('disputes_title')}</h1>
        <p className="text-muted-foreground text-sm">{t('disputes_subtitle')}</p>
      </header>

      <DisputeBlock
        title={t('disputes_section_disputed')}
        emptyLabel={t('disputes_no_disputes')}
        matches={disputed}
        reports={reports ?? []}
        pairLabel={pairLabel}
        scoreToText={scoreToText}
        emphasizeDispute
      />

      <DisputeBlock
        title={t('disputes_section_pending')}
        emptyLabel={t('disputes_no_pending')}
        matches={pending}
        reports={reports ?? []}
        pairLabel={pairLabel}
        scoreToText={scoreToText}
      />
    </section>
  );
}

type MatchRow = {
  id: string;
  category_id: string;
  group_label: string | null;
  pair_a_id: string;
  pair_b_id: string;
  scheduled_at: string | null;
  court_label: string | null;
  status: 'scheduled' | 'pending_validation' | 'validated' | 'disputed' | 'walkover';
};

type ReportRow = {
  id: string;
  match_id: string;
  reporter_pair_side: 'a' | 'b' | 'admin';
  score_json: unknown;
  reported_at: string;
};

function DisputeBlock({
  title,
  emptyLabel,
  matches,
  reports,
  pairLabel,
  scoreToText,
  emphasizeDispute = false,
}: {
  title: string;
  emptyLabel: string;
  matches: MatchRow[];
  reports: ReportRow[];
  pairLabel: (pairId: string) => string;
  scoreToText: (score: unknown) => string;
  emphasizeDispute?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
          {matches.map((m) => {
            const matchReports = reports.filter((r) => r.match_id === m.id);
            const reportA = matchReports.find((r) => r.reporter_pair_side === 'a');
            const reportB = matchReports.find((r) => r.reporter_pair_side === 'b');
            return (
              <li key={m.id} className={emphasizeDispute ? 'bg-destructive/5 p-4' : 'p-4'}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {pairLabel(m.pair_a_id)} <span className="text-muted-foreground">vs</span>{' '}
                      {pairLabel(m.pair_b_id)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {m.group_label ? `Grup ${m.group_label} · ` : ''}
                      {m.scheduled_at
                        ? new Date(m.scheduled_at).toLocaleString('ca-ES')
                        : '—'} · {m.court_label ?? '—'}
                    </p>
                  </div>
                  {/* Botons per acceptar el resultat d'un dels capitans */}
                  <div className="flex flex-wrap gap-1.5">
                    {reportA && <AcceptReportButton matchId={m.id} side="a" label={`Acceptar A`} />}
                    {reportB && <AcceptReportButton matchId={m.id} side="b" label={`Acceptar B`} />}
                  </div>
                </div>
                {(reportA || reportB) && (
                  <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-2 text-xs">
                    <ScoreCell label="A" report={reportA} score={scoreToText} />
                    <ScoreCell label="B" report={reportB} score={scoreToText} />
                  </div>
                )}
                {emphasizeDispute && (
                  <div className="mt-2">
                    <WalkoverButton
                      matchId={m.id}
                      pairAId={m.pair_a_id}
                      pairBId={m.pair_b_id}
                      pairALabel={pairLabel(m.pair_a_id)}
                      pairBLabel={pairLabel(m.pair_b_id)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScoreCell({
  label,
  report,
  score,
}: {
  label: string;
  report: ReportRow | undefined;
  score: (s: unknown) => string;
}) {
  return (
    <div className="bg-card rounded-md p-2">
      <p className="text-muted-foreground/80 text-[10px] tracking-wider uppercase">
        Capità {label}
      </p>
      <p className="font-mono">{report ? score(report.score_json) : '—'}</p>
    </div>
  );
}
