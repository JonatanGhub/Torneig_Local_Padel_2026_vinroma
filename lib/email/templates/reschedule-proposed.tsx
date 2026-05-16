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

export type RescheduleProposedProps = {
  rivalCaptainName: string;
  proposerLabel: string;
  newDateText: string;
  newCourtLabel: string | null;
  message: string | null;
  actionUrl: string;
};

export default function RescheduleProposed({
  rivalCaptainName,
  proposerLabel,
  newDateText,
  newCourtLabel,
  message,
  actionUrl,
}: RescheduleProposedProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>
        {proposerLabel} proposa canviar la data del vostre partit a {newDateText}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Proposta de canvi de partit</Heading>
          <Text style={text}>Hola {rivalCaptainName},</Text>
          <Text style={text}>
            <strong>{proposerLabel}</strong> proposa moure el vostre partit a una nova data:
          </Text>

          <Section style={highlight}>
            <Text style={highlightText}>
              <strong>Nova data:</strong> {newDateText}
              {newCourtLabel ? (
                <>
                  <br />
                  <strong>Nova pista:</strong> {newCourtLabel}
                </>
              ) : null}
            </Text>
          </Section>

          {message ? (
            <Section style={quote}>
              <Text style={quoteText}>“{message}”</Text>
            </Section>
          ) : null}

          <Text style={text}>Has de respondre acceptant o rebutjant la proposta:</Text>
          <Button style={button} href={actionUrl}>
            Veure i respondre
          </Button>

          <Hr style={hr} />
          <Text style={small}>
            Si ja no juga aquesta parella o tens dubtes, contacta amb l&apos;organització.
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
const quote = {
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '12px 0',
};
const quoteText = { fontSize: '14px', margin: 0, color: '#525252', fontStyle: 'italic' as const };
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
