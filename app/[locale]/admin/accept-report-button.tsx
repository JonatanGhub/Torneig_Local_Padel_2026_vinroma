'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { adminAcceptReport } from './actions';

export function AcceptReportButton({
  matchId,
  side,
  label,
}: {
  matchId: string;
  side: 'a' | 'b';
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await adminAcceptReport(formData);
    });
  }

  return (
    <form action={submit} className="inline">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="side" value={side} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
      >
        <Check className="size-3" />
        {isPending ? '…' : label}
      </button>
    </form>
  );
}
