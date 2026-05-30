import { describe, it, expect } from 'vitest';
import { buildIcsCalendar, type IcalCalendar } from '@/lib/ical';

const baseCal = (overrides: Partial<IcalCalendar> = {}): IcalCalendar => ({
  name: 'Torneig',
  description: 'Calendari',
  timezone: 'Europe/Madrid',
  now: new Date('2026-05-29T10:00:00Z'),
  matches: [],
  ...overrides,
});

describe('buildIcsCalendar', () => {
  it('emits a well-formed empty VCALENDAR with CRLF endings', () => {
    const ics = buildIcsCalendar(baseCal());
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-TIMEZONE:Europe/Madrid');
  });

  it('renders an event with start, computed end, and a 1h alarm', () => {
    const ics = buildIcsCalendar(
      baseCal({
        matches: [
          {
            id: 'm1',
            scheduledAt: '2026-06-10T17:00:00Z',
            durationMinutes: 90,
            summary: 'A vs B',
            description: 'Grup A',
            location: 'Pista 1',
            status: 'confirmed',
          },
        ],
      }),
    );
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:match-m1@padel-vinroma.com');
    expect(ics).toContain('DTSTART:20260610T170000Z');
    expect(ics).toContain('DTEND:20260610T183000Z'); // +90 min
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('TRIGGER:-PT1H');
  });

  it('escapes commas and semicolons in text fields', () => {
    const ics = buildIcsCalendar(
      baseCal({
        matches: [
          {
            id: 'm2',
            scheduledAt: '2026-06-10T17:00:00Z',
            durationMinutes: 60,
            summary: 'A, B; C',
            description: 'x',
            location: 'y',
            status: 'cancelled',
          },
        ],
      }),
    );
    expect(ics).toContain('SUMMARY:A\\, B\\; C');
    expect(ics).toContain('STATUS:CANCELLED');
  });
});
