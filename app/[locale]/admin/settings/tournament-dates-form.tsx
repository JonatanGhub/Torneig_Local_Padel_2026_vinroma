'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toMadridInputValue } from '@/lib/format-date';
import { updateTournamentDates } from './actions';

type Tournament = {
  id: string;
  registration_opens_at: string;
  registration_closes_at: string;
  draw_at: string;
  first_match_at: string;
  final_at: string;
  is_published: boolean;
};

export function TournamentDatesForm({ tournament }: { tournament: Tournament }) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      setFeedback(null);
      setIsError(false);
      const result = await updateTournamentDates(formData);
      if (result.ok) {
        setFeedback(t('tournament_dates_saved'));
      } else {
        setIsError(true);
        setFeedback(`${t('tournament_dates_error')}: ${result.error}`);
      }
    });
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('tournament_dates_title')}</h2>
        <p className="text-muted-foreground text-sm">{t('tournament_dates_subtitle')}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="tournamentId" value={tournament.id} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DateField
            name="registration_opens_at"
            label={t('tournament_date_registration_opens')}
            defaultValue={toMadridInputValue(tournament.registration_opens_at)}
          />
          <DateField
            name="registration_closes_at"
            label={t('tournament_date_registration_closes')}
            defaultValue={toMadridInputValue(tournament.registration_closes_at)}
          />
          <DateField
            name="draw_at"
            label={t('tournament_date_draw')}
            defaultValue={toMadridInputValue(tournament.draw_at)}
          />
          <DateField
            name="first_match_at"
            label={t('tournament_date_first_match')}
            defaultValue={toMadridInputValue(tournament.first_match_at)}
          />
          <DateField
            name="final_at"
            label={t('tournament_date_final')}
            defaultValue={toMadridInputValue(tournament.final_at)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={tournament.is_published}
            className="border-input size-4 rounded border"
          />
          <span>{t('tournament_dates_is_published')}</span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? '…' : t('tournament_dates_save')}
          </Button>
          {feedback && (
            <span className={`text-xs ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
              {feedback}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function DateField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input name={name} type="datetime-local" defaultValue={defaultValue} required />
    </label>
  );
}
