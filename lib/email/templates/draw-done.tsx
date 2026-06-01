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

export type DrawDoneProps = {
  recipientName: string;
  categoryLabel: string;
  groupLabel: string;
  actionUrl: string;
};

export default function DrawDone({
  recipientName,
  categoryLabel,
  groupLabel,
  actionUrl,
}: DrawDoneProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>
        Ja tens grup a {categoryLabel}: grup {groupLabel}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Ja s&apos;ha fet el sorteig!</Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            Ja s&apos;ha sortejat la fase de grups de <strong>{categoryLabel}</strong>. La teva
            parella ha quedat al:
          </Text>

          <Section style={highlight}>
            <Text style={highlightText}>
              <strong>Grup {groupLabel}</strong>
            </Text>
          </Section>

          <Text style={text}>
            Ja pots veure els teus rivals i els partits del grup al portal. L&apos;organització
            anirà assignant data i pista a cada partit.
          </Text>

          <Button style={button} href={actionUrl}>
            Veure el meu grup
          </Button>

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
const highlight = {
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #b91c1c',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '16px 0',
};
const highlightText = { fontSize: '18px', margin: 0, color: '#262626' };
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
