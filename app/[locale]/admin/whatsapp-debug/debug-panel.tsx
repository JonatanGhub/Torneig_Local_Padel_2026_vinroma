'use client';

import { useState, useTransition } from 'react';
import { sendTestToGroup, sendTestToNumber, fetchGroupInfo, triggerDailyCron } from './actions';
import type {
  WhatsAppDebugResult,
  WhatsAppConfigSnapshot,
  GroupInfo,
  CronRunResult,
} from './types';

type Props = { config: WhatsAppConfigSnapshot | null };

export function DebugPanel({ config }: Props) {
  const [groupResult, setGroupResult] = useState<WhatsAppDebugResult | null>(null);
  const [dmResult, setDmResult] = useState<WhatsAppDebugResult | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [cronResult, setCronResult] = useState<CronRunResult | null>(null);
  const [phone, setPhone] = useState('');
  const [isGroupPending, startGroupTransition] = useTransition();
  const [isDmPending, startDmTransition] = useTransition();
  const [isInfoPending, startInfoTransition] = useTransition();
  const [isCronPending, startCronTransition] = useTransition();

  if (!config) {
    return <p className="text-sm text-red-600">No autoritzat.</p>;
  }

  return (
    <div className="space-y-6">
      <ConfigCard config={config} />

      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <header>
          <h2 className="text-lg font-semibold">1. Verifica el grup a Evolution</h2>
          <p className="text-muted-foreground text-sm">
            Crida <code>GET /group/fetchAllGroups</code> i comprova si el JID que tens a{' '}
            <code>WHATSAPP_GROUP_JID</code> apareix entre els grups de la instància.
          </p>
        </header>
        <button
          type="button"
          onClick={() => {
            startInfoTransition(async () => {
              const r = await fetchGroupInfo();
              setGroupInfo(r);
            });
          }}
          disabled={isInfoPending}
          className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
        >
          {isInfoPending ? 'Comprovant…' : 'Comprovar grup'}
        </button>
        {groupInfo && <GroupInfoView info={groupInfo} />}
      </section>

      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <header>
          <h2 className="text-lg font-semibold">2. Envia missatge de prova al grup</h2>
          <p className="text-muted-foreground text-sm">
            Envia un missatge real al grup configurat. Si Evolution respon error, el veuràs sota.
          </p>
        </header>
        <button
          type="button"
          onClick={() => {
            startGroupTransition(async () => {
              const r = await sendTestToGroup();
              setGroupResult(r);
            });
          }}
          disabled={isGroupPending}
          className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
        >
          {isGroupPending ? 'Enviant…' : 'Enviar prova al grup'}
        </button>
        {groupResult && <ResultView result={groupResult} />}
      </section>

      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <header>
          <h2 className="text-lg font-semibold">3. Envia missatge de prova a un número (DM)</h2>
          <p className="text-muted-foreground text-sm">
            Per verificar que els DMs també funcionen. Format: 9 dígits espanyols o internacional
            amb prefix.
          </p>
        </header>
        <form
          action={(formData) => {
            startDmTransition(async () => {
              const r = await sendTestToNumber(formData);
              setDmResult(r);
            });
          }}
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
          <button
            type="submit"
            disabled={isDmPending || !phone.trim()}
            className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {isDmPending ? 'Enviant…' : 'Enviar DM'}
          </button>
        </form>
        {dmResult && <ResultView result={dmResult} />}
      </section>

      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <header>
          <h2 className="text-lg font-semibold">4. Executa el cron diari ara</h2>
          <p className="text-muted-foreground text-sm">
            Executa la mateixa lògica que el cron de les 09:00: <code>sendDailyGroupSummary()</code>{' '}
            + <code>notifyFeePhaseChangeToGroup()</code>. Útil per provar sense esperar al matí.
            Comprova el grup després per veure si han arribat els missatges.
          </p>
        </header>
        <button
          type="button"
          onClick={() => {
            startCronTransition(async () => {
              const r = await triggerDailyCron();
              setCronResult(r);
            });
          }}
          disabled={isCronPending}
          className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
        >
          {isCronPending ? 'Executant…' : 'Executar cron ara'}
        </button>
        {cronResult && <CronResultView result={cronResult} />}
      </section>
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

function ConfigCard({ config }: { config: WhatsAppConfigSnapshot }) {
  const Row = ({
    label,
    ok,
    value,
    note,
  }: {
    label: string;
    ok: boolean;
    value?: string | null;
    note?: string;
  }) => (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[hsl(var(--border))] py-2 last:border-b-0">
      <span className="font-mono text-xs">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <span className={ok ? 'text-emerald-600' : 'text-red-600'}>{ok ? '✓' : '✗'}</span>
        {value && <code className="text-muted-foreground text-xs">{value}</code>}
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
          value={config.groupJidPreview}
          note={
            config.groupJidPresent && !config.groupJidLooksValid
              ? '(format invàlid — ha de ser <digits>@g.us)'
              : undefined
          }
        />
        <Row
          label="WHATSAPP_ADMIN_NUMBER"
          ok={config.adminNumberPresent}
          note={config.adminNumberPresent ? undefined : '(opcional — DMs disputes a l’admin)'}
        />
        <Row label="CRON_SECRET" ok={config.cronSecretPresent} />
      </ul>
    </section>
  );
}

function ResultView({ result }: { result: WhatsAppDebugResult }) {
  if (result.ok) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        ✓ Enviat. HTTP {result.status} · {new Date(result.sentAt).toLocaleString('ca-ES')}
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
        <pre className="overflow-x-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900">
          {result.error}
        </pre>
      )}
      {result.body && (
        <pre className="overflow-x-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900">
          {result.body}
        </pre>
      )}
    </div>
  );
}

function GroupInfoView({ info }: { info: GroupInfo }) {
  if (info.ok && info.matchedGroup) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <div className="font-medium">✓ Grup trobat a la instància</div>
        <div className="mt-1 space-y-0.5 text-xs">
          <div>
            Nom: <strong>{info.matchedGroup.subject}</strong>
          </div>
          <div>
            JID: <code>{info.matchedGroup.id}</code>
          </div>
          {info.matchedGroup.size !== undefined && (
            <div>Participants: {info.matchedGroup.size}</div>
          )}
          {info.totalGroups !== undefined && (
            <div className="text-muted-foreground">
              ({info.totalGroups} grups totals a la instància)
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
      <div className="font-medium">✗ {info.error ?? 'Error desconegut'}</div>
      {info.status !== undefined && (
        <div>
          HTTP <code>{info.status}</code>
        </div>
      )}
      {info.totalGroups !== undefined && (
        <div className="text-xs">
          La instància té {info.totalGroups} grups, però el JID configurat no n&apos;és cap.
          Verifica que el bot està al grup correcte i que el JID coincideix.
        </div>
      )}
    </div>
  );
}
