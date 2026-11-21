begin;
revoke all privileges on table
 public.academy_program_node_competencies,
 public.academy_program_node_resources,
 public.academy_program_node_assessments,
 public.academy_program_node_paths
from public, anon, authenticated;
grant select on table
 public.academy_program_node_competencies,
 public.academy_program_node_resources,
 public.academy_program_node_assessments,
 public.academy_program_node_paths
to anon, authenticated;

drop policy if exists "Public can read published programme node competencies" on public.academy_program_node_competencies;
create policy "Public can read published programme node competencies" on public.academy_program_node_competencies
 for select to anon,authenticated using(
  exists(select 1 from public.academy_programs p
   where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null)
  and exists(select 1 from public.academy_competencies c
   where c.id=competency_id and c.status='PUBLISHED' and c.visibility='PUBLIC')
 );

drop policy if exists "Public can read published programme node resources" on public.academy_program_node_resources;
create policy "Public can read published programme node resources" on public.academy_program_node_resources
 for select to anon,authenticated using(
  exists(select 1 from public.academy_programs p
   where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null)
  and exists(select 1 from public.content_items c
   where c.id=content_id and c.status='PUBLISHED' and c.editorial_status='PUBLISHED' and c.visibility='PUBLIC')
 );

drop policy if exists "Public can read published programme node assessments" on public.academy_program_node_assessments;
create policy "Public can read published programme node assessments" on public.academy_program_node_assessments
 for select to anon,authenticated using(
  exists(select 1 from public.academy_programs p
   where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null)
  and exists(select 1 from public.academy_assessments a
   where a.id=assessment_id and a.status='PUBLISHED' and a.visibility='PUBLIC' and a.published_at is not null)
 );
commit;