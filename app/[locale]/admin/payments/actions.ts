'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notifyPaymentReconciled } from '@/lib/email/notify';
import { notifyPaymentReconciledWhatsApp } from '@/lib/whatsapp/notify';

export async function reconcilePayment(paymentId: string, notes?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' } as const;

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      reconciled_by: user.id,
      reconciled_at: new Date().toISOString(),
      notes: notes ?? null,
    })
    .eq('id', paymentId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message } as const;

  // Avisa el capità que el pagament està confirmat (email + WhatsApp).
  await notifyPaymentReconciled(paymentId);
  await notifyPaymentReconciledWhatsApp(paymentId);

  revalidatePath('/[locale]/admin/payments', 'page');
  return { ok: true } as const;
}
