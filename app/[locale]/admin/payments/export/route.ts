import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /<locale>/admin/payments/export
 *
 * Devuelve un CSV con todos los pagos para conciliar offline (Excel,
 * Bizum, transferencias). Solo accesible para admins.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Service client porque queremos saltar RLS de payments → players.
  const svc = createServiceClient();
  const { data: payments, error } = await svc
    .from('payments')
    .select(
      'reference_code, pair_id, payer_player_id, fee_id, method, amount_cents, status, reconciled_at, notes, created_at',
    )
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = payments ?? [];
  const payerIds = Array.from(new Set(list.map((p) => p.payer_player_id).filter(Boolean)));
  const { data: players } = payerIds.length
    ? await svc.from('players').select('id, first_name, last_name, email').in('id', payerIds)
    : { data: [] };
  const playerMap = new Map((players ?? []).map((p) => [p.id, p]));

  const header = [
    'reference_code',
    'created_at',
    'method',
    'amount_eur',
    'status',
    'reconciled_at',
    'payer_first_name',
    'payer_last_name',
    'payer_email',
    'pair_id',
    'fee_id',
    'notes',
  ];

  const rows = list.map((p) => {
    const payer = playerMap.get(p.payer_player_id);
    return [
      p.reference_code,
      p.created_at,
      p.method,
      (p.amount_cents / 100).toFixed(2).replace('.', ','), // formato EU
      p.status,
      p.reconciled_at ?? '',
      payer?.first_name ?? '',
      payer?.last_name ?? '',
      payer?.email ?? '',
      p.pair_id,
      p.fee_id,
      p.notes ?? '',
    ];
  });

  const csv = [header, ...rows].map(toCsvLine).join('\r\n');
  // Prefijo BOM para que Excel detecte UTF-8 con acentos.
  const body = '﻿' + csv;

  const filename = `pagos-torneig-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function toCsvLine(values: (string | number | null | undefined)[]) {
  return values.map(csvCell).join(';');
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
