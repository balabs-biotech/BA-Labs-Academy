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
commit;