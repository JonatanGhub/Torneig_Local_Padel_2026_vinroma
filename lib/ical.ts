export type IcalMatch = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  summary: string;
  description: string;
  location: string;
  status: 'confirmed' | 'cancelled';
};

export type IcalCalendar = {
  name: string;
  description: string;
  timezone: string;
  matches: IcalMatch[];
  now?: Date;
};

const PROD_ID = '-//Torneig Padel les Coves de Vinroma//ES';

function escapeText(input: string) {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDateUtc(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function foldLine(line: string) {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + 75);
    parts.push(i === 0 ? chunk : ' ' + chunk);
    i += 75;
  }
  return parts.join('\r\n');
}

export function buildIcsCalendar(cal: IcalCalendar) {
  const now = cal.now ?? new Date();
  const dtstamp = formatDateUtc(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    `PRODID:${PROD_ID}`,
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(cal.name)}`,
    `X-WR-CALDESC:${escapeText(cal.description)}`,
    `X-WR-TIMEZONE:${cal.timezone}`,
  ];

  for (const m of cal.matches) {
    const start = new Date(m.scheduledAt);
    const end = new Date(start.getTime() + m.durationMinutes * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:match-${m.id}@padel-vinroma.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatDateUtc(start)}`,
      `DTEND:${formatDateUtc(end)}`,
      `SUMMARY:${escapeText(m.summary)}`,
      `DESCRIPTION:${escapeText(m.description)}`,
      `LOCATION:${escapeText(m.location)}`,
      `STATUS:${m.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
