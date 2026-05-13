import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components';

export type PaymentReceivedProps = {
  recipientName: string;
  categoryLabel: string;
  amountLabel: string;
  drawDateLabel: string;
};

export default function PaymentReceived({
  recipientName,
  categoryLabel,
  amountLabel,
  drawDateLabel,
}: PaymentReceivedProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>Pagament confirmat. Et veiem al sorteig!</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Pagament confirmat ✓</Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            Hem rebut el teu pagament de <strong>{amountLabel}</strong> i ja estàs oficialment
            inscrit a la categoria <strong>{categoryLabel}</strong> del V Torneig de Pàdel les Coves
            de Vinromà.
          </Text>
          <Text style={text}>
            El sorteig de cuadres serà el <strong>{drawDateLabel}</strong>. Et notificarem el grup,
            els rivals i l&apos;horari del primer partit per email i WhatsApp.
          </Text>
          <Hr style={hr} />
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
const hr = { borderColor: '#e5e5e5', margin: '24px 0' };
const small = { fontSize: '12px', color: '#737373', lineHeight: '18px' };
