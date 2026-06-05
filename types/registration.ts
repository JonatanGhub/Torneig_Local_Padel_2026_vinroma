import { z } from 'zod';

const phoneSchema = z
  .string()
  .min(9)
  .max(20)
  .regex(/^[+0-9 ()-]+$/, { message: 'phone_invalid' });

export function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// Spanish mobile: 9 digits starting with 6 or 7, optional +34 prefix, spaces ignored.
export function isValidMobile(v: string) {
  return /^(\+34)?[67]\d{8}$/.test(v.replace(/\s+/g, ''));
}

const mobileSchema = z.string().refine(isValidMobile, { message: 'mobile_invalid' });

export const TshirtSizeSchema = z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
export type TshirtSize = z.infer<typeof TshirtSizeSchema>;

export const PlayerSchema = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase(),
  phone: mobileSchema,
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_invalid' }),
  declared_level: z.coerce.number().int().min(1).max(4),
  tshirt_size: TshirtSizeSchema,
  health_declaration_signed: z.literal(true, {
    errorMap: () => ({ message: 'health_declaration_required' }),
  }),
  emergency_contact_name: z.string().min(1).max(160),
  emergency_contact_phone: phoneSchema,
});

export const LegalGuardianSchema = z.object({
  legal_guardian_name: z.string().min(1).max(160),
  legal_guardian_dni: z.string().min(8).max(20),
  legal_guardian_phone: z.string().min(9).max(20),
  legal_guardian_email: z.string().email().toLowerCase(),
});

export const FeeModeSchema = z.enum(['per_pair', 'per_player']);

export const RegistrationSchema = z
  .object({
    player_a: PlayerSchema,
    player_b: PlayerSchema,
    captain: z.enum(['a', 'b']),
    category_level: z.coerce.number().int().min(1).max(4),
    fee_mode: FeeModeSchema,
    guardian_a: LegalGuardianSchema.optional(),
    guardian_b: LegalGuardianSchema.optional(),
    consent_data_processing: z.literal(true),
    consent_results_publication: z.boolean(),
    consent_whatsapp: z.boolean(),
    consent_eligibility: z.literal(true),
  })
  .superRefine((data, ctx) => {
    if (data.player_a.email === data.player_b.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['player_b', 'email'],
        message: 'duplicate_email',
      });
    }
  });

export type RegistrationInput = z.infer<typeof RegistrationSchema>;
export type PlayerInput = z.infer<typeof PlayerSchema>;
export type LegalGuardianInput = z.infer<typeof LegalGuardianSchema>;
export type FeeMode = z.infer<typeof FeeModeSchema>;

export function isMinor(birthDate: string, referenceDate: Date = new Date()) {
  const born = new Date(birthDate);
  const eighteen = new Date(referenceDate);
  eighteen.setFullYear(eighteen.getFullYear() - 18);
  return born > eighteen;
}
