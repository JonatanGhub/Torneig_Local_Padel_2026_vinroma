import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type InterestAnnouncementProps = {
  locale: 'ca' | 'es';
  registrationUrl: string;
  closesAtLabel: string;
  feeLabel: string | null;
  feeAmountLabel: string | null;
};

const COPY = {
  ca: {
    preview: 'Ja pots inscriure la teva parella al V Torneig de Pàdel les Coves',
    heading: 'Inscripcions obertes!',
    greeting:
      'Ja pots inscriure la teva parella al V Torneig de Pàdel les Coves de Vinromà (edició 2026).',
    closesAt: (date: string) => `Termini per inscriure's: fins al ${date}.`,
    feeLine: (label: string, amount: string) =>
      `Tarifa vigent: ${label} — ${amount} per jugador. La quota es revisa per períodes; abans s'apunti, millor preu.`,
    cta: 'Inscriure la parella',
    footer:
      "Has rebut aquest correu perquè vas demanar que t'avisem quan obrissin les inscripcions. Si no t'interessa, ignora aquest missatge.",
    signoff: 'Club Pàdel les Coves · V edició — 2026',
  },
  es: {
    preview: 'Ya puedes inscribir tu pareja en el V Torneo de Pádel de les Coves',
    heading: '¡Inscripciones abiertas!',
    greeting:
      'Ya puedes inscribir tu pareja en el V Torneo de Pádel les Coves de Vinromà (edición 2026).',
    closesAt: (date: string) => `Plazo para inscribirse: hasta el ${date}.`,
    feeLine: (label: string, amount: string) =>
      `Tarifa vigente: ${label} — ${amount} por jugador. La cuota se revisa por periodos; cuanto antes te apuntes, mejor precio.`,
    cta: 'Inscribir la pareja',
    footer:
      'Recibes este correo porque pediste que te avisáramos cuando abrieran las inscripciones. Si ya no te interesa, ignora este mensaje.',
    signoff: 'Club Pàdel les Coves · V edición — 2026',
  },
} as const;

export default function InterestAnnouncement({
  locale,
  registrationUrl,
  closesAtLabel,
  feeLabel,
  feeAmountLabel,
}: InterestAnnouncementProps) {
  const copy = COPY[locale];
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.greeting}</Text>

          <Section style={highlight}>
            <Text style={highlightText}>{copy.closesAt(closesAtLabel)}</Text>
            {feeLabel && feeAmountLabel && (
              <Text style={highlightText}>{copy.feeLine(feeLabel, feeAmountLabel)}</Text>
            )}
          </Section>

          <Button style={button} href={registrationUrl}>
            {copy.cta}
          </Button>

          <Hr style={hr} />
          <Text style={small}>{copy.footer}</Text>
          <Text style={small}>{copy.signoff}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#f5f5f5', fontFamily: 'sans-serif' };
const container = {
  maxWidth: '560px',
  margin: '32px auto',
  padding: '32px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
};
const h1 = { fontSize: '22px', fontWeight: 600 as const, marginBottom: '16px' };
const text = { fontSize: '15px', lineHeight: '22px', color: '#262626' };
const highlight = {
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '16px 0',
};
const highlightText = { fontSize: '14px', margin: '4px 0', color: '#262626' };
const button = {
  display: 'inline-block',
  backgroundColor: '#171717',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500 as const,
  marginTop: '8px',
};
const hr = { borderColor: '#e5e5e5', margin: '24px 0' };
const small = { fontSize: '12px', color: '#737373', lineHeight: '18px' };
