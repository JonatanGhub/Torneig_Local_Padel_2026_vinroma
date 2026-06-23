export type WhatsAppDebugResult =
  | { ok: true; status: number; target: 'group' | 'dm'; sentAt: string }
  | {
      ok: false;
      target: 'group' | 'dm';
      reason: 'not_configured' | 'invalid_number' | 'api_error' | 'forbidden' | 'invalid_input';
      error?: string;
      status?: number;
      body?: string;
    };

export type WhatsAppConfigSnapshot = {
  evolutionConfigured: boolean;
  apiUrlPresent: boolean;
  apiUrlPreview: string | null;
  apiKeyPresent: boolean;
  apiKeyLength: number;
  instancePresent: boolean;
  instancePreview: string | null;
  groupJidPresent: boolean;
  groupJidPreview: string | null;
  groupJidLooksValid: boolean;
  cronSecretPresent: boolean;
  adminNumberPresent: boolean;
};

export type CronRunResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  daily: { attempted: boolean; error?: string };
  feePhase: { attempted: boolean; error?: string };
};

export type GroupInfo = {
  ok: boolean;
  status?: number;
  error?: string;
  matchedGroup?: { id: string; subject: string; size?: number; isAdmin?: boolean };
  totalGroups?: number;
};
