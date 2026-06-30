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

export type WhatsAppHealthAlertProps = {
  status: 'down' | 'recovered';
  detail: string;
  restarted: boolean;
  debugUrl: string;
};

export default function WhatsAppHealthAlert({
  status,
  detail,
  restarted,
  debugUrl,
}: WhatsAppHealthAlertProps) {
  const isDown = status === 'down';
  return (
    <Html lang="ca">
      <Head />
      <Preview>
        {isDown
          ? 'WhatsApp del torneig CAIGUT — cal revisar Evolution'
          : 'WhatsApp del torneig RECUPERAT'}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={isDown ? h1Down : h1Ok}>
            {isDown ? '⚠️ WhatsApp caigut' : '✅ WhatsApp recuperat'}
          </Heading>

          {isDown ? (
            <>
              <Text style={text}>
                La connexió de WhatsApp del torneig (Evolution) <strong>no respon</strong>. Mentre
                estigui així, els avisos als capitans i al grup <strong>no s&apos;envien</strong>{' '}
                (tot i que els correus sí funcionen).
              </Text>
              <Text style={text}>
                {restarted
                  ? "S'ha intentat reiniciar la instància automàticament però segueix sense respondre."
                  : "No s'ha pogut intentar el reinici automàtic."}{' '}
                Cal revisar-ho manualment.
              </Text>
            </>
          ) : (
            <Text style={text}>
              La connexió de WhatsApp torna a funcionar
              {restarted ? ' després del reinici automàtic' : ''}. Els avisos ja s&apos;envien
              normalment. Revisa si cal re-enviar manualment alguna notificació perduda durant la
              caiguda.
            </Text>
          )}

          <Section style={highlight}>
            <Text style={highlightText}>
              <strong>Detall tècnic:</strong>{' '}
              <span style={{ fontFamily: 'ui-monospace, monospace' }}>{detail}</span>
            </Text>
          </Section>

          <Button style={isDown ? buttonDown : buttonOk} href={debugUrl}>
            Obrir el panell de diagnòstic
          </Button>

          <Hr style={hr} />
          {isDown && (
            <Text style={small}>
              Passos de recuperació: 1) Panell → «Comprovar connexió» i «Llegir info del grup». 2)
              Si tot falla amb «Connection Closed», reinicia el contenidor d&apos;Evolution al
              servidor. 3) Si cal, torna a vincular el QR. 4) Quan torni, re-envia les notificacions
              perdudes.
            </Text>
          )}
          <Text style={small}>
            Avís automàtic del sistema de monitoratge · Club Pàdel les Coves · V edició — 2026
          </Text>
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
const h1Down = {
  fontSize: '22px',
  fontWeight: 600 as const,
  marginBottom: '16px',
  color: '#b91c1c',
};
const h1Ok = { fontSize: '22px', fontWeight: 600 as const, marginBottom: '16px', color: '#15803d' };
const text = { fontSize: '15px', lineHeight: '22px', color: '#262626' };
const highlight = {
  backgroundColor: '#f5f5f5',
  borderLeft: '4px solid #737373',
  borderRadius: '4px',
  padding: '14px 16px',
  margin: '16px 0',
};
const highlightText = { fontSize: '13px', margin: 0, color: '#262626', lineHeight: '20px' };
const buttonDown = {
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
const buttonOk = { ...buttonDown, backgroundColor: '#15803d' };
const hr = { borderColor: '#e5e5e5', margin: '24px 0' };
const small = { fontSize: '12px', color: '#737373', lineHeight: '18px' };
