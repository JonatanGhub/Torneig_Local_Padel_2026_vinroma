import { describe, it, expect } from 'vitest';
import {
  RegistrationSchema,
  PlayerSchema,
  isValidEmail,
  isValidMobile,
  isMinor,
} from '@/types/registration';

const validPlayer = (over: Record<string, unknown> = {}) => ({
  first_name: 'Anna',
  last_name: 'Garcia',
  email: 'anna@example.com',
  phone: '600123456',
  birth_date: '1990-05-01',
  declared_level: 2,
  tshirt_size: 'M',
  health_declaration_signed: true,
  emergency_contact_name: 'Pere',
  emergency_contact_phone: '600999888',
  ...over,
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses and trims', () => {
    expect(isValidEmail(' a@b.com ')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('isValidMobile', () => {
  it('accepts Spanish mobiles with optional +34 and spaces', () => {
    expect(isValidMobile('600123456')).toBe(true);
    expect(isValidMobile('+34 600 123 456')).toBe(true);
    expect(isValidMobile('712345678')).toBe(true);
  });
  it('rejects landlines and bad lengths', () => {
    expect(isValidMobile('912345678')).toBe(false);
    expect(isValidMobile('60012345')).toBe(false);
  });
});

describe('isMinor', () => {
  it('flags a birth date under 18 at the reference date', () => {
    const ref = new Date('2026-06-01T00:00:00Z');
    expect(isMinor('2010-01-01', ref)).toBe(true);
    expect(isMinor('2000-01-01', ref)).toBe(false);
  });
});

describe('PlayerSchema', () => {
  it('accepts a valid player and lowercases email', () => {
    const parsed = PlayerSchema.parse(validPlayer({ email: 'ANNA@Example.com' }));
    expect(parsed.email).toBe('anna@example.com');
  });
  it('requires the health declaration to be true', () => {
    const res = PlayerSchema.safeParse(validPlayer({ health_declaration_signed: false }));
    expect(res.success).toBe(false);
  });
});

describe('RegistrationSchema', () => {
  const validRegistration = () => ({
    player_a: validPlayer(),
    player_b: validPlayer({ email: 'bob@example.com', phone: '611222333' }),
    captain: 'a' as const,
    category_level: 2,
    fee_mode: 'per_pair' as const,
    consent_data_processing: true as const,
    consent_results_publication: true,
    consent_whatsapp: false,
    consent_eligibility: true as const,
  });

  it('accepts a complete valid registration', () => {
    expect(RegistrationSchema.safeParse(validRegistration()).success).toBe(true);
  });

  it('rejects two players sharing an email', () => {
    const res = RegistrationSchema.safeParse({
      ...validRegistration(),
      player_b: validPlayer(), // same email as player_a
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message === 'duplicate_email')).toBe(true);
    }
  });

  it('requires the data-processing consent', () => {
    const res = RegistrationSchema.safeParse({
      ...validRegistration(),
      consent_data_processing: false,
    });
    expect(res.success).toBe(false);
  });
});
