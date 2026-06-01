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

export type MatchScheduledProps = {
  recipientName: string;
  pairLabel: string;
  rivalLabel: string;
  dateText: string;
  courtLabel: string;
  isChange: boolean;
  actionUrl: string;
};

export default function MatchScheduled({
  recipientName,
  pairLabel,
  rivalLabel,
  dateText,
  courtLabel,
  isChange,
  actionUrl,
}: MatchScheduledProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>
        {pairLabel} vs {rivalLabel} — {dateText}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>
            {isChange ? "Canvi d'horari del partit" : 'El teu partit ja té data'}
          </Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            {isChange ? "L'organització ha actualitzat" : "L'organització ha programat"} el partit{' '}
            <strong>{pairLabel}</strong> contra <strong>{rivalLabel}</strong>:
          </Text>

          <Section style={highlight}>
            <Text style={highlightText}>
              <strong>Data:</strong> {dateText}
              <br />
              <strong>Pista:</strong> {courtLabel}
            </Text>
          </Section>

          <Button style={button} href={actionUrl}>
            Veure el meu calendari
          </Button>

          <Hr style={hr} />
          <Text style={small}>
            Si no pots jugar en aquesta data, pots proposar un canvi al rival des del portal.
          </Text>
          <Text style={small}>Club Pàdel les Coves · V edició — 2026</Text>
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
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #b91c1c',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '16px 0',
};
const highlightText = { fontSize: '14px', margin: 0, color: '#262626' };
const button = {
  display: 'inline-block',
  backgroundColor: '#b91c1c',
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
