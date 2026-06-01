'use client';

import { type ReactNode, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { runDraw, resetDraw, generateKnockout } from './actions';

type CategorySummary = {
  id: string;
  level: number;
  label: string;
  confirmedCount: number;
  inDrawCount: number;
  groupCount: number;
  drawSeed: number | null;
  drawnAt: string | null;
  groupMatchesTotal: number;
  groupMatchesDone: number;
  groupPhaseFinished: boolean;
  koGenerated: boolean;
};

export function DrawForms({
  summary,
  previewsByCategory,
}: {
  summary: CategorySummary[];
  previewsByCategory?: Record<string, ReactNode>;
}) {
  return (
    <ul className="divide-border divide-y rounded-md border border-[hsl(var(--border))]">
      {summary.map((cat) => (
        <CategoryRow key={cat.id} cat={cat} preview={previewsByCategory?.[cat.id]} />
      ))}
    </ul>
  );
}

function CategoryRow({ cat, preview }: { cat: CategorySummary; preview?: ReactNode }) {
  const t = useTranslations('admin');
  const [seed, setSeed] = useState<string>('1');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const alreadyDrawn = cat.groupCount > 0;
  const drawnPairsMissing = cat.confirmedCount - cat.inDrawCount;
  const canDraw = drawnPairsMissing >= 4;

  function handleDraw() {
    setError(null);
    setFeedback(null);
    const fd = new FormData();
    fd.set('categoryId', cat.id);
    fd.set('seed', seed);
    startTransition(async () => {
      const res = await runDraw(fd);
      if (res.ok) setFeedback(t('draw_done', { count: res.groups.length }));
      else setError(res.error);
    });
  }

  function handleReset() {
    if (!confirm(t('draw_reset_confirm'))) return;
    setError(null);
    setFeedback(null);
    const fd = new FormData();
    fd.set('categoryId', cat.id);
    startTransition(async () => {
      const res = await resetDraw(fd);
      if (res.ok) setFeedback(t('draw_reset_done', { count: res.deletedMatches }));
      else setError(res.error);
    });
  }

  function handleGenerateKnockout() {
    if (!confirm(t('ko_generate_confirm'))) return;
    setError(null);
    setFeedback(null);
    const fd = new FormData();
    fd.set('categoryId', cat.id);
    startTransition(async () => {
      const res = await generateKnockout(fd);
      if (res.ok) setFeedback(t('ko_generate_done'));
      else setError(res.error);
    });
  }

  return (
    <li className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-medium">{cat.label}</p>
          <p className="text-muted-foreground text-xs">
            {t('draw_stats', {
              confirmed: cat.confirmedCount,
              inDraw: cat.inDrawCount,
              groups: cat.groupCount,
            })}
          </p>
          {cat.drawSeed !== null && (
            <p className="text-muted-foreground text-xs">
              {t('draw_seed_label')}: {cat.drawSeed}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!alreadyDrawn ? (
            <>
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder={t('draw_seed_placeholder')}
                className="w-24"
              />
              <Button onClick={handleDraw} disabled={isPending || !canDraw} type="button">
                {isPending ? '…' : t('draw_action')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleReset} variant="outline" disabled={isPending} type="button">
                {t('draw_reset_action')}
              </Button>
              {cat.koGenerated ? (
                <span className="text-xs font-medium text-green-600">
                  {t('ko_generated_badge')}
                </span>
              ) : (
                <Button
                  onClick={handleGenerateKnockout}
                  disabled={isPending || !cat.groupPhaseFinished}
                  type="button"
                >
                  {isPending ? '…' : t('ko_generate_action')}
                </Button>
              )}
            </>
          )}
        </div>

        {feedback && <p className="text-xs text-green-600 md:basis-full">{feedback}</p>}
        {error && <p className="text-destructive text-xs md:basis-full">{error}</p>}
        {!alreadyDrawn && !canDraw && (
          <p className="text-muted-foreground text-xs md:basis-full">
            {t('draw_not_enough_pairs', { needed: 4 - drawnPairsMissing })}
          </p>
        )}
        {alreadyDrawn && !cat.koGenerated && !cat.groupPhaseFinished && (
          <p className="text-muted-foreground text-xs md:basis-full">
            {t('ko_group_progress', {
              done: cat.groupMatchesDone,
              total: cat.groupMatchesTotal,
            })}
          </p>
        )}
      </div>
      {alreadyDrawn && !cat.koGenerated && preview ? <div>{preview}</div> : null}
    </li>
  );
}
