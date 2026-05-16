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

export type MatchDisputedProps = {
  pairALabel: string;
  pairBLabel: string;
  scoreA: string;
  scoreB: string;
  resolveUrl: string;
};

export default function MatchDisputed({
  pairALabel,
  pairBLabel,
  scoreA,
  scoreB,
  resolveUrl,
}: MatchDisputedProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>
        Disputa: {pairALabel} vs {pairBLabel} — marcadors no coincideixen
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Partit en disputa</Heading>
          <Text style={text}>
            Els dos capitans han reportat marcadors diferents en el partit{' '}
            <strong>{pairALabel}</strong> vs <strong>{pairBLabel}</strong>:
          </Text>

          <Section style={highlight}>
            <Text style={highlightText}>
              <strong>Capità A:</strong>{' '}
              <span style={{ fontFamily: 'ui-monospace, monospace' }}>{scoreA}</span>
              <br />
              <strong>Capità B:</strong>{' '}
              <span style={{ fontFamily: 'ui-monospace, monospace' }}>{scoreB}</span>
            </Text>
          </Section>

          <Text style={text}>Cal resolució manual des del panell d&apos;administració:</Text>
          <Button style={button} href={resolveUrl}>
            Veure disputa
          </Button>

          <Hr style={hr} />
          <Text style={small}>
            Aquest correu s&apos;envia automàticament a l&apos;administració quan dos capitans
            reporten marcadors diferents. Si tens informació externa (testimonis, fotos del
            marcador), inclou-la al resoldre.
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
const h1 = { fontSize: '22px', fontWeight: 600 as const, marginBottom: '16px', color: '#b91c1c' };
const text = { fontSize: '15px', lineHeight: '22px', color: '#262626' };
const highlight = {
  backgroundColor: '#fffbeb',
  borderLeft: '4px solid #ca8a04',
  borderRadius: '4px',
  padding: '14px 16px',
  margin: '16px 0',
};
const highlightText = { fontSize: '14px', margin: 0, color: '#262626', lineHeight: '22px' };
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
