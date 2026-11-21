begin;
create table if not exists public.academy_program_node_paths (
 program_id uuid not null,
 program_node_id uuid not null,
 learning_path_id uuid not null references public.academy_learning_paths(id) on delete restrict,
 path_role text not null default 'CORE'
  check(path_role in ('CORE','REINFORCEMENT','OPTIONAL','PREPARATION')),
 sort_order integer not null default 1 check(sort_order>0),
 is_required boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(program_node_id,learning_path_id),
 foreign key(program_id,program_node_id)
  references public.academy_program_nodes(program_id,id) on delete cascade
);
create unique index if not exists academy_program_node_paths_order_unique
 on public.academy_program_node_paths(program_node_id,sort_order);
alter table public.academy_program_node_paths enable row level security;
drop policy if exists "Editors can read programme node paths" on public.academy_program_node_paths;
create policy "Editors can read programme node paths" on public.academy_program_node_paths
 for select to authenticated using(public.academy_is_editorial_member());
drop policy if exists "Public can read published programme node paths" on public.academy_program_node_paths;
create policy "Public can read published programme node paths" on public.academy_program_node_paths
 for select to anon,authenticated using(exists(
  select 1 from public.academy_programs p join public.academy_learning_paths lp on lp.id=learning_path_id
  where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null
   and lp.status='PUBLISHED' and lp.visibility='PUBLIC' and lp.published_at is not null
 ));
grant select on public.academy_program_node_paths to anon,authenticated;
comment on table public.academy_program_node_paths is 'Links curriculum nodes to reusable learning paths without duplicating their sequence or resources.';
commit;
