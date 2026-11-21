begin;

-- Curriculum mapping remains empty until programme blueprints are approved.
-- Each structural node can later declare intended competencies, learning resources and assessments.
create table if not exists public.academy_program_node_competencies (
 program_id uuid not null,
 program_node_id uuid not null,
 competency_id uuid not null references public.academy_competencies(id) on delete restrict,
 expected_level text not null default 'FOUNDATION'
  check(expected_level in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT')),
 minimum_score numeric(5,2) not null default 70 check(minimum_score between 0 and 100),
 is_core boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(program_node_id,competency_id),
 foreign key(program_id,program_node_id)
  references public.academy_program_nodes(program_id,id) on delete cascade
);

create table if not exists public.academy_program_node_resources (
 program_id uuid not null,
 program_node_id uuid not null,
 content_id uuid not null references public.content_items(id) on delete restrict,
 resource_role text not null default 'CORE'
  check(resource_role in ('CORE','SUPPORTING','PRACTICAL','REFERENCE','OPTIONAL')),
 sort_order integer not null default 1 check(sort_order>0),
 is_required boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(program_node_id,content_id),
 foreign key(program_id,program_node_id)
  references public.academy_program_nodes(program_id,id) on delete cascade
);
create unique index if not exists academy_program_node_resources_order_unique
 on public.academy_program_node_resources(program_node_id,sort_order);

create table if not exists public.academy_program_node_assessments (
 program_id uuid not null,
 program_node_id uuid not null,
 assessment_id uuid not null references public.academy_assessments(id) on delete restrict,
 assessment_role text not null default 'FORMATIVE'
  check(assessment_role in ('ENTRY','FORMATIVE','SUMMATIVE','CERTIFICATION')),
 sort_order integer not null default 1 check(sort_order>0),
 is_required boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(program_node_id,assessment_id),
 foreign key(program_id,program_node_id)
  references public.academy_program_nodes(program_id,id) on delete cascade
);
create unique index if not exists academy_program_node_assessments_order_unique
 on public.academy_program_node_assessments(program_node_id,sort_order);

-- A training offer can represent an entire programme or a specific curriculum node.
alter table public.academy_training_offerings
 add column if not exists program_id uuid references public.academy_programs(id) on delete restrict,
 add column if not exists program_node_id uuid;
do $block$
begin
 if not exists(select 1 from pg_constraint where conname='academy_training_offering_program_node_fk') then
  alter table public.academy_training_offerings
   add constraint academy_training_offering_program_node_fk
   foreign key(program_id,program_node_id)
   references public.academy_program_nodes(program_id,id) on delete restrict;
 end if;
 if not exists(select 1 from pg_constraint where conname='academy_training_offering_program_node_check') then
  alter table public.academy_training_offerings
   add constraint academy_training_offering_program_node_check
   check(program_node_id is null or program_id is not null);
 end if;
end;$block$;
create index if not exists academy_training_offerings_program_idx
 on public.academy_training_offerings(program_id) where program_id is not null;

alter table public.academy_program_node_competencies enable row level security;
alter table public.academy_program_node_resources enable row level security;
alter table public.academy_program_node_assessments enable row level security;

drop policy if exists "Editors can read programme node competencies" on public.academy_program_node_competencies;
create policy "Editors can read programme node competencies" on public.academy_program_node_competencies
 for select to authenticated using(public.academy_is_editorial_member());
drop policy if exists "Public can read published programme node competencies" on public.academy_program_node_competencies;
create policy "Public can read published programme node competencies" on public.academy_program_node_competencies
 for select to anon,authenticated using(exists(select 1 from public.academy_programs p where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null));

drop policy if exists "Editors can read programme node resources" on public.academy_program_node_resources;
create policy "Editors can read programme node resources" on public.academy_program_node_resources
 for select to authenticated using(public.academy_is_editorial_member());
drop policy if exists "Public can read published programme node resources" on public.academy_program_node_resources;
create policy "Public can read published programme node resources" on public.academy_program_node_resources
 for select to anon,authenticated using(exists(select 1 from public.academy_programs p join public.content_items c on c.id=content_id where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null and c.status='PUBLISHED'));

drop policy if exists "Editors can read programme node assessments" on public.academy_program_node_assessments;
create policy "Editors can read programme node assessments" on public.academy_program_node_assessments
 for select to authenticated using(public.academy_is_editorial_member());
drop policy if exists "Public can read published programme node assessments" on public.academy_program_node_assessments;
create policy "Public can read published programme node assessments" on public.academy_program_node_assessments
 for select to anon,authenticated using(exists(select 1 from public.academy_programs p where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null));

grant select on public.academy_program_node_competencies,public.academy_program_node_resources,public.academy_program_node_assessments to anon,authenticated;

comment on table public.academy_program_node_competencies is 'Expected competency outcomes mapped to structural programme nodes; no course content.';
comment on table public.academy_program_node_resources is 'Future links from programme nodes to separately authored Academy resources.';
comment on table public.academy_program_node_assessments is 'Assessment blueprint links for programme nodes; question authoring remains separate.';
comment on column public.academy_training_offerings.program_id is 'Optional curriculum programme represented by this training offer.';
comment on column public.academy_training_offerings.program_node_id is 'Optional curriculum node delivered by this training offer.';

commit;
