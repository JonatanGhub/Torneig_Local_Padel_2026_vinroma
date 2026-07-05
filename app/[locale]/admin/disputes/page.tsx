import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { fullName } from '@/lib/player-name';
import { WalkoverButton } from '../walkover-button';
import { AcceptReportButton } from '../accept-report-button';
import { EditScoreButton } from '../edit-score-button';

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
  const pairIds = (matches ?? []).flatMap((m) => [m.pair_a_id, m.pair_b_id]);
  // `reports` i `pairs` només depenen de `matches`: es disparen alhora.
  const [{ data: reports }, { data: pairs }] = await Promise.all([
    matchIds.length
      ? supabase
          .from('match_reports')
          .select('id, match_id, reporter_pair_side, score_json, reported_at')
          .in('match_id', matchIds)
      : Promise.resolve({ data: [] as ReportRow[] }),
    pairIds.length
      ? supabase.from('pairs').select('id, player_a_id, player_b_id').in('id', pairIds)
      : Promise.resolve({ data: [] as { id: string; player_a_id: string; player_b_id: string }[] }),
  ]);

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

  // El marcador d'un report normal es desa relatiu a QUI reporta ("a"=el seu
  // propi equip, "b"=el rival) — NO en termes absoluts pair_a/pair_b. Aquesta
  // pàgina mostra els dos reports l'un al costat de l'altre sota les
  // etiquetes "Capità A"/"Capità B" (que es refereixen als costats ABSOLUTS
  // del partit), així que cal capgirar el del capità B abans de mostrar-lo:
  // si no, dos capitans que informen EXACTAMENT el mateix resultat real
  // semblen discrepar (per això moltes d'aquestes "disputes" no ho són de
  // veritat — són el mateix marcador, mirall). Els walkovers són l'excepció:
  // es desen ja en termes absoluts (vegeu submit_match_walkover_report).
  function isWalkoverScore(score: unknown): boolean {
    return (
      Array.isArray(score) &&
      score.length > 0 &&
      typeof score[0] === 'object' &&
      score[0] !== null &&
      (score[0] as { wo?: unknown }).wo === true
    );
  }

  function flipScore(score: unknown): { set: number; a: number; b: number }[] | null {
    if (!Array.isArray(score)) return null;
    return score
      .filter(
        (s): s is { set: number; a: number; b: number } =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as { set: unknown }).set === 'number' &&
          typeof (s as { a: unknown }).a === 'number' &&
          typeof (s as { b: unknown }).b === 'number',
      )
      .map((s) => ({ set: s.set, a: s.b, b: s.a }));
  }

  function absoluteScore(report: ReportRow | undefined): unknown {
    if (!report) return null;
    if (report.reporter_pair_side === 'b' && !isWalkoverScore(report.score_json)) {
      return flipScore(report.score_json);
    }
    return report.score_json;
  }

  function reportScoreText(report: ReportRow | undefined): string {
    return report ? scoreToText(absoluteScore(report)) : '—';
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
        reportScoreText={reportScoreText}
        emphasizeDispute
      />

      <DisputeBlock
        title={t('disputes_section_pending')}
        emptyLabel={t('disputes_no_pending')}
        matches={pending}
        reports={reports ?? []}
        pairLabel={pairLabel}
        reportScoreText={reportScoreText}
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
  reportScoreText,
  emphasizeDispute = false,
}: {
  title: string;
  emptyLabel: string;
  matches: MatchRow[];
  reports: ReportRow[];
  pairLabel: (pairId: string) => string;
  reportScoreText: (report: ReportRow | undefined) => string;
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
                    <ScoreCell label="A" text={reportScoreText(reportA)} />
                    <ScoreCell label="B" text={reportScoreText(reportB)} />
                  </div>
                )}
                {emphasizeDispute && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <WalkoverButton
                      matchId={m.id}
                      pairAId={m.pair_a_id}
                      pairBId={m.pair_b_id}
                      pairALabel={pairLabel(m.pair_a_id)}
                      pairBLabel={pairLabel(m.pair_b_id)}
                    />
                    <EditScoreButton matchId={m.id} initialSets={[]} />
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

function ScoreCell({ label, text }: { label: string; text: string }) {
  return (
    <div className="bg-card rounded-md p-2">
      <p className="text-muted-foreground/80 text-[10px] tracking-wider uppercase">
        Capità {label}
      </p>
      <p className="font-mono">{text}</p>
    </div>
  );
}
