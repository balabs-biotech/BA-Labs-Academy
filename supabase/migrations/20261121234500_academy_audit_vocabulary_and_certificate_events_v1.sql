-- Extend the shared editorial audit vocabulary for governance, assessments and certificates.
alter table public.academy_editorial_events drop constraint if exists academy_editorial_events_entity_type_check;
alter table public.academy_editorial_events add constraint academy_editorial_events_entity_type_check
check(entity_type in ('CONTENT_ITEM','DEPARTMENT','DOMAIN','ATLAS_NODE','ATLAS_EDGE','MEMBERSHIP','ASSESSMENT','CERTIFICATE'));
alter table public.academy_editorial_events drop constraint if exists academy_editorial_events_action_check;
alter table public.academy_editorial_events add constraint academy_editorial_events_action_check
check(action in ('CREATED','UPDATED','SUBMITTED_FOR_REVIEW','APPROVED','CHANGES_REQUESTED','PUBLISHED',
 'MEMBER_CREATED','MEMBER_UPDATED','ASSESSMENT_SAVED','ASSESSMENT_PUBLISHED','CERTIFICATE_ISSUED'));

create or replace function public.academy_issue_path_certificate(p_path_id uuid) returns text
language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=auth.uid(); v_path public.academy_learning_paths%rowtype; v_missing integer; v_missing_assessments integer;
 v_existing text; v_code text; v_snapshot jsonb; v_certificate_id uuid;
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
  'required_steps',(select count(*) from public.academy_learning_path_items where path_id=p_path_id and is_required),
  'assessment_results',coalesce((select jsonb_agg(jsonb_build_object('assessment_id',pa.assessment_id,'minimum_score',pa.minimum_score,
   'best_score',(select max(a.score) from public.academy_assessment_attempts a where a.user_id=v_user and a.assessment_id=pa.assessment_id and a.status='SUBMITTED')))
   from public.academy_path_assessments pa where pa.path_id=p_path_id and pa.is_required),'[]'::jsonb));
 insert into public.academy_certificates(certificate_code,user_id,path_id,path_version,certificate_title,result_snapshot)
 values(v_code,v_user,p_path_id,v_path.version_label,v_path.title,v_snapshot)
 on conflict(user_id,path_id,path_version) do update set revoked_at=null
 returning id,certificate_code into v_certificate_id,v_code;
 update public.academy_path_enrollments set enrollment_status='COMPLETED',completed_at=coalesce(completed_at,now()),updated_at=now()
 where user_id=v_user and path_id=p_path_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)
 values(v_user,'CERTIFICATE',v_certificate_id,v_code,'CERTIFICATE_ISSUED',v_snapshot,'Certificate issued after server-side pathway validation');
 return v_code;
end;$function$;
revoke all on function public.academy_issue_path_certificate(uuid) from public,anon;
grant execute on function public.academy_issue_path_certificate(uuid) to authenticated;
