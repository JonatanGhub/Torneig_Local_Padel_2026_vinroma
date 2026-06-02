'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({
  name: z.string().trim().min(1).max(120),
  logo_url: z.string().url().max(2048),
  website_url: z
    .string()
    .max(2048)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : null))
    .refine((v) => v === null || /^https?:\/\//.test(v), {
      message: 'invalid_website',
    }),
  tier: z.enum(['gold', 'silver', 'bronze', 'collaborator']),
  role_ca: z.string().max(200).optional().nullable(),
  role_es: z.string().max(200).optional().nullable(),
  submitter_name: z.string().trim().min(1).max(120),
  submitter_email: z.string().email().max(254),
  submitter_phone: z.string().max(40).optional().nullable(),
  message: z.string().max(1000).optional().nullable(),
});

export type ProposeSponsorResult = { ok: true } | { ok: false; error: 'invalid_input' | string };

export async function proposeSponsor(formData: FormData): Promise<ProposeSponsorResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = Schema.safeParse({
    name: raw.name,
    logo_url: raw.logo_url,
    website_url: raw.website_url || null,
    tier: raw.tier,
    role_ca: raw.role_ca || null,
    role_es: raw.role_es || null,
    submitter_name: raw.submitter_name,
    submitter_email: raw.submitter_email,
    submitter_phone: raw.submitter_phone || null,
    message: raw.message || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { error } = await supabase.from('sponsor_requests').insert({
    name: parsed.data.name,
    logo_url: parsed.data.logo_url,
    website_url: parsed.data.website_url,
    tier: parsed.data.tier,
    role_ca: parsed.data.role_ca,
    role_es: parsed.data.role_es,
    submitter_name: parsed.data.submitter_name,
    submitter_email: parsed.data.submitter_email.toLowerCase().trim(),
    submitter_phone: parsed.data.submitter_phone,
    message: parsed.data.message,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
