import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { getConfigSnapshot } from './actions';
import { DebugPanel } from './debug-panel';

type Props = { params: Promise<{ locale: Locale }> };

export const dynamic = 'force-dynamic';

export default async function WhatsAppDebugPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const config = await getConfigSnapshot();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">WhatsApp · Diagnòstic</h1>
        <p className="text-muted-foreground text-sm">
          Comprova la configuració d&apos;Evolution API i envia missatges de prova al grup o a un
          número. Si veus un error, copia&apos;l per investigar-ho.
        </p>
      </header>

      <DebugPanel config={config} />
    </section>
  );
}
