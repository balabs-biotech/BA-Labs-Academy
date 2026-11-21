-- Assessment engine and pathway certification foundation.
create table if not exists public.academy_assessments (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 title text not null,
 description text not null default '',
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
 visibility text not null default 'PUBLIC' check(visibility in ('PUBLIC','DISCOVERABLE','RESTRICTED','INTERNAL')),
 pass_score numeric(5,2) not null default 70 check(pass_score between 0 and 100),
 max_attempts integer check(max_attempts is null or max_attempts between 1 and 100),
 time_limit_minutes integer check(time_limit_minutes is null or time_limit_minutes between 1 and 1440),
 version_label text not null default '0.1',
 created_by uuid references auth.users(id) on delete set null,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.academy_assessment_questions (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academy_assessments(id) on delete cascade,
 prompt text not null,
 sort_order integer not null check(sort_order>0),
 question_type text not null default 'SINGLE_CHOICE' check(question_type='SINGLE_CHOICE'),
 created_at timestamptz not null default now(),
 unique(assessment_id,sort_order),
 unique(assessment_id,id)
);
create table if not exists public.academy_assessment_options (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.academy_assessment_questions(id) on delete cascade,
 option_text text not null,
 sort_order integer not null check(sort_order>0),
 created_at timestamptz not null default now(),
 unique(question_id,sort_order),
 unique(question_id,id)
);
create table if not exists public.academy_assessment_answer_keys (
 question_id uuid not null references public.academy_assessment_questions(id) on delete cascade,
 option_id uuid not null references public.academy_assessment_options(id) on delete cascade,
 primary key(question_id,option_id)
);
create table if not exists public.academy_assessment_attempts (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academy_assessments(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 attempt_number integer not null check(attempt_number>0),
 assessment_version text not null,
 status text not null default 'IN_PROGRESS' check(status in ('IN_PROGRESS','SUBMITTED','EXPIRED')),
 score numeric(5,2),
 passed boolean,
 question_count integer,
 correct_count integer,
 started_at timestamptz not null default now(),
 submitted_at timestamptz,
 unique(assessment_id,user_id,attempt_number)
);
create table if not exists public.academy_assessment_responses (
 attempt_id uuid not null references public.academy_assessment_attempts(id) on delete cascade,
 question_id uuid not null references public.academy_assessment_questions(id) on delete restrict,
 selected_option_ids jsonb not null default '[]'::jsonb check(jsonb_typeof(selected_option_ids)='array'),
 is_correct boolean not null default false,
 primary key(attempt_id,question_id)
);
create table if not exists public.academy_path_assessments (
 path_id uuid not null references public.academy_learning_paths(id) on delete cascade,
 assessment_id uuid not null references public.academy_assessments(id) on delete restrict,
 sort_order integer not null default 1 check(sort_order>0),
 is_required boolean not null default true,
 minimum_score numeric(5,2) not null default 70 check(minimum_score between 0 and 100),
 created_at timestamptz not null default now(),
 primary key(path_id,assessment_id),
 unique(path_id,sort_order)
);
create table if not exists public.academy_certificates (
 id uuid primary key default gen_random_uuid(),
 certificate_code text not null unique,
 user_id uuid not null references auth.users(id) on delete cascade,
 path_id uuid not null references public.academy_learning_paths(id) on delete restrict,
 path_version text not null,
 certificate_title text not null,
 result_snapshot jsonb not null default '{}'::jsonb,
 issued_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique(user_id,path_id,path_version)
);

create index if not exists academy_assessments_public_idx on public.academy_assessments(status,visibility);
create index if not exists academy_assessment_questions_order_idx on public.academy_assessment_questions(assessment_id,sort_order);
create index if not exists academy_assessment_options_order_idx on public.academy_assessment_options(question_id,sort_order);
create index if not exists academy_assessment_attempts_user_idx on public.academy_assessment_attempts(user_id,assessment_id,attempt_number desc);
create index if not exists academy_path_assessments_path_idx on public.academy_path_assessments(path_id,sort_order);
create index if not exists academy_certificates_user_idx on public.academy_certificates(user_id,issued_at desc);

alter table public.academy_assessments enable row level security;
alter table public.academy_assessment_questions enable row level security;
alter table public.academy_assessment_options enable row level security;
alter table public.academy_assessment_answer_keys enable row level security;
alter table public.academy_assessment_attempts enable row level security;
alter table public.academy_assessment_responses enable row level security;
alter table public.academy_path_assessments enable row level security;
alter table public.academy_certificates enable row level security;

create policy "Public can read published assessments" on public.academy_assessments
for select to anon,authenticated using(status='PUBLISHED' and visibility='PUBLIC');
create policy "Editors can read assessment drafts" on public.academy_assessments
for select to authenticated using(exists(select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')));
create policy "Public can read published assessment questions" on public.academy_assessment_questions
for select to anon,authenticated using(exists(select 1 from public.academy_assessments a where a.id=assessment_id and a.status='PUBLISHED' and a.visibility='PUBLIC'));
create policy "Public can read published assessment options" on public.academy_assessment_options
for select to anon,authenticated using(exists(select 1 from public.academy_assessment_questions q join public.academy_assessments a on a.id=q.assessment_id where q.id=question_id and a.status='PUBLISHED' and a.visibility='PUBLIC'));
create policy "Members can read own assessment attempts" on public.academy_assessment_attempts
for select to authenticated using(user_id=auth.uid());
create policy "Members can read own assessment responses" on public.academy_assessment_responses
for select to authenticated using(exists(select 1 from public.academy_assessment_attempts t where t.id=attempt_id and t.user_id=auth.uid()));
create policy "Public can read published path assessment links" on public.academy_path_assessments
for select to anon,authenticated using(exists(select 1 from public.academy_learning_paths p join public.academy_assessments a on a.id=assessment_id where p.id=path_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and a.status='PUBLISHED' and a.visibility='PUBLIC'));
create policy "Members can read own certificates" on public.academy_certificates
for select to authenticated using(user_id=auth.uid());

revoke all on public.academy_assessment_answer_keys from public,anon,authenticated;
revoke insert,update,delete on public.academy_assessments,public.academy_assessment_questions,public.academy_assessment_options,public.academy_assessment_attempts,public.academy_assessment_responses,public.academy_path_assessments,public.academy_certificates from anon,authenticated;
grant select on public.academy_assessments,public.academy_assessment_questions,public.academy_assessment_options,public.academy_path_assessments to anon,authenticated;
grant select on public.academy_assessment_attempts,public.academy_assessment_responses,public.academy_certificates to authenticated;

create or replace function public.academy_save_assessment_editorial(
 p_assessment_id uuid,p_code text,p_title text,p_description text,p_pass_score numeric,
 p_max_attempts integer,p_time_limit_minutes integer,p_version_label text,p_questions jsonb
) returns uuid language plpgsql security definer set search_path='' as $function$
declare v_id uuid; v_q jsonb; v_opt jsonb; v_question_id uuid; v_option_id uuid; v_qn integer:=0; v_on integer; v_idx integer; v_correct_count integer;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if coalesce(trim(p_code),'')='' or coalesce(trim(p_title),'')='' or p_pass_score is null or p_pass_score<0 or p_pass_score>100
  or (p_max_attempts is not null and p_max_attempts<1) or (p_time_limit_minutes is not null and p_time_limit_minutes<1)
  or jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<1 then
  raise exception 'Invalid assessment metadata or empty question set' using errcode='22023';
 end if;
 if p_assessment_id is null then
  insert into public.academy_assessments(code,title,description,pass_score,max_attempts,time_limit_minutes,version_label,created_by)
  values(upper(trim(p_code)),trim(p_title),coalesce(p_description,''),p_pass_score,p_max_attempts,p_time_limit_minutes,coalesce(nullif(trim(p_version_label),''),'0.1'),auth.uid())
  returning id into v_id;
 else
  select id into v_id from public.academy_assessments where id=p_assessment_id and status='DRAFT' for update;
  if v_id is null then raise exception 'Only draft assessments can be edited' using errcode='42501'; end if;
  update public.academy_assessments set code=upper(trim(p_code)),title=trim(p_title),description=coalesce(p_description,''),pass_score=p_pass_score,
   max_attempts=p_max_attempts,time_limit_minutes=p_time_limit_minutes,version_label=coalesce(nullif(trim(p_version_label),''),'0.1'),updated_at=now()
  where id=v_id;
  delete from public.academy_assessment_questions where assessment_id=v_id;
 end if;
 for v_q in select value from jsonb_array_elements(p_questions) loop
  v_qn:=v_qn+1;
  if coalesce(trim(v_q->>'prompt'),'')='' or jsonb_typeof(v_q->'options')<>'array' or jsonb_array_length(v_q->'options')<2
   or jsonb_typeof(v_q->'correct_option_indexes')<>'array' or jsonb_array_length(v_q->'correct_option_indexes')<>1 then
   raise exception 'Each single-choice question needs a prompt, at least two options and exactly one correct answer' using errcode='22023';
  end if;
  insert into public.academy_assessment_questions(assessment_id,prompt,sort_order) values(v_id,trim(v_q->>'prompt'),v_qn) returning id into v_question_id;
  v_on:=0; v_correct_count:=0;
  for v_opt in select value from jsonb_array_elements(v_q->'options') loop
   v_on:=v_on+1;
   if coalesce(trim(v_opt#>>'{}'),'')='' then raise exception 'Option text cannot be empty' using errcode='22023'; end if;
   insert into public.academy_assessment_options(question_id,option_text,sort_order) values(v_question_id,trim(v_opt#>>'{}'),v_on) returning id into v_option_id;
   if exists(select 1 from jsonb_array_elements_text(v_q->'correct_option_indexes') x where x::integer=v_on-1) then
    insert into public.academy_assessment_answer_keys(question_id,option_id) values(v_question_id,v_option_id);
    v_correct_count:=v_correct_count+1;
   end if;
  end loop;
  if v_correct_count<>1 then raise exception 'Correct option index is outside the available options' using errcode='22023'; end if;
 end loop;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)
 values(auth.uid(),'ASSESSMENT',v_id,p_code,'ASSESSMENT_SAVED',jsonb_build_object('title',p_title,'question_count',v_qn),'Draft assessment saved');
 return v_id;
end;$function$;
revoke all on function public.academy_save_assessment_editorial(uuid,text,text,text,numeric,integer,integer,text,jsonb) from public,anon;
grant execute on function public.academy_save_assessment_editorial(uuid,text,text,text,numeric,integer,integer,text,jsonb) to authenticated;

create or replace function public.academy_publish_assessment(p_assessment_id uuid,p_note text default '') returns void
language plpgsql security definer set search_path='' as $function$
declare v_count integer; v_invalid integer;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 select count(*) into v_count from public.academy_assessment_questions where assessment_id=p_assessment_id;
 select count(*) into v_invalid from public.academy_assessment_questions q where q.assessment_id=p_assessment_id and
  ((select count(*) from public.academy_assessment_options o where o.question_id=q.id)<2 or
   (select count(*) from public.academy_assessment_answer_keys k where k.question_id=q.id)<>1);
 if v_count<1 or v_invalid>0 then raise exception 'Assessment needs valid questions and answer keys before publication' using errcode='23514'; end if;
 update public.academy_assessments set status='PUBLISHED',published_at=now(),updated_at=now()
 where id=p_assessment_id and status='DRAFT';
 if not found then raise exception 'Draft assessment not found' using errcode='P0002'; end if;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)
 select auth.uid(),'ASSESSMENT',id,code,'ASSESSMENT_PUBLISHED',jsonb_build_object('version',version_label,'question_count',v_count),left(coalesce(p_note,''),1000)
 from public.academy_assessments where id=p_assessment_id;
end;$function$;
revoke all on function public.academy_publish_assessment(uuid,text) from public,anon;
grant execute on function public.academy_publish_assessment(uuid,text) to authenticated;

create or replace function public.academy_start_assessment(p_assessment_id uuid) returns uuid
language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=auth.uid(); v_assessment public.academy_assessments%rowtype; v_count integer; v_attempt_id uuid;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_assessment from public.academy_assessments where id=p_assessment_id and status='PUBLISHED' and visibility='PUBLIC' for update;
 if not found then raise exception 'Published assessment not found' using errcode='P0002'; end if;
 select count(*) into v_count from public.academy_assessment_attempts where assessment_id=p_assessment_id and user_id=v_user;
 if v_assessment.max_attempts is not null and v_count>=v_assessment.max_attempts then raise exception 'Maximum number of attempts reached' using errcode='42501'; end if;
 insert into public.academy_assessment_attempts(assessment_id,user_id,attempt_number,assessment_version)
 values(p_assessment_id,v_user,v_count+1,v_assessment.version_label) returning id into v_attempt_id;
 return v_attempt_id;
end;$function$;
revoke all on function public.academy_start_assessment(uuid) from public,anon;
grant execute on function public.academy_start_assessment(uuid) to authenticated;

create or replace function public.academy_submit_assessment(p_attempt_id uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=auth.uid(); v_attempt public.academy_assessment_attempts%rowtype; v_assessment public.academy_assessments%rowtype;
 v_q record; v_answer jsonb; v_selected jsonb; v_correct jsonb; v_is_correct boolean; v_total integer:=0; v_correct_total integer:=0; v_score numeric(5,2); v_passed boolean;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(p_answers)<>'array' then raise exception 'Answers must be a JSON array' using errcode='22023'; end if;
 select * into v_attempt from public.academy_assessment_attempts where id=p_attempt_id and user_id=v_user for update;
 if not found or v_attempt.status<>'IN_PROGRESS' then raise exception 'Active attempt not found' using errcode='P0002'; end if;
 select * into v_assessment from public.academy_assessments where id=v_attempt.assessment_id;
 if v_assessment.time_limit_minutes is not null and now()>v_attempt.started_at+make_interval(mins=>v_assessment.time_limit_minutes) then
  update public.academy_assessment_attempts set status='EXPIRED',submitted_at=now() where id=p_attempt_id;
  return jsonb_build_object('attempt_id',p_attempt_id,'status','EXPIRED','passed',false,'score',0);
 end if;
 for v_answer in select value from jsonb_array_elements(p_answers) loop
  if not (v_answer ? 'question_id') or jsonb_typeof(v_answer->'option_ids')<>'array' then raise exception 'Malformed answer payload' using errcode='22023'; end if;
  if not exists(select 1 from public.academy_assessment_questions q where q.id=(v_answer->>'question_id')::uuid and q.assessment_id=v_attempt.assessment_id) then
   raise exception 'Answer contains a question outside this assessment' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_answers) x where x->>'question_id'=v_answer->>'question_id' group by x->>'question_id' having count(*)>1) then
   raise exception 'Duplicate question answer' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements_text(v_answer->'option_ids') x where not exists(
   select 1 from public.academy_assessment_options o join public.academy_assessment_questions q on q.id=o.question_id
   where o.id=x::uuid and q.id=(v_answer->>'question_id')::uuid)) then raise exception 'Answer contains an option outside its question' using errcode='22023'; end if;
 end loop;
 for v_q in select q.id from public.academy_assessment_questions q where q.assessment_id=v_attempt.assessment_id order by q.sort_order loop
  v_total:=v_total+1;
  select value into v_answer from jsonb_array_elements(p_answers) where value->>'question_id'=v_q.id::text limit 1;
  v_selected:=coalesce(v_answer->'option_ids','[]'::jsonb);
  select coalesce(jsonb_agg(k.option_id::text order by k.option_id::text),'[]'::jsonb) into v_correct
   from public.academy_assessment_answer_keys k where k.question_id=v_q.id;
  select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb) into v_selected
   from jsonb_array_elements_text(v_selected) x;
  v_is_correct:=v_selected=v_correct;
  if v_is_correct then v_correct_total:=v_correct_total+1; end if;
  insert into public.academy_assessment_responses(attempt_id,question_id,selected_option_ids,is_correct)
  values(p_attempt_id,v_q.id,coalesce(v_answer->'option_ids','[]'::jsonb),v_is_correct);
 end loop;
 v_score:=round((v_correct_total::numeric/nullif(v_total,0))*100,2);
 v_passed:=v_score>=v_assessment.pass_score;
 update public.academy_assessment_attempts set status='SUBMITTED',score=v_score,passed=v_passed,question_count=v_total,correct_count=v_correct_total,submitted_at=now()
 where id=p_attempt_id;
 return jsonb_build_object('attempt_id',p_attempt_id,'status','SUBMITTED','score',v_score,'passed',v_passed,'question_count',v_total,'correct_count',v_correct_total);
end;$function$;
revoke all on function public.academy_submit_assessment(uuid,jsonb) from public,anon;
grant execute on function public.academy_submit_assessment(uuid,jsonb) to authenticated;

create or replace function public.academy_save_path_assessments(p_path_id uuid,p_requirements jsonb) returns void
language plpgsql security definer set search_path='' as $function$
declare v_req jsonb; v_order integer:=0; v_assessment_id uuid; v_score numeric;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if jsonb_typeof(p_requirements)<>'array' then raise exception 'Requirements must be an array' using errcode='22023'; end if;
 if not exists(select 1 from public.academy_learning_paths where id=p_path_id and status='DRAFT') then raise exception 'Only draft pathways can be configured' using errcode='42501'; end if;
 delete from public.academy_path_assessments where path_id=p_path_id;
 for v_req in select value from jsonb_array_elements(p_requirements) loop
  v_order:=v_order+1; v_assessment_id:=(v_req->>'assessment_id')::uuid; v_score:=coalesce((v_req->>'minimum_score')::numeric,70);
  if not exists(select 1 from public.academy_assessments where id=v_assessment_id and status='PUBLISHED') then raise exception 'Only published assessments can be linked to a pathway' using errcode='23503'; end if;
  insert into public.academy_path_assessments(path_id,assessment_id,sort_order,is_required,minimum_score)
  values(p_path_id,v_assessment_id,v_order,coalesce((v_req->>'is_required')::boolean,true),v_score);
 end loop;
end;$function$;
revoke all on function public.academy_save_path_assessments(uuid,jsonb) from public,anon;
grant execute on function public.academy_save_path_assessments(uuid,jsonb) to authenticated;

create or replace function public.academy_issue_path_certificate(p_path_id uuid) returns text
language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=auth.uid(); v_path public.academy_learning_paths%rowtype; v_missing integer; v_missing_assessments integer; v_existing text; v_code text; v_snapshot jsonb;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_path from public.academy_learning_paths where id=p_path_id and status='PUBLISHED' and visibility='PUBLIC';
 if not found then raise exception 'Published pathway not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.academy_path_enrollments where user_id=v_user and path_id=p_path_id and enrollment_status in ('ACTIVE','COMPLETED')) then
  raise exception 'Active pathway enrollment required' using errcode='42501';
 end if;
 select count(*) into v_missing from public.academy_learning_path_items i
 where i.path_id=p_path_id and i.is_required and not exists(
  select 1 from public.academy_path_item_progress p where p.user_id=v_user and p.path_item_id=i.id and p.progress_status='COMPLETED');
 if v_missing>0 then raise exception 'Required learning steps remain incomplete' using errcode='23514'; end if;
 select count(*) into v_missing_assessments from public.academy_path_assessments pa
 where pa.path_id=p_path_id and pa.is_required and not exists(
  select 1 from public.academy_assessment_attempts a where a.user_id=v_user and a.assessment_id=pa.assessment_id
   and a.status='SUBMITTED' and a.passed and a.score>=pa.minimum_score);
 if v_missing_assessments>0 then raise exception 'Required assessment results are missing or below threshold' using errcode='23514'; end if;
 select certificate_code into v_existing from public.academy_certificates where user_id=v_user and path_id=p_path_id and path_version=v_path.version_label and revoked_at is null;
 if v_existing is not null then return v_existing; end if;
 v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,20));
 v_snapshot:=jsonb_build_object('path_code',v_path.code,'path_title',v_path.title,'path_version',v_path.version_label,
  'required_steps', (select count(*) from public.academy_learning_path_items where path_id=p_path_id and is_required),
  'assessment_results',(select coalesce(jsonb_agg(jsonb_build_object('assessment_id',pa.assessment_id,'minimum_score',pa.minimum_score,
   'best_score',(select max(a.score) from public.academy_assessment_attempts a where a.user_id=v_user and a.assessment_id=pa.assessment_id and a.status='SUBMITTED')), '[]'::jsonb)
   from public.academy_path_assessments pa where pa.path_id=p_path_id and pa.is_required));
 insert into public.academy_certificates(certificate_code,user_id,path_id,path_version,certificate_title,result_snapshot)
 values(v_code,v_user,p_path_id,v_path.version_label,v_path.title,v_snapshot)
 on conflict(user_id,path_id,path_version) do update set revoked_at=null
 returning certificate_code into v_code;
 update public.academy_path_enrollments set enrollment_status='COMPLETED',completed_at=coalesce(completed_at,now()),updated_at=now()
 where user_id=v_user and path_id=p_path_id;
 return v_code;
end;$function$;
revoke all on function public.academy_issue_path_certificate(uuid) from public,anon;
grant execute on function public.academy_issue_path_certificate(uuid) to authenticated;

create or replace function public.academy_verify_certificate(p_certificate_code text)
returns table(certificate_code text,certificate_title text,path_version text,issued_at timestamptz,valid boolean)
language sql stable security definer set search_path='' as $function$
 select c.certificate_code,c.certificate_title,c.path_version,c.issued_at,(c.revoked_at is null)
 from public.academy_certificates c where c.certificate_code=upper(trim(p_certificate_code));
$function$;
revoke all on function public.academy_verify_certificate(text) from public;
grant execute on function public.academy_verify_certificate(text) to anon,authenticated;
