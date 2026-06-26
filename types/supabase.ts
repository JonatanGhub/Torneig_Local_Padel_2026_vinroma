// PLACEHOLDER — regenerar con `pnpm db:types` una vez conectado a Supabase.
// Mantenido a mano hasta entonces para que el typecheck funcione.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type TournamentRow = {
  id: string;
  edition: number;
  year: number;
  slug: string;
  name_ca: string;
  name_es: string;
  registration_opens_at: string;
  registration_closes_at: string;
  draw_at: string;
  first_match_at: string;
  final_at: string;
  is_published: boolean;
  fee_mode_default: 'per_pair' | 'per_player';
  registration_close_warned_at: string | null;
  created_at: string;
  updated_at: string;
};

type TournamentFeeRow = {
  id: string;
  tournament_id: string;
  label_ca: string;
  label_es: string;
  starts_at: string;
  ends_at: string;
  amount_per_player_cents: number;
  is_default_open: boolean;
  phase_change_warned_at: string | null;
  created_at: string;
};

type CategoryRow = {
  id: string;
  tournament_id: string;
  level: number;
  name_ca: string;
  name_es: string;
  max_pairs: number;
};

type PlayerRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  declared_level: number | null;
  tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | null;
  legal_guardian_name: string | null;
  legal_guardian_dni: string | null;
  legal_guardian_phone: string | null;
  legal_guardian_email: string | null;
  pin_hash: string | null;
  is_minor: boolean;
  health_declaration_signed: boolean;
  health_declaration_signed_at: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  calendar_feed_token: string;
  consent_data_processing: boolean;
  consent_results_publication: boolean;
  consent_whatsapp: boolean;
  consent_signed_at: string | null;
  is_anonymized: boolean;
  anonymized_at: string | null;
  created_at: string;
  updated_at: string;
};

type PairRow = {
  id: string;
  tournament_id: string;
  category_id: string | null;
  player_a_id: string;
  player_b_id: string;
  captain_id: string;
  status: 'draft' | 'pending_payment' | 'confirmed' | 'withdrawn' | 'disqualified';
  fee_mode_chosen: 'per_pair' | 'per_player';
  group_id: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  created_at: string;
  updated_at: string;
};

type GroupRow = {
  id: string;
  tournament_id: string;
  category_id: string;
  label: string;
  draw_seed: number | null;
  drawn_at: string | null;
  created_at: string;
};

type CategoryStandingsRow = {
  pair_id: string;
  category_id: string;
  group_id: string;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  sets_won: number;
  sets_lost: number;
  sets_diff: number;
  games_for: number;
  games_against: number;
  games_diff: number;
};

type PaymentRow = {
  id: string;
  pair_id: string;
  player_id: string | null;
  payer_player_id: string;
  fee_id: string;
  method: 'bizum' | 'transfer';
  amount_cents: number;
  reference_code: string;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  reconciled_by: string | null;
  reconciled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MatchRow = {
  id: string;
  tournament_id: string;
  category_id: string;
  phase: string;
  group_label: string | null;
  scheduled_at: string | null;
  court_label: string | null;
  pair_a_id: string;
  pair_b_id: string;
  status: 'scheduled' | 'pending_validation' | 'validated' | 'disputed' | 'walkover';
  winner_pair_id: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type SetRow = {
  id: string;
  match_id: string;
  set_number: number;
  games_a: number;
  games_b: number;
  tb_a: number | null;
  tb_b: number | null;
};

type MatchReportRow = {
  id: string;
  match_id: string;
  reporter_player_id: string;
  reporter_pair_side: 'a' | 'b' | 'admin';
  score_json: Json;
  reported_at: string;
};

type RescheduleProposalRow = {
  id: string;
  match_id: string;
  proposer_player_id: string;
  proposer_pair_side: 'a' | 'b';
  new_scheduled_at: string;
  new_court_label: string | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  responded_by_player_id: string | null;
  responded_at: string | null;
  created_at: string;
};

type PairFinanceEntryRow = {
  id: string;
  pair_id: string;
  kind: 'income' | 'expense';
  amount_cents: number;
  label: string;
  notes: string | null;
  occurred_on: string;
  created_by_player_id: string;
  created_at: string;
  updated_at: string;
};

type SponsorRow = {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  tier: 'gold' | 'silver' | 'bronze' | 'collaborator';
  display_order: number;
  is_active: boolean;
  role_ca: string | null;
  role_es: string | null;
  created_at: string;
  updated_at: string;
};

type AuditLogRow = {
  id: number;
  table_name: string;
  row_pk: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Json | null;
  new_data: Json | null;
  actor_id: string | null;
  occurred_at: string;
};

type ClubSettingsRow = {
  id: string;
  legal_name: string;
  cif: string | null;
  address: string | null;
  email: string;
  bizum_phone: string | null;
  iban: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  is_singleton: boolean;
  created_at: string;
  updated_at: string;
};

export type InterestSubscriptionRow = {
  id: string;
  tournament_id: string;
  email: string;
  locale: 'ca' | 'es';
  source: string | null;
  created_at: string;
};

export type CaptainDeviceRow = {
  id: string;
  player_id: string;
  device_id: string;
  device_label: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type SponsorRequestRow = {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  tier: 'gold' | 'silver' | 'bronze' | 'collaborator';
  role_ca: string | null;
  role_es: string | null;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type BudgetEntryKind = 'income' | 'expense';
export type BudgetEntryCategory =
  | 'sponsorship'
  | 'donation'
  | 'other_income'
  | 'prizes'
  | 'snacks'
  | 'venue'
  | 'materials'
  | 'services'
  | 'other_expense';

export type TournamentBudgetEntryRow = {
  id: string;
  tournament_id: string;
  kind: BudgetEntryKind;
  category: BudgetEntryCategory;
  label: string;
  amount_cents: number;
  occurred_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IssueReportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueReportStatus = 'new' | 'triaged' | 'accepted' | 'rejected' | 'fixed';

export type IssueReportRow = {
  id: string;
  reporter_user_id: string | null;
  reporter_email: string;
  reporter_name: string | null;
  title: string;
  description: string;
  severity: IssueReportSeverity;
  page_url: string | null;
  user_agent: string | null;
  locale: 'ca' | 'es' | null;
  status: IssueReportStatus;
  admin_notes: string | null;
  pr_url: string | null;
  triaged_at: string | null;
  triaged_by: string | null;
  created_at: string;
  updated_at: string;
};

type Tbl<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      tournaments: Tbl<TournamentRow>;
      tournament_fees: Tbl<TournamentFeeRow>;
      categories: Tbl<CategoryRow>;
      players: Tbl<PlayerRow>;
      pairs: Tbl<PairRow>;
      groups: Tbl<GroupRow>;
      payments: Tbl<PaymentRow>;
      matches: Tbl<MatchRow>;
      sets: Tbl<SetRow>;
      match_reports: Tbl<MatchReportRow>;
      match_reschedule_proposals: Tbl<RescheduleProposalRow>;
      pair_finance_entries: Tbl<PairFinanceEntryRow>;
      sponsors: Tbl<SponsorRow>;
      audit_log: Tbl<AuditLogRow>;
      club_settings: Tbl<ClubSettingsRow>;
      interest_subscriptions: Tbl<InterestSubscriptionRow>;
      captain_devices: Tbl<CaptainDeviceRow>;
      sponsor_requests: Tbl<SponsorRequestRow>;
      tournament_budget_entries: Tbl<TournamentBudgetEntryRow>;
      issue_reports: Tbl<IssueReportRow>;
    };
    Views: {
      category_standings: { Row: CategoryStandingsRow; Relationships: [] };
      public_player_names: {
        Row: { id: string; last_name: string | null; first_name: string | null };
        Relationships: [];
      };
    };
    Functions: {
      current_active_fee: {
        Args: { p_tournament_id: string; p_at?: string };
        Returns: TournamentFeeRow[];
      };
      generate_payment_reference: {
        Args: { p_pair_id: string; p_payer_player_id: string; p_mode: 'per_pair' | 'per_player' };
        Returns: string;
      };
      run_draw: {
        Args: { p_category_id: string; p_seed?: number };
        Returns: { group_id: string; group_label: string; pair_count: number }[];
      };
      reset_draw: {
        Args: { p_category_id: string };
        Returns: number;
      };
      generate_knockout: {
        Args: { p_category_id: string };
        Returns: string;
      };
      schedule_match: {
        Args: { p_match_id: string; p_scheduled_at: string; p_court_label: string };
        Returns: undefined;
      };
      bulk_schedule_matches: {
        Args: { p_assignments: Json };
        Returns: number;
      };
      submit_match_report: {
        Args: { p_match_id: string; p_score: Json };
        Returns: string;
      };
      propose_reschedule: {
        Args: {
          p_match_id: string;
          p_new_scheduled_at: string;
          p_new_court_label: string | null;
          p_message?: string | null;
        };
        Returns: string;
      };
      respond_to_reschedule: {
        Args: { p_proposal_id: string; p_accept: boolean };
        Returns: string;
      };
      cancel_reschedule: {
        Args: { p_proposal_id: string };
        Returns: string;
      };
      admin_set_walkover: {
        Args: { p_match_id: string; p_winner_pair_id: string; p_reason?: string | null };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: 'anon' | 'captain' | 'admin';
      payment_method: 'bizum' | 'transfer';
      payment_status: 'pending' | 'paid' | 'refunded' | 'cancelled';
      pair_status: 'draft' | 'pending_payment' | 'confirmed' | 'withdrawn' | 'disqualified';
      match_status: 'scheduled' | 'pending_validation' | 'validated' | 'disputed' | 'walkover';
      fee_mode: 'per_pair' | 'per_player';
      reschedule_status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
      finance_entry_kind: 'income' | 'expense';
      sponsor_tier: 'gold' | 'silver' | 'bronze' | 'collaborator';
      sponsor_request_status: 'pending' | 'approved' | 'rejected';
      budget_entry_kind: BudgetEntryKind;
      budget_entry_category: BudgetEntryCategory;
      issue_report_severity: IssueReportSeverity;
      issue_report_status: IssueReportStatus;
      tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
    };
    CompositeTypes: Record<string, never>;
  };
};
