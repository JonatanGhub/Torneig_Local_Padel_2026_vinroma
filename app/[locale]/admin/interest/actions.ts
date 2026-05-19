'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'unauthenticated' as const };
  if ((user.app_metadata?.role as string | undefined) !== 'admin')
    return { ok: false as const, error: 'forbidden' as const };
  return { ok: true as const, supabase };
}

export async function deleteInterestSubscription(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: 'invalid_input' } as const;
  }
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from('interest_subscriptions').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/interest', 'page');
  return { ok: true } as const;
}
