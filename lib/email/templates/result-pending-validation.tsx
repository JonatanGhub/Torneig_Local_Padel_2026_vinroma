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

export type ResultPendingValidationProps = {
  rivalCaptainName: string;
  reporterLabel: string;
  rivalLabel: string;
  scoreText: string;
  actionUrl: string;
};

export default function ResultPendingValidation({
  rivalCaptainName,
  reporterLabel,
  rivalLabel,
  scoreText,
  actionUrl,
}: ResultPendingValidationProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>
        {reporterLabel} ha reportat un resultat: {scoreText}. Confirma&apos;l a l&apos;app.
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Resultat per confirmar</Heading>
          <Text style={text}>Hola {rivalCaptainName},</Text>
          <Text style={text}>
            <strong>{reporterLabel}</strong> ha reportat el resultat del vostre partit contra{' '}
            <strong>{rivalLabel}</strong>:
          </Text>

          <Section style={highlight}>
            <Text style={highlightText}>
              <strong>Marcador reportat:</strong> {scoreText}
            </Text>
          </Section>

          <Text style={text}>
            El resultat queda <strong>pendent de validar</strong>. Entra a l&apos;app i
            confirma&apos;l (o reporta el teu si no hi estàs d&apos;acord) perquè quedi validat
            oficialment.
          </Text>
          <Button style={button} href={actionUrl}>
            Confirmar el resultat
          </Button>

          <Hr style={hr} />
          <Text style={small}>
            Si no confirmes ni reportes, el resultat no comptarà fins que l&apos;organització ho
            resolgui.
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
