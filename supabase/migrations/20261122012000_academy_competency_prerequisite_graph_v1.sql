-- Competency prerequisite graph with cycle prevention and Atlas REQUIRES edges.
begin;
create table if not exists public.academy_competency_prerequisites (
 competency_id uuid not null references public.academy_competencies(id) on delete cascade,
 prerequisite_competency_id uuid not null references public.academy_competencies(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(competency_id,prerequisite_competency_id),
 check(competency_id<>prerequisite_competency_id)
);
create index if not exists academy_competency_prerequisites_prerequisite_idx
 on public.academy_competency_prerequisites(prerequisite_competency_id);
alter table public.academy_competency_prerequisites enable row level security;
drop policy if exists "Academy users can read published competency prerequisites" on public.academy_competency_prerequisites;
create policy "Academy users can read published competency prerequisites" on public.academy_competency_prerequisites
 for select to authenticated using (
  exists(select 1 from public.academy_competencies c where c.id=competency_id and c.status='PUBLISHED' and c.visibility in ('PUBLIC','DISCOVERABLE'))
  and exists(select 1 from public.academy_competencies p where p.id=prerequisite_competency_id and p.status='PUBLISHED' and p.visibility in ('PUBLIC','DISCOVERABLE'))
  or public.academy_is_editorial_member()
 );
revoke all on public.academy_competency_prerequisites from anon,authenticated;
grant select on public.academy_competency_prerequisites to authenticated;

create or replace function public.academy_save_competency_prerequisites(p_competency_id uuid,p_prerequisite_ids uuid[])
returns void language plpgsql security definer set search_path='' as $function$
declare v_prerequisite_id uuid; v_skill_node uuid; v_count integer:=0;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_competency_id is null or p_prerequisite_ids is null or cardinality(p_prerequisite_ids)>50 then
  raise exception 'Competency and a prerequisite array of at most 50 entries are required' using errcode='22023';
 end if;
 if not exists(select 1 from public.academy_competencies where id=p_competency_id and status='DRAFT') then
  raise exception 'Draft competency not found' using errcode='P0002';
 end if;
 if cardinality(p_prerequisite_ids)<>(select count(distinct x) from unnest(p_prerequisite_ids) x) then
  raise exception 'Duplicate prerequisite competency' using errcode='22023';
 end if;
 if p_competency_id=any(p_prerequisite_ids) then raise exception 'A competency cannot require itself' using errcode='22023'; end if;
 if exists(select 1 from unnest(p_prerequisite_ids) x left join public.academy_competencies c on c.id=x where c.id is null or c.status<>'PUBLISHED') then
  raise exception 'Prerequisites must be published competencies' using errcode='23503';
 end if;
 if exists(
  with recursive dependency_chain(id) as (
   select unnest(p_prerequisite_ids)
   union
   select cp.prerequisite_competency_id from public.academy_competency_prerequisites cp
   join dependency_chain dc on cp.competency_id=dc.id
  )
  select 1 from dependency_chain where id=p_competency_id
 ) then raise exception 'Competency prerequisite cycle detected' using errcode='23514'; end if;

 select n.id into v_skill_node from public.atlas_nodes n join public.academy_competencies c on c.code=n.entity_key
 where c.id=p_competency_id and n.entity_type='SKILL' for update;
 if v_skill_node is null then raise exception 'Matching Atlas skill node is missing' using errcode='23514'; end if;
 delete from public.academy_competency_prerequisites where competency_id=p_competency_id;
 if cardinality(p_prerequisite_ids)>0 then
  insert into public.academy_competency_prerequisites(competency_id,prerequisite_competency_id)
  select p_competency_id,x from unnest(p_prerequisite_ids) x;
 end if;
 delete from public.atlas_edges where source_node_id=v_skill_node and relation_type='REQUIRES' and status='DRAFT';
 insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status)
 select v_skill_node,n.id,'REQUIRES','Prérequis de compétence : maîtrise préalable requise.','DRAFT'
 from public.academy_competency_prerequisites cp
 join public.academy_competencies c on c.id=cp.competency_id
 join public.atlas_nodes n on n.entity_type='SKILL' and n.entity_key=(select p.code from public.academy_competencies p where p.id=cp.prerequisite_competency_id)
 where cp.competency_id=p_competency_id
 on conflict(source_node_id,target_node_id,relation_type) do update set rationale=excluded.rationale,status='DRAFT';
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)
 select auth.uid(),'SKILL',c.id,c.code,'UPDATED',
  jsonb_build_object('prerequisite_competency_ids',to_jsonb(coalesce(p_prerequisite_ids,array[]::uuid[]))),
  'Competency prerequisite graph updated'
 from public.academy_competencies c where c.id=p_competency_id;
end;$function$;

revoke all on function public.academy_save_competency_prerequisites(uuid,uuid[]) from public,anon;
grant execute on function public.academy_save_competency_prerequisites(uuid,uuid[]) to authenticated;

do $migration$
declare v_old text; v_new text;
begin
 select pg_get_functiondef('public.academy_publish_competency(uuid,text,text)'::regprocedure) into v_old;
 v_new:=replace(v_old,
  E' select n.id into v_node_id from public.atlas_nodes n where n.entity_type=''SKILL''',
  E' if exists(select 1 from public.academy_competency_prerequisites cp join public.academy_competencies p on p.id=cp.prerequisite_competency_id where cp.competency_id=p_competency_id and p.status<>''PUBLISHED'') then\n  raise exception ''All competency prerequisites must be published first'' using errcode=''23514'';\n end if;\n select n.id into v_node_id from public.atlas_nodes n where n.entity_type=''SKILL'''
 );
 if v_new=v_old then raise exception 'Could not safely enforce published competency prerequisites'; end if;
 execute v_new;
end;$migration$;
commit;