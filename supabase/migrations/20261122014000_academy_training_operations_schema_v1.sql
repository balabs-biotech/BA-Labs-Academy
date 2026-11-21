-- BA Labs Academy: operational training architecture (schema foundation)
create table if not exists public.academy_training_partners (
  id uuid primary key default gen_random_uuid(),
  partner_code text not null unique check (partner_code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  legal_name text not null check (length(btrim(legal_name)) between 2 and 200),
  approval_number text,
  approval_authority text,
  approval_valid_from date,
  approval_valid_until date,
  approved_specialties text[] not null default '{}',
  approved_delivery_modes text[] not null default '{}',
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','SUSPENDED','EXPIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approval_valid_until is null or approval_valid_from is null or approval_valid_until >= approval_valid_from)
);

create table if not exists public.academy_training_agreements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.academy_training_partners(id),
  agreement_code text not null unique check (agreement_code ~ '^[A-Z0-9][A-Z0-9._-]{1,59}$'),
  agreement_title text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','SUSPENDED','EXPIRED','TERMINATED')),
  valid_from date,
  valid_until date,
  permitted_specialties text[] not null default '{}',
  permitted_venues text[] not null default '{}',
  permitted_delivery_modes text[] not null default '{}',
  billing_responsibility text not null default 'UNDECIDED' check (billing_responsibility in ('BA_LABS','PARTNER','SPLIT','UNDECIDED')),
  document_issuer text not null default 'UNDECIDED' check (document_issuer in ('BA_LABS_PRIVATE','PARTNER','UNDECIDED')),
  signed_at date,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table if not exists public.academy_training_offerings (
  id uuid primary key default gen_random_uuid(),
  offering_code text not null unique check (offering_code ~ '^[A-Z0-9][A-Z0-9._-]{1,59}$'),
  title text not null check (length(btrim(title)) between 2 and 200),
  description text not null default '',
  specialty_code text not null,
  audience_profile text not null default 'MIXED' check (audience_profile in ('PUBLIC','PROFESSIONAL','MIXED')),
  delivery_regime text not null check (delivery_regime in ('PRIVATE_WORKSHOP','PARTNER_DELIVERED','APPROVED_ESTABLISHMENT')),
  partner_id uuid references public.academy_training_partners(id),
  agreement_id uuid references public.academy_training_agreements(id),
  default_duration_days numeric(4,1) check (default_duration_days > 0 and default_duration_days <= 90),
  default_capacity integer not null default 10 check (default_capacity between 1 and 100),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (delivery_regime='PRIVATE_WORKSHOP' and partner_id is null and agreement_id is null)
    or
    (delivery_regime in ('PARTNER_DELIVERED','APPROVED_ESTABLISHMENT') and partner_id is not null and agreement_id is not null)
  )
);

create table if not exists public.academy_training_sessions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.academy_training_offerings(id),
  session_code text not null unique check (session_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_code text not null,
  delivery_mode text not null check (delivery_mode in ('IN_PERSON','HYBRID','DISTANCE','ALTERNATING')),
  capacity integer not null check (capacity between 1 and 100),
  status text not null default 'DRAFT' check (status in ('DRAFT','OPEN','FULL','CLOSED','CANCELLED','COMPLETED')),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registration_closes_at is null or registration_opens_at is null or registration_closes_at >= registration_opens_at)
);

create table if not exists public.academy_training_enrollments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academy_training_sessions(id),
  user_id uuid references auth.users(id),
  participant_name text not null,
  participant_email text not null,
  participant_category text not null default 'OTHER' check (participant_category in ('STUDENT','EMPLOYEE','SELF_EMPLOYED','JOB_SEEKER','OTHER')),
  enrollment_status text not null default 'PENDING' check (enrollment_status in ('PENDING','CONFIRMED','WAITLISTED','CANCELLED','COMPLETED','NO_SHOW')),
  contract_reference text,
  invoice_reference text,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, participant_email)
);

create table if not exists public.academy_training_attendance (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_training_enrollments(id),
  training_date date not null,
  attendance_status text not null check (attendance_status in ('PRESENT','LATE','ABSENT','EXCUSED')),
  attended_minutes integer not null default 0 check (attended_minutes >= 0),
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  note text,
  unique(enrollment_id, training_date)
);

create table if not exists public.academy_training_documents (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_training_enrollments(id),
  document_code text not null unique,
  document_type text not null check (document_type in ('PARTICIPATION_ATTESTATION','PRACTICAL_COMPLETION_ATTESTATION','INTERNAL_ASSESSMENT_RECORD','PARTNER_CERTIFICATE','STATE_RECOGNIZED_CERTIFICATE')),
  issuer_kind text not null check (issuer_kind in ('BA_LABS_PRIVATE','APPROVED_PARTNER','PUBLIC_AUTHORITY')),
  issuer_name text not null,
  issuer_reference text,
  title text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  verification_token_hash text not null unique,
  created_by uuid references auth.users(id),
  check ((revoked_at is null and revocation_reason is null) or (revoked_at is not null and length(btrim(coalesce(revocation_reason,''))) > 0)),
  check (
    (document_type in ('PARTICIPATION_ATTESTATION','PRACTICAL_COMPLETION_ATTESTATION','INTERNAL_ASSESSMENT_RECORD') and issuer_kind='BA_LABS_PRIVATE')
    or
    (document_type='PARTNER_CERTIFICATE' and issuer_kind='APPROVED_PARTNER')
    or
    (document_type='STATE_RECOGNIZED_CERTIFICATE' and issuer_kind in ('APPROVED_PARTNER','PUBLIC_AUTHORITY'))
  )
);

create table if not exists public.academy_training_billing_records (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_training_enrollments(id),
  billing_owner text not null check (billing_owner in ('BA_LABS','PARTNER')),
  external_invoice_reference text not null,
  currency_code char(3) not null default 'DZD',
  amount_minor_units bigint not null check (amount_minor_units >= 0),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PARTIALLY_PAID','PAID','REFUNDED','CANCELLED')),
  accounting_note text,
  recorded_at timestamptz not null default now(),
  unique(billing_owner, external_invoice_reference)
);

create index if not exists academy_training_sessions_offering_idx on public.academy_training_sessions(offering_id, starts_at desc);
create index if not exists academy_training_enrollments_session_idx on public.academy_training_enrollments(session_id, enrollment_status);
create index if not exists academy_training_attendance_enrollment_idx on public.academy_training_attendance(enrollment_id, training_date);
create index if not exists academy_training_documents_enrollment_idx on public.academy_training_documents(enrollment_id, issued_at desc);
create index if not exists academy_training_billing_enrollment_idx on public.academy_training_billing_records(enrollment_id);

do $$
declare t text;
begin
  foreach t in array array[
    'academy_training_partners','academy_training_agreements','academy_training_offerings',
    'academy_training_sessions','academy_training_enrollments','academy_training_attendance',
    'academy_training_documents','academy_training_billing_records'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('drop policy if exists "Academy editorial members can read training operations" on public.%I',t);
    execute format(
      'create policy "Academy editorial members can read training operations" on public.%I for select to authenticated using (exists (select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status=''ACTIVE'' and m.role in (''OWNER'',''ADMIN'',''EDITOR'',''REVIEWER'')))',
      t
    );
  end loop;
end $$;

drop policy if exists "Learners can read own training enrollment" on public.academy_training_enrollments;
create policy "Learners can read own training enrollment" on public.academy_training_enrollments
for select to authenticated using (user_id=auth.uid());

drop policy if exists "Learners can read own training documents" on public.academy_training_documents;
create policy "Learners can read own training documents" on public.academy_training_documents
for select to authenticated using (
  exists (select 1 from public.academy_training_enrollments e where e.id=enrollment_id and e.user_id=auth.uid())
);

-- All writes are deliberately routed through future validated RPCs.
