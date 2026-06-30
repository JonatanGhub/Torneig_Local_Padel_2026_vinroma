'use client';

import { useState, useTransition } from 'react';
import {
  sendTestToGroup,
  sendTestToNumber,
  triggerDailyCron,
  checkConnectionState,
  checkGroupInfo,
  listAllGroups,
  discoverGroupsAction,
  restartInstanceAction,
  connectInstanceAction,
  logoutInstanceAction,
  recreateInstanceAction,
  resendMatchNotification,
} from './actions';
import type { ConnectInstanceResult, RecreateInstanceResult } from '@/lib/whatsapp/send';
import type {
  WhatsAppDebugResult,
  WhatsAppConfigSnapshot,
  CronRunResult,
  RawEvolutionResponse,
  GroupListEntry,
  DiscoverGroupsResult,
} from './types';

type Props = { config: WhatsAppConfigSnapshot | null };

export function DebugPanel({ config }: Props) {
  const [groupResult, setGroupResult] = useState<WhatsAppDebugResult | null>(null);
  const [dmResult, setDmResult] = useState<WhatsAppDebugResult | null>(null);
  const [cronResult, setCronResult] = useState<CronRunResult | null>(null);
  const [connState, setConnState] = useState<RawEvolutionResponse | null>(null);
  const [groupInfo, setGroupInfo] = useState<RawEvolutionResponse | null>(null);
  const [allGroups, setAllGroups] = useState<{
    raw: RawEvolutionResponse;
    groups: GroupListEntry[] | null;
  } | null>(null);
  const [discovered, setDiscovered] = useState<DiscoverGroupsResult | null>(null);
  const [restart, setRestart] = useState<RawEvolutionResponse | null>(null);
  const [connectRes, setConnectRes] = useState<ConnectInstanceResult | null>(null);
  const [logoutRes, setLogoutRes] = useState<RawEvolutionResponse | null>(null);
  const [recreateRes, setRecreateRes] = useState<RecreateInstanceResult | null>(null);
  const [phone, setPhone] = useState('');
  const [resendMatchId, setResendMatchId] = useState('');
  const [resendResult, setResendResult] = useState<{ ok: boolean; error?: string } | null>(null);
  // Candidat fort per a "TORNEIG ESTIU TOTS" (primer JID de findChats). L'admin
  // el pot canviar per provar qualsevol altre JID de la llista descoberta.
  const [manualJid, setManualJid] = useState('120363043943785701@g.us');

  const [pConn, sConn] = useTransition();
  const [pRestart, sRestart] = useTransition();
  const [pConnect, sConnect] = useTransition();
  const [pLogout, sLogout] = useTransition();
  const [pRecreate, sRecreate] = useTransition();
  const [pInfo, sInfo] = useTransition();
  const [pList, sList] = useTransition();
  const [pDiscover, sDiscover] = useTransition();
  const [pGroup, sGroup] = useTransition();
  const [pDm, sDm] = useTransition();
  const [pCron, sCron] = useTransition();
  const [pResend, sResend] = useTransition();

  if (!config) return <p className="text-sm text-red-600">No autoritzat.</p>;

  const configuredJid = config.groupJidFull;

  return (
    <div className="space-y-6">
      <ConfigCard config={config} />

      <section className="space-y-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold">🎯 JID a provar</h2>
        <p className="text-muted-foreground text-sm">
          Escriu aquí el JID d&apos;un grup (de la llista descoberta) per provar-lo sense tocar les
          variables d&apos;entorn. Les seccions &laquo;Llegir info del grup&raquo; i &laquo;Enviar
          prova al grup&raquo; faran servir aquest valor.
        </p>
        <input
          type="text"
          value={manualJid}
          onChange={(e) => setManualJid(e.target.value)}
          placeholder="120363...@g.us"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm"
        />
        <p className="text-muted-foreground text-xs">
          Si el deixes buit, s&apos;usa el <code>WHATSAPP_GROUP_JID</code> configurat.
        </p>
      </section>

      <Section
        n={1}
        title="Estat de la connexió de la instància"
        description="Si la sessió de WhatsApp del bot està CLOSED/CONNECTING, els missatges retornen 200 OK però mai s'envien."
      >
        <PrimaryButton
          pending={pConn}
          onClick={() => sConn(async () => setConnState(await checkConnectionState()))}
          label="Comprovar connexió"
        />
        {connState && <RawResponseView resp={connState} />}
      </Section>

      <section className="space-y-2 rounded-lg border-2 border-orange-400 bg-orange-50 p-4 dark:bg-orange-950/30">
        <h2 className="text-lg font-semibold">🔄 Reiniciar instància (recuperació)</h2>
        <p className="text-muted-foreground text-sm">
          Si els DMs funcionen i pots llegir la info del grup, però enviar al grup es penja amb un{' '}
          <strong>504 Gateway Time-out</strong>, vol dir que la sessió del grup (sender-keys)
          s&apos;ha quedat encallada dins d&apos;Evolution. Reiniciar la instància la torna a
          sincronitzar <strong>sense haver de tornar a escanejar el QR</strong> (es reconnecta amb
          les credencials guardades). Després espera ~15 s i torna a provar &laquo;Enviar prova al
          grup&raquo;.
        </p>
        <PrimaryButton
          pending={pRestart}
          onClick={() => sRestart(async () => setRestart(await restartInstanceAction()))}
          label="Reiniciar instància Evolution"
        />
        {restart && <RawResponseView resp={restart} />}
      </section>

      <section className="space-y-3 rounded-lg border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/30">
        <header>
          <h2 className="text-lg font-semibold">🆘 Reconnectar / obtenir QR (sessió morta)</h2>
          <p className="text-muted-foreground text-sm">
            Si «Comprovar connexió» diu <code>state: open</code> però <strong>tot</strong> falla amb{' '}
            <strong>Connection Closed</strong> (DMs, grup, info del grup), el socket de WhatsApp
            està mort i el reinici no l&apos;ha revifat. Això sol passar quan WhatsApp ha{' '}
            <strong>desvinculat el dispositiu</strong>. Clica aquí: si encara hi ha credencials
            vàlides, reconnecta; si no, et donarà un <strong>QR / codi d&apos;emparellament</strong>{' '}
            per tornar a vincular el número.
          </p>
        </header>
        <PrimaryButton
          pending={pConnect}
          onClick={() => sConnect(async () => setConnectRes(await connectInstanceAction()))}
          label="Reconnectar / obtenir QR"
        />
        {connectRes && <ConnectView res={connectRes} />}

        <div className="mt-3 border-t border-red-300 pt-3 dark:border-red-800">
          <p className="text-muted-foreground mb-2 text-xs">
            Si «Reconnectar» no dóna cap QR i segueix fallant, fes <strong>logout</strong> (tanca la
            sessió) i després torna a clicar «Reconnectar / obtenir QR» per generar un QR net. ⚠️
            Després caldrà escanejar el QR amb el telèfon del torneig.
          </p>
          <button
            type="button"
            onClick={() => sLogout(async () => setLogoutRes(await logoutInstanceAction()))}
            disabled={pLogout}
            className="rounded-md border border-red-400 bg-transparent px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/40"
          >
            {pLogout ? 'Carregant…' : 'Logout (tancar sessió)'}
          </button>
          {logoutRes && <RawResponseView resp={logoutRes} />}
        </div>

        <div className="mt-3 border-t border-red-400 pt-3 dark:border-red-700">
          <p className="text-muted-foreground mb-2 text-xs">
            <strong>Última opció (recrear instància):</strong> si «Reconnectar» diu state:open sense
            QR i «Logout» falla amb Connection Closed, la instància està en estat zombie. Això
            l&apos;esborra i la torna a crear amb el mateix nom per generar un{' '}
            <strong>QR completament net</strong>. ⚠️ Caldrà escanejar el QR amb el telèfon del
            torneig. Si apareix una «nova API key», caldrà actualitzar{' '}
            <code>EVOLUTION_API_KEY</code> (avisa&apos;m amb el valor).
          </p>
          <button
            type="button"
            onClick={() => sRecreate(async () => setRecreateRes(await recreateInstanceAction()))}
            disabled={pRecreate}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pRecreate ? 'Carregant…' : 'Recrear instància (delete + create → QR)'}
          </button>
          {recreateRes && <RecreateView res={recreateRes} />}
        </div>
      </section>

      <Section
        n={2}
        title="Info del grup (JID a provar)"
        description="GET /group/findGroupInfos amb el JID del camp de dalt (o el configurat si és buit). Mostra el nom del grup."
      >
        <PrimaryButton
          pending={pInfo}
          onClick={() => sInfo(async () => setGroupInfo(await checkGroupInfo(manualJid)))}
          label="Llegir info del grup"
        />
        {groupInfo && <RawResponseView resp={groupInfo} />}
      </Section>

      <Section
        n={3}
        title="Descobrir grups (ràpid) ⭐"
        description="Llegeix els xats de la BD local d'Evolution i en treu els JIDs de grup. És ràpid (evita el 504 de fetchAllGroups). Aquí trobaràs el JID de TORNEIG ESTIU TOTS."
      >
        <PrimaryButton
          pending={pDiscover}
          onClick={() => sDiscover(async () => setDiscovered(await discoverGroupsAction()))}
          label="Descobrir grups"
        />
        {discovered && <DiscoverView data={discovered} configuredJid={configuredJid} />}
      </Section>

      <Section
        n={3.1}
        title="Llistar tots els grups del bot (lent)"
        description="GET /group/fetchAllGroups. Sol fer 504 perquè consulta WhatsApp en viu. Fes servir 'Descobrir grups' millor."
      >
        <PrimaryButton
          pending={pList}
          onClick={() => sList(async () => setAllGroups(await listAllGroups()))}
          label="Llistar grups (lent)"
        />
        {allGroups && <GroupListView data={allGroups} configuredJid={configuredJid} />}
      </Section>

      <Section
        n={4}
        title="Envia missatge de prova al grup (JID a provar)"
        description="POST /message/sendText al JID del camp de dalt (o el configurat si és buit). Comprova si arriba al grup correcte."
      >
        <PrimaryButton
          pending={pGroup}
          onClick={() => sGroup(async () => setGroupResult(await sendTestToGroup(manualJid)))}
          label="Enviar prova al grup"
        />
        {groupResult && <ResultView result={groupResult} />}
      </Section>

      <Section
        n={5}
        title="Envia missatge de prova a un número (DM)"
        description="Per confirmar que els DMs continuen funcionant."
      >
        <form
          action={(formData) => sDm(async () => setDmResult(await sendTestToNumber(formData)))}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="tel"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="600123456"
            required
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
          />
          <PrimaryButton type="submit" pending={pDm} disabled={!phone.trim()} label="Enviar DM" />
        </form>
        {dmResult && <ResultView result={dmResult} />}
      </Section>

      <Section
        n={6}
        title="Executa el cron diari ara"
        description="sendDailyGroupSummary + notifyFeePhaseChangeToGroup, sense esperar les 09:00."
      >
        <PrimaryButton
          pending={pCron}
          onClick={() => sCron(async () => setCronResult(await triggerDailyCron()))}
          label="Executar cron ara"
        />
        {cronResult && <CronResultView result={cronResult} />}
      </Section>

      <section className="space-y-3 rounded-lg border-2 border-blue-400 bg-blue-50 p-4 dark:bg-blue-950/30">
        <header>
          <h2 className="text-lg font-semibold">🔁 Re-enviar notificació de resultat</h2>
          <p className="text-muted-foreground text-sm">
            Si Evolution estava caigut quan es va validar un resultat, usa això per tornar a enviar
            el WA als dos capitans i al grup. Entra l&apos;ID (UUID) del partit.
          </p>
        </header>
        <form
          action={(fd) =>
            sResend(async () => {
              fd.set('matchId', resendMatchId);
              setResendResult(await resendMatchNotification(resendMatchId));
            })
          }
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={resendMatchId}
            onChange={(e) => setResendMatchId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="min-w-[22rem] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm"
          />
          <PrimaryButton
            type="submit"
            pending={pResend}
            disabled={!resendMatchId.trim()}
            label="Re-enviar WA"
          />
        </form>
        {resendResult && (
          <div
            className={`rounded-md border p-3 text-sm ${resendResult.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200'}`}
          >
            {resendResult.ok
              ? "✓ Notificacions enviades (comprova els logs de Vercel per confirmar l'entrega)"
              : `✗ Error: ${resendResult.error}`}
          </div>
        )}
      </section>
    </div>
  );
}

function Section({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <header>
        <h2 className="text-lg font-semibold">
          {n}. {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>
      {children}
    </section>
  );
}

function PrimaryButton({
  onClick,
  pending,
  label,
  disabled,
  type = 'button',
}: {
  onClick?: () => void;
  pending: boolean;
  label: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending || disabled}
      className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Carregant…' : label}
    </button>
  );
}

function ConfigCard({ config }: { config: WhatsAppConfigSnapshot }) {
  const Row = ({
    label,
    ok,
    value,
    note,
    breakAll,
  }: {
    label: string;
    ok: boolean;
    value?: string | null;
    note?: string;
    breakAll?: boolean;
  }) => (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[hsl(var(--border))] py-2 last:border-b-0">
      <span className="font-mono text-xs">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <span className={ok ? 'text-emerald-600' : 'text-red-600'}>{ok ? '✓' : '✗'}</span>
        {value && (
          <code className={`text-muted-foreground text-xs ${breakAll ? 'break-all' : ''}`}>
            {value}
          </code>
        )}
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
      </span>
    </li>
  );

  return (
    <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h2 className="mb-2 text-lg font-semibold">Configuració actual</h2>
      <ul className="text-sm">
        <Row label="EVOLUTION_API_URL" ok={config.apiUrlPresent} value={config.apiUrlPreview} />
        <Row
          label="EVOLUTION_API_KEY"
          ok={config.apiKeyPresent}
          note={config.apiKeyPresent ? `(${config.apiKeyLength} caràcters)` : undefined}
        />
        <Row
          label="EVOLUTION_INSTANCE"
          ok={config.instancePresent}
          value={config.instancePreview}
        />
        <Row
          label="WHATSAPP_GROUP_JID"
          ok={config.groupJidPresent && config.groupJidLooksValid}
          value={config.groupJidFull}
          breakAll
          note={
            config.groupJidPresent && !config.groupJidLooksValid
              ? '(format invàlid — ha de ser <digits>@g.us)'
              : undefined
          }
        />
        <Row
          label="WHATSAPP_ADMIN_NUMBER"
          ok={config.adminNumberPresent}
          note={config.adminNumberPresent ? undefined : '(opcional)'}
        />
        <Row label="CRON_SECRET" ok={config.cronSecretPresent} />
      </ul>
    </section>
  );
}

function ResultView({ result }: { result: WhatsAppDebugResult }) {
  if (result.ok) {
    return (
      <div className="space-y-1 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <div className="font-medium">
          ✓ Enviat. HTTP {result.status} · {new Date(result.sentAt).toLocaleString('ca-ES')}
        </div>
        {result.responseBody && (
          <pre className="overflow-x-auto rounded bg-emerald-100 p-2 text-xs break-all whitespace-pre-wrap dark:bg-emerald-900">
            {result.responseBody}
          </pre>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
      <div className="font-medium">✗ Error ({result.reason})</div>
      {result.status !== undefined && (
        <div>
          HTTP <code>{result.status}</code>
        </div>
      )}
      {result.error && (
        <pre className="overflow-x-auto rounded bg-red-100 p-2 text-xs break-all whitespace-pre-wrap dark:bg-red-900">
          {result.error}
        </pre>
      )}
      {result.body && (
        <pre className="overflow-x-auto rounded bg-red-100 p-2 text-xs break-all whitespace-pre-wrap dark:bg-red-900">
          {result.body}
        </pre>
      )}
    </div>
  );
}

function ConnectView({ res }: { res: ConnectInstanceResult }) {
  const hasQr = Boolean(res.qrBase64 || res.qrCode);
  const tone = res.ok
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
    : 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200';
  // El base64 d'Evolution sol venir ja com a data URL; si no, l'afegim.
  const imgSrc = res.qrBase64
    ? res.qrBase64.startsWith('data:')
      ? res.qrBase64
      : `data:image/png;base64,${res.qrBase64}`
    : null;

  return (
    <div className={`space-y-2 rounded-md border p-3 text-sm ${tone}`}>
      <div className="font-medium">
        {res.ok ? '✓' : '✗'} HTTP {res.status || '(no resposta)'}
      </div>

      {res.pairingCode && (
        <div className="rounded-md border border-current/30 bg-white/60 p-3 dark:bg-black/30">
          <p className="text-xs tracking-wider uppercase opacity-70">Codi d&apos;emparellament</p>
          <p className="font-mono text-2xl font-bold tracking-[0.3em]">{res.pairingCode}</p>
          <p className="mt-1 text-xs opacity-80">
            Al telèfon del torneig: WhatsApp → Dispositius vinculats → Vincular un dispositiu →
            «Vincular amb número de telèfon» → escriu aquest codi.
          </p>
        </div>
      )}

      {imgSrc && (
        <div className="rounded-md border border-current/30 bg-white p-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt="QR per vincular WhatsApp" className="mx-auto h-56 w-56" />
          <p className="mt-1 text-xs text-black/70">
            Escaneja amb WhatsApp → Dispositius vinculats → Vincular un dispositiu.
          </p>
        </div>
      )}

      {!hasQr && !res.pairingCode && res.ok && (
        <p className="text-xs">
          Sense QR — la instància diu que ja està connectada. Espera ~10 s i torna a provar «Enviar
          DM» o «Enviar prova al grup». Si segueix fallant, fes Logout i torna a clicar aquí.
        </p>
      )}

      <pre className="overflow-x-auto rounded bg-black/10 p-2 text-xs break-all whitespace-pre-wrap dark:bg-white/10">
        {res.body || '(cos buit)'}
      </pre>
    </div>
  );
}

function RecreateView({ res }: { res: RecreateInstanceResult }) {
  const tone = res.ok
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
    : 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200';
  const imgSrc = res.qrBase64
    ? res.qrBase64.startsWith('data:')
      ? res.qrBase64
      : `data:image/png;base64,${res.qrBase64}`
    : null;

  return (
    <div className={`mt-2 space-y-2 rounded-md border p-3 text-sm ${tone}`}>
      <div className="font-medium">
        {res.ok ? '✓ Instància recreada' : '✗ No s’ha pogut recrear'} · delete HTTP{' '}
        {res.deleteStatus || '—'} · create HTTP {res.createStatus || '—'}
      </div>

      {res.newApiKey && (
        <div className="rounded-md border border-amber-400 bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="text-xs font-semibold tracking-wider uppercase">⚠️ Nova API key generada</p>
          <p className="font-mono text-sm break-all">{res.newApiKey}</p>
          <p className="mt-1 text-xs">
            Cal actualitzar <code>EVOLUTION_API_KEY</code> a Vercel amb aquest valor. Passa&apos;l a
            l&apos;assistent.
          </p>
        </div>
      )}

      {imgSrc && (
        <div className="rounded-md border border-current/30 bg-white p-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt="QR per vincular WhatsApp" className="mx-auto h-56 w-56" />
          <p className="mt-1 text-xs text-black/70">
            Escaneja amb WhatsApp → Dispositius vinculats → Vincular un dispositiu.
          </p>
        </div>
      )}

      {res.pairingCode && (
        <div className="rounded-md border border-current/30 bg-white/60 p-3 dark:bg-black/30">
          <p className="text-xs tracking-wider uppercase opacity-70">Codi d&apos;emparellament</p>
          <p className="font-mono text-2xl font-bold tracking-[0.3em]">{res.pairingCode}</p>
        </div>
      )}

      {!imgSrc && !res.pairingCode && (
        <p className="text-xs">
          Sense QR a la resposta. Si el create ha fallat amb «already in use» o similar, la
          instància no s&apos;ha pogut esborrar i cal{' '}
          <strong>reiniciar el contenidor d&apos;Evolution al servidor</strong>. Mira els detalls
          sota.
        </p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer opacity-80">Detalls (delete / create)</summary>
        <pre className="mt-1 overflow-x-auto rounded bg-black/10 p-2 break-all whitespace-pre-wrap dark:bg-white/10">
          {`DELETE → ${res.deleteBody || '(buit)'}\n\nCREATE → ${res.createBody || '(buit)'}`}
        </pre>
      </details>
    </div>
  );
}

function RawResponseView({ resp }: { resp: RawEvolutionResponse }) {
  const tone = resp.ok
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
    : 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200';
  const bg = resp.ok ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-red-100 dark:bg-red-900';
  return (
    <div className={`space-y-1 rounded-md border p-3 text-sm ${tone}`}>
      <div className="font-medium">
        {resp.ok ? '✓' : '✗'} HTTP {resp.status || '(no resposta)'}
      </div>
      <pre className={`overflow-x-auto rounded p-2 text-xs break-all whitespace-pre-wrap ${bg}`}>
        {resp.body || '(cos buit)'}
      </pre>
    </div>
  );
}

function DiscoverView({
  data,
  configuredJid,
}: {
  data: DiscoverGroupsResult;
  configuredJid: string | null;
}) {
  const [filter, setFilter] = useState('');
  if (!data.ok) {
    return (
      <div className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
        <div className="font-medium">✗ Error (HTTP {data.status})</div>
        {data.error && (
          <pre className="overflow-x-auto rounded bg-red-100 p-2 text-xs break-all whitespace-pre-wrap dark:bg-red-900">
            {data.error}
          </pre>
        )}
      </div>
    );
  }

  const matched = configuredJid ? data.groups.find((g) => g.id === configuredJid) : undefined;
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? data.groups.filter(
        (g) => g.subject.toLowerCase().includes(q) || g.id.toLowerCase().includes(q),
      )
    : data.groups;

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
        <div className="font-medium">{data.groups.length} grups trobats</div>
        {configuredJid && (
          <div className="mt-1 text-xs">
            JID configurat: <code className="break-all">{configuredJid}</code>
            {matched ? (
              <span className="ml-2 text-emerald-600">✓ és «{matched.subject}»</span>
            ) : (
              <span className="ml-2 text-red-600">✗ no és cap d&apos;aquests</span>
            )}
          </div>
        )}
      </div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtra (ex: TORNEIG ESTIU)"
        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
      />
      <ul className="divide-y divide-[hsl(var(--border))] overflow-x-auto rounded-md border border-[hsl(var(--border))] text-sm">
        {filtered.length === 0 ? (
          <li className="text-muted-foreground px-3 py-2 text-xs">Cap grup coincideix.</li>
        ) : (
          filtered.map((g) => (
            <li key={g.id} className="px-3 py-2">
              <div className="font-medium">{g.subject || '(sense nom)'}</div>
              <code className="text-muted-foreground text-xs break-all">{g.id}</code>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function GroupListView({
  data,
  configuredJid,
}: {
  data: { raw: RawEvolutionResponse; groups: GroupListEntry[] | null };
  configuredJid: string | null;
}) {
  const [filter, setFilter] = useState('');
  if (!data.raw.ok) {
    return <RawResponseView resp={data.raw} />;
  }
  if (!data.groups) {
    return (
      <div className="space-y-1 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
        <div className="font-medium">⚠️ Resposta no parseable</div>
        <pre className="overflow-x-auto rounded bg-yellow-100 p-2 text-xs break-all whitespace-pre-wrap dark:bg-yellow-900">
          {data.raw.body}
        </pre>
      </div>
    );
  }

  const matched = configuredJid ? data.groups.find((g) => g.id === configuredJid) : undefined;
  const sorted = [...data.groups].sort((a, b) =>
    (a.subject || '').localeCompare(b.subject || '', 'ca', { sensitivity: 'base' }),
  );
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? sorted.filter((g) => g.subject.toLowerCase().includes(q) || g.id.toLowerCase().includes(q))
    : sorted;

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm">
        <div className="font-medium">{data.groups.length} grups que coneix la instància</div>
        {configuredJid && (
          <div className="mt-1 text-xs">
            JID configurat: <code className="break-all">{configuredJid}</code>
            {matched ? (
              <span className="ml-2 text-emerald-600">✓ TROBAT (subject: «{matched.subject}»)</span>
            ) : (
              <span className="ml-2 text-red-600">
                ✗ NO TROBAT — copia el JID correcte de la llista de sota
              </span>
            )}
          </div>
        )}
      </div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtra per nom o JID (ex: TORNEIG ESTIU)"
        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
      />
      <ul className="divide-y divide-[hsl(var(--border))] overflow-x-auto rounded-md border border-[hsl(var(--border))] text-sm">
        {filtered.length === 0 ? (
          <li className="text-muted-foreground px-3 py-2 text-xs">Cap grup coincideix.</li>
        ) : (
          filtered.map((g) => (
            <li key={g.id} className="px-3 py-2">
              <div className="font-medium">{g.subject || '(sense nom)'}</div>
              <code className="text-muted-foreground text-xs break-all">{g.id}</code>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function CronResultView({ result }: { result: CronRunResult }) {
  const tone = result.ok
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
    : 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200';
  return (
    <div className={`space-y-1 rounded-md border p-3 text-sm ${tone}`}>
      <div className="font-medium">
        {result.ok ? '✓ Cron executat sense excepcions' : '✗ Excepció al cron'}
      </div>
      <div className="text-xs">
        Inici: {new Date(result.startedAt).toLocaleTimeString('ca-ES')} · Final:{' '}
        {new Date(result.finishedAt).toLocaleTimeString('ca-ES')}
      </div>
      <ul className="text-xs">
        <li>
          sendDailyGroupSummary: {result.daily.attempted ? '✓ executat' : '— no executat'}
          {result.daily.error && (
            <pre className="overflow-x-auto rounded bg-red-100 p-1 dark:bg-red-900">
              {result.daily.error}
            </pre>
          )}
        </li>
        <li>
          notifyFeePhaseChangeToGroup: {result.feePhase.attempted ? '✓ executat' : '— no executat'}
          {result.feePhase.error && (
            <pre className="overflow-x-auto rounded bg-red-100 p-1 dark:bg-red-900">
              {result.feePhase.error}
            </pre>
          )}
        </li>
      </ul>
      <div className="text-muted-foreground mt-1 text-xs">
        ⚠️ Sense excepcions <em>no</em> vol dir que els missatges hagin arribat. Cada funció captura
        els seus propis errors internament. Per validar de veritat, comprova el grup de WhatsApp.
      </div>
    </div>
  );
}
