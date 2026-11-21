-- Harden JSON validation and set-returning function aliases in assessment RPCs.
create or replace function public.academy_save_assessment_editorial(
 p_assessment_id uuid,p_code text,p_title text,p_description text,p_pass_score numeric,
 p_max_attempts integer,p_time_limit_minutes integer,p_version_label text,p_questions jsonb
) returns uuid language plpgsql security definer set search_path='' as $function$
declare v_id uuid; v_q jsonb; v_opt jsonb; v_question_id uuid; v_option_id uuid; v_qn integer:=0; v_on integer; v_correct_count integer;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if coalesce(trim(p_code),'')='' or coalesce(trim(p_title),'')='' or p_pass_score is null or p_pass_score<0 or p_pass_score>100
  or (p_max_attempts is not null and p_max_attempts<1) or (p_time_limit_minutes is not null and p_time_limit_minutes<1)
  or coalesce(jsonb_typeof(p_questions),'')<>'array' or jsonb_array_length(p_questions)<1 then
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
  if coalesce(trim(v_q->>'prompt'),'')='' or coalesce(jsonb_typeof(v_q->'options'),'')<>'array' or jsonb_array_length(v_q->'options')<2
   or coalesce(jsonb_typeof(v_q->'correct_option_indexes'),'')<>'array' or jsonb_array_length(v_q->'correct_option_indexes')<>1 then
   raise exception 'Each single-choice question needs a prompt, at least two options and exactly one correct answer' using errcode='22023';
  end if;
  insert into public.academy_assessment_questions(assessment_id,prompt,sort_order) values(v_id,trim(v_q->>'prompt'),v_qn) returning id into v_question_id;
  v_on:=0; v_correct_count:=0;
  for v_opt in select value from jsonb_array_elements(v_q->'options') loop
   v_on:=v_on+1;
   if coalesce(trim(v_opt#>>'{}'),'')='' then raise exception 'Option text cannot be empty' using errcode='22023'; end if;
   insert into public.academy_assessment_options(question_id,option_text,sort_order) values(v_question_id,trim(v_opt#>>'{}'),v_on) returning id into v_option_id;
   if exists(select 1 from jsonb_array_elements_text(v_q->'correct_option_indexes') as x(value) where x.value::integer=v_on-1) then
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

create or replace function public.academy_submit_assessment(p_attempt_id uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=auth.uid(); v_attempt public.academy_assessment_attempts%rowtype; v_assessment public.academy_assessments%rowtype;
 v_q record; v_answer jsonb; v_selected jsonb; v_correct jsonb; v_is_correct boolean; v_total integer:=0; v_correct_total integer:=0; v_score numeric(5,2); v_passed boolean;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if coalesce(jsonb_typeof(p_answers),'')<>'array' then raise exception 'Answers must be a JSON array' using errcode='22023'; end if;
 select * into v_attempt from public.academy_assessment_attempts where id=p_attempt_id and user_id=v_user for update;
 if not found or v_attempt.status<>'IN_PROGRESS' then raise exception 'Active attempt not found' using errcode='P0002'; end if;
 select * into v_assessment from public.academy_assessments where id=v_attempt.assessment_id;
 if v_assessment.time_limit_minutes is not null and now()>v_attempt.started_at+make_interval(mins=>v_assessment.time_limit_minutes) then
  update public.academy_assessment_attempts set status='EXPIRED',submitted_at=now() where id=p_attempt_id;
  return jsonb_build_object('attempt_id',p_attempt_id,'status','EXPIRED','passed',false,'score',0);
 end if;
 for v_answer in select value from jsonb_array_elements(p_answers) loop
  if not (v_answer ? 'question_id') or coalesce(jsonb_typeof(v_answer->'option_ids'),'')<>'array' then raise exception 'Malformed answer payload' using errcode='22023'; end if;
  if not exists(select 1 from public.academy_assessment_questions q where q.id=(v_answer->>'question_id')::uuid and q.assessment_id=v_attempt.assessment_id) then
   raise exception 'Answer contains a question outside this assessment' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_answers) as x(value) where x.value->>'question_id'=v_answer->>'question_id' group by x.value->>'question_id' having count(*)>1) then
   raise exception 'Duplicate question answer' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements_text(v_answer->'option_ids') as x(value) where not exists(
   select 1 from public.academy_assessment_options o join public.academy_assessment_questions q on q.id=o.question_id
   where o.id=x.value::uuid and q.id=(v_answer->>'question_id')::uuid)) then
   raise exception 'Answer contains an option outside its question' using errcode='22023';
  end if;
 end loop;
 for v_q in select q.id from public.academy_assessment_questions q where q.assessment_id=v_attempt.assessment_id order by q.sort_order loop
  v_total:=v_total+1;
  select x.value into v_answer from jsonb_array_elements(p_answers) as x(value) where x.value->>'question_id'=v_q.id::text limit 1;
  v_selected:=coalesce(v_answer->'option_ids','[]'::jsonb);
  select coalesce(jsonb_agg(k.option_id::text order by k.option_id::text),'[]'::jsonb) into v_correct
   from public.academy_assessment_answer_keys k where k.question_id=v_q.id;
  select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb) into v_selected
   from jsonb_array_elements_text(v_selected) as x(value);
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
