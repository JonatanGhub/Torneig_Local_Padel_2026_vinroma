import { describe, it, expect } from 'vitest';
import { formatCents, computePerPairAmount, type ActiveFee } from '@/lib/pricing';

const fee = (cents: number): ActiveFee => ({
  id: 'fee-1',
  tournament_id: 't-1',
  label_ca: 'Tarifa',
  label_es: 'Tarifa',
  starts_at: '2026-01-01T00:00:00Z',
  ends_at: '2026-12-31T00:00:00Z',
  amount_per_player_cents: cents,
  is_default_open: true,
});

describe('computePerPairAmount', () => {
  it('doubles the per-player amount', () => {
    expect(computePerPairAmount(fee(1500))).toBe(3000);
    expect(computePerPairAmount(fee(0))).toBe(0);
  });
});

describe('formatCents', () => {
  it('formats euros with the catalan locale by default', () => {
    // Non-breaking spaces vary by ICU build, so assert on the meaningful parts.
    const out = formatCents(1500);
    expect(out).toContain('15');
    expect(out).toContain('€');
  });

  it('renders cents precisely', () => {
    const out = formatCents(1599, 'es');
    expect(out.replace(/\s/g, '')).toMatch(/15,99€/);
  });
});
