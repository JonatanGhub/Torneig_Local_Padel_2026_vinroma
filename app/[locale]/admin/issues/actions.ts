'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['new', 'triaged', 'accepted', 'rejected', 'fixed'] as const;

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
  adminNotes: z.string().max(4000).optional().nullable(),
  prUrl: z
    .string()
    .max(2048)
    .optional()
    .nullable()
    .refine((v) => !v || /^https?:\/\//.test(v), { message: 'invalid_url' }),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'unauthenticated' as const };
  if ((user.app_metadata?.role as string | undefined) !== 'admin')
    return { ok: false as const, error: 'forbidden' as const };
  return { ok: true as const, supabase, userId: user.id };
}

export async function updateIssueReport(formData: FormData) {
  const parsed = UpdateSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
    adminNotes: (formData.get('adminNotes') as string | null) || null,
    prUrl: (formData.get('prUrl') as string | null) || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' } as const;
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from('issue_reports')
    .update({
      status: parsed.data.status,
      admin_notes: parsed.data.adminNotes,
      pr_url: parsed.data.prUrl,
      triaged_at: new Date().toISOString(),
      triaged_by: auth.userId,
    })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath('/[locale]/admin/issues', 'page');
  return { ok: true } as const;
}

export async function deleteIssueReport(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') return { ok: false, error: 'invalid_input' } as const;
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from('issue_reports').delete().eq('id', id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath('/[locale]/admin/issues', 'page');
  return { ok: true } as const;
}
