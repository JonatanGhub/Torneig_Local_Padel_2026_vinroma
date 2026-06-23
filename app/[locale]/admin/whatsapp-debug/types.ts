export type WhatsAppDebugResult =
  | {
      ok: true;
      status: number;
      target: 'group' | 'dm';
      sentAt: string;
      responseBody?: string;
    }
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
  groupJidFull: string | null;
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

export type RawEvolutionResponse = {
  ok: boolean;
  status: number;
  body: string;
};

export type GroupListEntry = { id: string; subject: string };

export type DiscoverGroupsResult = {
  ok: boolean;
  status: number;
  error?: string;
  chatsCount?: number;
  groups: GroupListEntry[];
};
