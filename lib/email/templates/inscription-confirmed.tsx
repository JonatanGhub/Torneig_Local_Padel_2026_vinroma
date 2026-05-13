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

export type InscriptionConfirmedProps = {
  recipientName: string;
  partnerName: string;
  categoryLabel: string;
  paymentUrl: string;
  amountLabel: string;
  feeLabel: string;
};

export default function InscriptionConfirmed({
  recipientName,
  partnerName,
  categoryLabel,
  paymentUrl,
  amountLabel,
  feeLabel,
}: InscriptionConfirmedProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>Hem rebut la teva inscripció al V Torneig de Pàdel les Coves</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Inscripció rebuda</Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            Hem registrat la teva inscripció al{' '}
            <strong>V Torneig de Pàdel les Coves de Vinromà</strong> amb {partnerName} a la
            categoria <strong>{categoryLabel}</strong>.
          </Text>

          <Section style={highlight}>
            <Text style={highlightText}>
              <strong>Tarifa aplicada:</strong> {feeLabel}
              <br />
              <strong>Import:</strong> {amountLabel}
            </Text>
          </Section>

          <Text style={text}>Per completar la inscripció, fes el pagament des d&apos;aquí:</Text>
          <Button style={button} href={paymentUrl}>
            Anar a la pàgina de pagament
          </Button>

          <Hr style={hr} />
          <Text style={small}>
            Et confirmarem per email i WhatsApp quan rebem el pagament. Si tens dubtes, respon
            directament a aquest correu.
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
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '16px 0',
};
const highlightText = { fontSize: '14px', margin: 0, color: '#262626' };
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
