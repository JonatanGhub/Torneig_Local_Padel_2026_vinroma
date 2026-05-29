import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toWhatsAppNumber, whatsappConfigured } from '@/lib/whatsapp/send';

describe('toWhatsAppNumber', () => {
  it('returns null for empty / junk input', () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber(undefined)).toBeNull();
    expect(toWhatsAppNumber('')).toBeNull();
    expect(toWhatsAppNumber('abc')).toBeNull();
  });

  it('prefixes a 9-digit national number with 34', () => {
    expect(toWhatsAppNumber('600123456')).toBe('34600123456');
    expect(toWhatsAppNumber('600 12 34 56')).toBe('34600123456');
  });

  it('keeps an already-prefixed 34 number', () => {
    expect(toWhatsAppNumber('34600123456')).toBe('34600123456');
    expect(toWhatsAppNumber('+34 600 123 456')).toBe('34600123456');
  });

  it('passes through other international numbers (>= 11 digits)', () => {
    expect(toWhatsAppNumber('+33612345678')).toBe('33612345678');
  });

  it('rejects too-short numbers', () => {
    expect(toWhatsAppNumber('12345')).toBeNull();
  });
});

describe('whatsappConfigured', () => {
  const saved = {
    url: process.env.EVOLUTION_API_URL,
    key: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_INSTANCE,
  };

  beforeEach(() => {
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    delete process.env.EVOLUTION_INSTANCE;
  });

  afterEach(() => {
    process.env.EVOLUTION_API_URL = saved.url;
    process.env.EVOLUTION_API_KEY = saved.key;
    process.env.EVOLUTION_INSTANCE = saved.instance;
  });

  it('reflects the module-load-time config snapshot', () => {
    // The module reads env at import time, so this asserts the value is a
    // boolean reflecting whatever was set when the module first loaded —
    // primarily a smoke test that the export exists and is callable.
    expect(typeof whatsappConfigured()).toBe('boolean');
  });
});
