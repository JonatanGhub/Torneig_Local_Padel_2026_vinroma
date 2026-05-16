import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type MatchValidatedProps = {
  recipientName: string;
  pairLabel: string;
  rivalLabel: string;
  scoreText: string;
  won: boolean;
};

export default function MatchValidated({
  recipientName,
  pairLabel,
  rivalLabel,
  scoreText,
  won,
}: MatchValidatedProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>
        Resultat validat: {pairLabel} vs {rivalLabel} → {scoreText}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Resultat validat</Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            El partit <strong>{pairLabel}</strong> contra <strong>{rivalLabel}</strong> ha quedat
            validat amb el següent marcador:
          </Text>

          <Section style={won ? highlightWin : highlightLoss}>
            <Text style={resultText}>
              {scoreText}
              <br />
              <strong>{won ? '✓ Victòria' : 'Derrota'}</strong>
            </Text>
          </Section>

          <Text style={text}>
            La classificació de la categoria s&apos;actualitza automàticament. Pots consultar-la a
            la web del torneig.
          </Text>

          <Hr style={hr} />
          <Text style={small}>Si creus que hi ha un error, contacta amb l&apos;organització.</Text>
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
const highlightWin = {
  backgroundColor: '#f0fdf4',
  borderLeft: '4px solid #16a34a',
  borderRadius: '4px',
  padding: '14px 16px',
  margin: '16px 0',
};
const highlightLoss = {
  backgroundColor: '#fafafa',
  borderLeft: '4px solid #a3a3a3',
  borderRadius: '4px',
  padding: '14px 16px',
  margin: '16px 0',
};
const resultText = {
  fontSize: '20px',
  fontFamily: 'ui-monospace, monospace',
  margin: 0,
  color: '#262626',
};
const hr = { borderColor: '#e5e5e5', margin: '24px 0' };
const small = { fontSize: '12px', color: '#737373', lineHeight: '18px' };
