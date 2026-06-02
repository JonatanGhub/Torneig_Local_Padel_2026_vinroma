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

export type IssueReportReceivedProps = {
  reporterEmail: string;
  reporterName: string | null;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pageUrl: string | null;
  userAgent: string | null;
  adminUrl: string;
};

const SEVERITY_LABEL: Record<IssueReportReceivedProps['severity'], string> = {
  low: 'Baixa',
  medium: 'Mitjana',
  high: 'Alta',
  critical: 'Crítica',
};

export default function IssueReportReceived({
  reporterEmail,
  reporterName,
  title,
  description,
  severity,
  pageUrl,
  userAgent,
  adminUrl,
}: IssueReportReceivedProps) {
  return (
    <Html lang="ca">
      <Head />
      <Preview>Nou report del capità: {title}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Nou report d&apos;un capità</Heading>
          <Text style={text}>
            {reporterName ? <strong>{reporterName}</strong> : <strong>{reporterEmail}</strong>} ha
            enviat un report al sistema.
          </Text>

          <Section style={panel}>
            <Text style={label}>Títol</Text>
            <Text style={value}>{title}</Text>
            <Hr style={hr} />
            <Text style={label}>Gravetat</Text>
            <Text style={value}>{SEVERITY_LABEL[severity]}</Text>
            <Hr style={hr} />
            <Text style={label}>Descripció</Text>
            <Text style={{ ...value, whiteSpace: 'pre-wrap' }}>{description}</Text>
            {pageUrl && (
              <>
                <Hr style={hr} />
                <Text style={label}>Pàgina on va passar</Text>
                <Text style={value}>{pageUrl}</Text>
              </>
            )}
            {userAgent && (
              <>
                <Hr style={hr} />
                <Text style={label}>User agent</Text>
                <Text style={{ ...value, fontSize: 11 }}>{userAgent}</Text>
              </>
            )}
            <Hr style={hr} />
            <Text style={label}>Correu del capità</Text>
            <Text style={value}>{reporterEmail}</Text>
          </Section>

          <Section style={{ textAlign: 'center', marginTop: 24 }}>
            <Button href={adminUrl} style={btn}>
              Revisar al panell
            </Button>
          </Section>

          <Text style={footer}>
            Si no és un fallo real, marca&apos;l com a &quot;Descartat&quot; amb una nota. Si ho és,
            ja s&apos;ha de revisar i, si cal, obrir-ne PR.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#f5f5f5', fontFamily: 'Helvetica, Arial, sans-serif' } as const;
const container = {
  margin: '0 auto',
  maxWidth: 560,
  backgroundColor: '#ffffff',
  borderRadius: 12,
  padding: '32px 28px',
} as const;
const h1 = { fontSize: 22, fontWeight: 700, color: '#a30000', margin: '0 0 12px' } as const;
const text = { fontSize: 14, color: '#1f1f1f', lineHeight: 1.5, margin: '0 0 12px' } as const;
const panel = {
  backgroundColor: '#fafafa',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  padding: '12px 16px',
  marginTop: 8,
} as const;
const label = {
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  color: '#7a7a7a',
  margin: '8px 0 2px',
};
const value = { fontSize: 14, color: '#1f1f1f', margin: '0 0 4px' } as const;
const hr = { borderColor: '#eaeaea', margin: '8px 0' } as const;
const btn = {
  backgroundColor: '#a30000',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 22px',
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 600,
  display: 'inline-block',
} as const;
const footer = {
  fontSize: 11,
  color: '#7a7a7a',
  marginTop: 16,
  textAlign: 'center' as const,
};
