-- Declaración de salud (apto físico) + contacto de emergencia por jugador.
-- Requisito legal pre-inscripciones 2026.

alter table public.players
  add column if not exists health_declaration_signed boolean not null default false,
  add column if not exists health_declaration_signed_at timestamptz,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

comment on column public.players.health_declaration_signed is
  'true cuando el jugador ha aceptado la declaración de aptitud física + exoneración de responsabilidad';
comment on column public.players.health_declaration_signed_at is
  'Timestamp del momento en que se aceptó la declaración';
comment on column public.players.emergency_contact_name is
  'Persona de contacto en caso de incidente durante un partido';
comment on column public.players.emergency_contact_phone is
  'Teléfono del contacto de emergencia';
