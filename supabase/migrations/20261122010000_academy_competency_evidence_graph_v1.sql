-- Competency graph: disciplinary anchoring, assessment evidence and learner mastery.
begin;

create table if not exists public.academy_competency_domains (
 competency_id uuid not null references public.academy_competencies(id) on delete cascade,
 domain_code text not null references public.domains(code) on delete restrict,
 is_primary boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(competency_id,domain_code)
);
create unique index if not exists academy_competency_domains_one_primary_idx
 on public.academy_competency_domains(competency_id) where is_primary;

create table if not exists public.academy_assessment_competencies (
 assessment_id uuid not null references public.academy_assessments(id) on delete cascade,
 competency_id uuid not null references public.academy_competencies(id) on delete restrict,
 expected_level text not null default 'FOUNDATION'
  check(expected_level in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT')),
 minimum_score numeric(5,2) not null default 70 check(minimum_score between 0 and 100),
 created_at timestamptz not null default now(),
 primary key(assessment_id,competency_id)
);

create table if not exists public.academy_competency_evidence (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 competency_id uuid not null references public.academy_competencies(id) on delete restrict,
 assessment_id uuid not null references public.academy_assessments(id) on delete restrict,
 attempt_id uuid not null references public.academy_assessment_attempts(id) on delete restrict,
 assessed_level text not null check(assessed_level in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT')),
 evidence_status text not null check(evidence_status in ('DEMONSTRATED','NOT_DEMONSTRATED')),
 score numeric(5,2) not null check(score between 0 and 100),
 created_at timestamptz not null default now(),
 unique(attempt_id,competency_id)
);
create index if not exists academy_competency_evidence_user_idx
 on public.academy_competency_evidence(user_id,competency_id,created_at desc);
create index if not exists academy_assessment_competencies_competency_idx
 on public.academy_assessment_competencies(competency_id);

alter table public.academy_competency_domains enable row level security;
alter table public.academy_assessment_competencies enable row level security;
alter table public.academy_competency_evidence enable row level security;

drop policy if exists "Academy users can read published competency domains" on public.academy_competency_domains;
create policy "Academy users can read published competency domains" on public.academy_competency_domains
 for select to authenticated using (
  exists(select 1 from public.academy_competencies c where c.id=competency_id and c.status='PUBLISHED' and c.visibility in ('PUBLIC','DISCOVERABLE'))
  and exists(select 1 from public.domains d where d.code=domain_code and d.status='PUBLISHED' and d.visibility in ('PUBLIC','DISCOVERABLE'))
  or public.academy_is_editorial_member()
 );
drop policy if exists "Academy users can read published assessment competency maps" on public.academy_assessment_competencies;
create policy "Academy users can read published assessment competency maps" on public.academy_assessment_competencies
 for select to authenticated using (
  exists(select 1 from public.academy_assessments a where a.id=assessment_id and a.status='PUBLISHED' and a.visibility in ('PUBLIC','DISCOVERABLE'))
  and exists(select 1 from public.academy_competencies c where c.id=competency_id and c.status='PUBLISHED' and c.visibility in ('PUBLIC','DISCOVERABLE'))
  or public.academy_is_editorial_member()
 );
drop policy if exists "Learners can read their own competency evidence" on public.academy_competency_evidence;
create policy "Learners can read their own competency evidence" on public.academy_competency_evidence
 for select to authenticated using(user_id=auth.uid());

revoke all on public.academy_competency_domains from anon,authenticated;
revoke all on public.academy_assessment_competencies from anon,authenticated;
revoke all on public.academy_competency_evidence from anon,authenticated;
grant select on public.academy_competency_domains,public.academy_assessment_competencies,public.academy_competency_evidence to authenticated;

create or replace function public.academy_save_competency_domains(p_competency_id uuid,p_domain_codes text[])
returns void language plpgsql security definer set search_path='' as $function$
declare v_code text; v_count integer:=0;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_competency_id is null or p_domain_codes is null or cardinality(p_domain_codes)>30 then
  raise exception 'Competency and a domain array of at most 30 entries are required' using errcode='22023';
 end if;
 if not exists(select 1 from public.academy_competencies where id=p_competency_id and status='DRAFT') then
  raise exception 'Draft competency not found' using errcode='P0002';
 end if;
 if cardinality(p_domain_codes)<> (select count(distinct x) from unnest(p_domain_codes) x) then
  raise exception 'Duplicate domain code' using errcode='22023';
 end if;
 if cardinality(p_domain_codes)>0 then
  foreach v_code in array p_domain_codes loop
   v_count:=v_count+1;
   if not exists(select 1 from public.domains d join public.departments p on p.code=d.department_code
    where d.code=v_code and d.status<>'ARCHIVED' and p.status<>'ARCHIVED') then
    raise exception 'Unknown or archived domain: %',v_code using errcode='23503';
   end if;
  end loop;
 end if;
 delete from public.academy_competency_domains where competency_id=p_competency_id;
 if cardinality(p_domain_codes)>0 then
  insert into public.academy_competency_domains(competency_id,domain_code,is_primary)
  select p_competency_id,x,ordinality=1 from unnest(p_domain_codes) with ordinality as u(x,ordinality);
 end if;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)
 select auth.uid(),'SKILL',c.id,c.code,'UPDATED',
  jsonb_build_object('domain_codes',to_jsonb(coalesce(p_domain_codes,array[]::text[]))),
  'Competency disciplinary anchors updated'
 from public.academy_competencies c where c.id=p_competency_id;
end;$function$;

create or replace function public.academy_save_assessment_competencies(p_assessment_id uuid,p_mappings jsonb)
returns void language plpgsql security definer set search_path='' as $function$
declare v_mapping jsonb; v_competency_id uuid; v_level text; v_score numeric; v_count integer:=0;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_assessment_id is null or coalesce(jsonb_typeof(p_mappings),'')<>'array' or jsonb_array_length(p_mappings)>50 then
  raise exception 'Assessment mappings must be an array of at most 50 entries' using errcode='22023';
 end if;
 if not exists(select 1 from public.academy_assessments where id=p_assessment_id and status='DRAFT') then
  raise exception 'Draft assessment not found' using errcode='P0002';
 end if;
 delete from public.academy_assessment_competencies where assessment_id=p_assessment_id;
 for v_mapping in select value from jsonb_array_elements(p_mappings) loop
  v_count:=v_count+1;
  begin v_competency_id:=(v_mapping->>'competency_id')::uuid; exception when others then raise exception 'Invalid competency_id in mapping %',v_count using errcode='22023'; end;
  v_level:=coalesce(v_mapping->>'expected_level','FOUNDATION');
  begin v_score:=coalesce((v_mapping->>'minimum_score')::numeric,70); exception when others then raise exception 'Invalid minimum_score in mapping %',v_count using errcode='22023'; end;
  if v_level not in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT') or v_score<0 or v_score>100 then
   raise exception 'Invalid competency level or score in mapping %',v_count using errcode='22023';
  end if;
  if not exists(select 1 from public.academy_competencies where id=v_competency_id and status='PUBLISHED') then
   raise exception 'Only published competencies can be assessed' using errcode='23503';
  end if;
  insert into public.academy_assessment_competencies(assessment_id,competency_id,expected_level,minimum_score)
  values(p_assessment_id,v_competency_id,v_level,v_score);
 end loop;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)
 select auth.uid(),'ASSESSMENT',a.id,a.code,'ASSESSMENT_SAVED',
  jsonb_build_object('competency_mappings',p_mappings),'Assessment competency mapping updated'
 from public.academy_assessments a where a.id=p_assessment_id;
end;$function$;

create or replace view public.academy_learner_competency_mastery
with (security_invoker=true) as
select e.user_id,e.competency_id,c.code competency_code,c.title competency_title,
 max(case e.assessed_level when 'INTRODUCTORY' then 1 when 'FOUNDATION' then 2 when 'INTERMEDIATE' then 3 when 'ADVANCED' then 4 when 'EXPERT' then 5 else 0 end)
  filter(where e.evidence_status='DEMONSTRATED') as demonstrated_level_rank,
 (array_agg(e.assessed_level order by case e.assessed_level when 'INTRODUCTORY' then 1 when 'FOUNDATION' then 2 when 'INTERMEDIATE' then 3 when 'ADVANCED' then 4 when 'EXPERT' then 5 else 0 end desc,e.created_at desc)
  filter(where e.evidence_status='DEMONSTRATED'))[1] as demonstrated_level,
 count(*) as evidence_count,
 count(*) filter(where e.evidence_status='DEMONSTRATED') as demonstrated_evidence_count,
 max(e.score) as best_score,
 max(e.created_at) as last_evidence_at
from public.academy_competency_evidence e
join public.academy_competencies c on c.id=e.competency_id
group by e.user_id,e.competency_id,c.code,c.title;

revoke all on function public.academy_save_competency_domains(uuid,text[]) from public,anon;
grant execute on function public.academy_save_competency_domains(uuid,text[]) to authenticated;
revoke all on function public.academy_save_assessment_competencies(uuid,jsonb) from public,anon;
grant execute on function public.academy_save_assessment_competencies(uuid,jsonb) to authenticated;
grant select on public.academy_learner_competency_mastery to authenticated;

-- Extend the existing server-side assessment submit function without changing its grading rules.
do $migration$
declare v_old text; v_new text;
begin
 select pg_get_functiondef('public.academy_submit_assessment(uuid,jsonb)'::regprocedure) into v_old;
 v_new:=replace(v_old,
  E' where id=p_attempt_id;\n return jsonb_build_object(',
  E' where id=p_attempt_id;\n insert into public.academy_competency_evidence(user_id,competency_id,assessment_id,attempt_id,assessed_level,evidence_status,score)\n select v_user,m.competency_id,v_attempt.assessment_id,p_attempt_id,m.expected_level,case when v_score>=m.minimum_score then ''DEMONSTRATED'' else ''NOT_DEMONSTRATED'' end,v_score\n from public.academy_assessment_competencies m where m.assessment_id=v_attempt.assessment_id;\n return jsonb_build_object('
 );
 if v_new=v_old then raise exception 'Could not safely extend academy_submit_assessment'; end if;
 execute v_new;
end;$migration$;

commit;