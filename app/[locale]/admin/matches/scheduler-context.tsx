'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Proposal = { scheduledAtInput: string; courtLabel: string };

type SchedulerContextValue = {
  proposals: Record<string, Proposal>;
  setProposals: (next: Record<string, Proposal>) => void;
  clearProposals: () => void;
};

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

export function SchedulerProvider({ children }: { children: React.ReactNode }) {
  const [proposals, setProposalsState] = useState<Record<string, Proposal>>({});

  const setProposals = useCallback((next: Record<string, Proposal>) => {
    setProposalsState(next);
  }, []);
  const clearProposals = useCallback(() => setProposalsState({}), []);

  const value = useMemo(
    () => ({ proposals, setProposals, clearProposals }),
    [proposals, setProposals, clearProposals],
  );

  return <SchedulerContext.Provider value={value}>{children}</SchedulerContext.Provider>;
}

export function useScheduler(): SchedulerContextValue {
  const ctx = useContext(SchedulerContext);
  if (!ctx) throw new Error('useScheduler must be used within SchedulerProvider');
  return ctx;
}
