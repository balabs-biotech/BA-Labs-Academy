create table public.academy_learning_paths (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  target_audience text not null default '',
  difficulty_level text not null default 'FOUNDATION'
    check (difficulty_level in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED')),
  estimated_duration_minutes integer
    check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  visibility text not null default 'INTERNAL'
    check (visibility in ('PUBLIC','DISCOVERABLE','RESTRICTED','INTERNAL')),
  version_label text not null default '0.1',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_learning_path_items (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.academy_learning_paths(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete restrict,
  sort_order integer not null check (sort_order > 0),
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (path_id, content_id),
  unique (path_id, sort_order),
  unique (path_id, id)
);

create table public.academy_path_item_prerequisites (
  path_id uuid not null,
  item_id uuid not null,
  prerequisite_item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (path_id, item_id, prerequisite_item_id),
  foreign key (path_id, item_id)
    references public.academy_learning_path_items(path_id, id) on delete cascade,
  foreign key (path_id, prerequisite_item_id)
    references public.academy_learning_path_items(path_id, id) on delete cascade,
  check (item_id <> prerequisite_item_id)
);

create table public.academy_competencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  competency_level text not null default 'FOUNDATION'
    check (competency_level in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  visibility text not null default 'INTERNAL'
    check (visibility in ('PUBLIC','DISCOVERABLE','RESTRICTED','INTERNAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_content_competencies (
  content_id uuid not null references public.content_items(id) on delete cascade,
  competency_id uuid not null references public.academy_competencies(id) on delete cascade,
  expected_level text not null default 'FOUNDATION'
    check (expected_level in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT')),
  assessment_hint text not null default '',
  created_at timestamptz not null default now(),
  primary key (content_id, competency_id)
);

create table public.academy_path_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id uuid not null references public.academy_learning_paths(id) on delete cascade,
  enrollment_status text not null default 'ACTIVE'
    check (enrollment_status in ('ACTIVE','PAUSED','COMPLETED')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, path_id)
);

create table public.academy_member_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  progress_status text not null default 'NOT_STARTED'
    check (progress_status in ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
  progress_percent numeric(5,2) not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

create index academy_learning_path_items_content_idx
  on public.academy_learning_path_items(content_id);
create index academy_path_item_prerequisites_item_idx
  on public.academy_path_item_prerequisites(path_id, item_id);
create index academy_content_competencies_competency_idx
  on public.academy_content_competencies(competency_id);
create index academy_path_enrollments_path_idx
  on public.academy_path_enrollments(path_id, enrollment_status);
create index academy_member_progress_content_idx
  on public.academy_member_progress(content_id, progress_status);

alter table public.academy_learning_paths enable row level security;
alter table public.academy_learning_path_items enable row level security;
alter table public.academy_path_item_prerequisites enable row level security;
alter table public.academy_competencies enable row level security;
alter table public.academy_content_competencies enable row level security;
alter table public.academy_path_enrollments enable row level security;
alter table public.academy_member_progress enable row level security;

create policy "Public can read published academy paths"
  on public.academy_learning_paths for select to anon, authenticated
  using (status = 'PUBLISHED' and visibility = 'PUBLIC' and published_at is not null);

create policy "Public can read items in published academy paths"
  on public.academy_learning_path_items for select to anon, authenticated
  using (
    exists (
      select 1 from public.academy_learning_paths p
      where p.id = path_id
        and p.status = 'PUBLISHED'
        and p.visibility = 'PUBLIC'
        and p.published_at is not null
    )
    and exists (
      select 1 from public.content_items c
      where c.id = content_id
        and c.status = 'PUBLISHED'
        and c.editorial_status = 'PUBLISHED'
        and c.visibility = 'PUBLIC'
    )
  );

create policy "Public can read prerequisites for published paths"
  on public.academy_path_item_prerequisites for select to anon, authenticated
  using (
    exists (
      select 1 from public.academy_learning_paths p
      where p.id = path_id
        and p.status = 'PUBLISHED'
        and p.visibility = 'PUBLIC'
        and p.published_at is not null
    )
    and exists (
      select 1 from public.academy_learning_path_items i
      where i.path_id = path_id and i.id = item_id
    )
    and exists (
      select 1 from public.academy_learning_path_items i
      where i.path_id = path_id and i.id = prerequisite_item_id
    )
  );

create policy "Public can read competencies linked to public content"
  on public.academy_competencies for select to anon, authenticated
  using (
    status = 'PUBLISHED'
    and visibility = 'PUBLIC'
    and exists (
      select 1
      from public.academy_content_competencies cc
      join public.content_items c on c.id = cc.content_id
      where cc.competency_id = id
        and c.status = 'PUBLISHED'
        and c.editorial_status = 'PUBLISHED'
        and c.visibility = 'PUBLIC'
    )
  );

create policy "Public can read competency links for public content"
  on public.academy_content_competencies for select to anon, authenticated
  using (
    exists (
      select 1 from public.content_items c
      where c.id = content_id
        and c.status = 'PUBLISHED'
        and c.editorial_status = 'PUBLISHED'
        and c.visibility = 'PUBLIC'
    )
  );

create policy "Members can read their own path enrollments"
  on public.academy_path_enrollments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Members can enroll in public paths"
  on public.academy_path_enrollments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.academy_learning_paths p
      where p.id = path_id
        and p.status = 'PUBLISHED'
        and p.visibility = 'PUBLIC'
        and p.published_at is not null
    )
  );

create policy "Members can update their own path enrollments"
  on public.academy_path_enrollments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.academy_learning_paths p
      where p.id = path_id
        and p.status = 'PUBLISHED'
        and p.visibility = 'PUBLIC'
        and p.published_at is not null
    )
  );

create policy "Members can read their own learning progress"
  on public.academy_member_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Members can create their own learning progress"
  on public.academy_member_progress for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.content_items c
      where c.id = content_id
        and c.status = 'PUBLISHED'
        and c.editorial_status = 'PUBLISHED'
        and c.visibility = 'PUBLIC'
    )
  );

create policy "Members can update their own learning progress"
  on public.academy_member_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.content_items c
      where c.id = content_id
        and c.status = 'PUBLISHED'
        and c.editorial_status = 'PUBLISHED'
        and c.visibility = 'PUBLIC'
    )
  );

grant select on public.academy_learning_paths,
  public.academy_learning_path_items,
  public.academy_path_item_prerequisites,
  public.academy_competencies,
  public.academy_content_competencies
  to anon, authenticated;

grant select, insert, update on public.academy_path_enrollments,
  public.academy_member_progress
  to authenticated;

revoke all on public.academy_learning_paths,
  public.academy_learning_path_items,
  public.academy_path_item_prerequisites,
  public.academy_competencies,
  public.academy_content_competencies
  from anon, authenticated;

grant select on public.academy_learning_paths,
  public.academy_learning_path_items,
  public.academy_path_item_prerequisites,
  public.academy_competencies,
  public.academy_content_competencies
  to anon, authenticated;

revoke all on public.academy_path_enrollments,
  public.academy_member_progress
  from anon;

grant select, insert, update on public.academy_path_enrollments,
  public.academy_member_progress
  to authenticated;
