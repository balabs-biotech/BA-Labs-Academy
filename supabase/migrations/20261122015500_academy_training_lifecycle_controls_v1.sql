create or replace function public.academy_enroll_training_session(p_session_id uuid,p_participant_name text,p_participant_email text,p_participant_category text default 'OTHER')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.academy_training_sessions%rowtype; v_count integer; v_id uuid; v_auth_email text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select lower(email) into v_auth_email from auth.users where id=auth.uid();
 if p_session_id is null or nullif(btrim(p_participant_name),'') is null or nullif(btrim(p_participant_email),'') is null then raise exception 'Session, participant name and email are required' using errcode='22023'; end if;
 if lower(btrim(p_participant_email))<>coalesce(v_auth_email,'') then raise exception 'Registration email must match the authenticated account' using errcode='42501'; end if;
 if p_participant_category not in ('STUDENT','EMPLOYEE','SELF_EMPLOYED','JOB_SEEKER','OTHER') then raise exception 'Invalid participant category' using errcode='22023'; end if;
 select * into v_session from public.academy_training_sessions where id=p_session_id for update;
 if not found or v_session.status<>'OPEN' then raise exception 'Session is not open for registration' using errcode='23514'; end if;
 if v_session.registration_opens_at is not null and now()<v_session.registration_opens_at then raise exception 'Registration has not opened' using errcode='23514'; end if;
 if v_session.registration_closes_at is not null and now()>v_session.registration_closes_at then raise exception 'Registration is closed' using errcode='23514'; end if;
 if exists(select 1 from public.academy_training_enrollments where session_id=p_session_id and lower(participant_email)=lower(btrim(p_participant_email)) and enrollment_status not in ('CANCELLED')) then raise exception 'Participant already registered' using errcode='23505'; end if;
 select count(*) into v_count from public.academy_training_enrollments where session_id=p_session_id and enrollment_status in ('PENDING','CONFIRMED','COMPLETED');
 if v_count>=v_session.capacity then
  insert into public.academy_training_enrollments(session_id,user_id,participant_name,participant_email,participant_category,enrollment_status)
  values(p_session_id,auth.uid(),btrim(p_participant_name),lower(btrim(p_participant_email)),p_participant_category,'WAITLISTED') returning id into v_id;
 else
  insert into public.academy_training_enrollments(session_id,user_id,participant_name,participant_email,participant_category,enrollment_status)
  values(p_session_id,auth.uid(),btrim(p_participant_name),lower(btrim(p_participant_email)),p_participant_category,'PENDING') returning id into v_id;
 end if;
 return v_id;
end; $$;

create or replace function public.academy_set_training_status(p_entity_type text,p_entity_id uuid,p_new_status text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; v_key text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_entity_type='OFFERING' then
  select to_jsonb(o) into v_old from public.academy_training_offerings o where id=p_entity_id for update;
  if v_old is null then raise exception 'Training offering not found' using errcode='P0002'; end if;
  if p_new_status not in ('ACTIVE','ARCHIVED','DRAFT') then raise exception 'Invalid offering status' using errcode='22023'; end if;
  if p_new_status='ACTIVE' and (select delivery_regime from public.academy_training_offerings where id=p_entity_id)<>'PRIVATE_WORKSHOP' then
   if not exists(select 1 from public.academy_training_offerings o join public.academy_training_partners p on p.id=o.partner_id join public.academy_training_agreements a on a.id=o.agreement_id where o.id=p_entity_id and p.status='ACTIVE' and a.status='ACTIVE' and p.approval_number is not null and (p.approval_valid_from is null or p.approval_valid_from<=current_date) and (p.approval_valid_until is null or p.approval_valid_until>=current_date) and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date)) then raise exception 'Partner approval and agreement must be active and valid to activate offering' using errcode='23514'; end if;
  end if;
  update public.academy_training_offerings set status=p_new_status,updated_at=now() where id=p_entity_id;
  select offering_code into v_key from public.academy_training_offerings where id=p_entity_id;
  select to_jsonb(o) into v_new from public.academy_training_offerings o where id=p_entity_id;
 elsif p_entity_type='SESSION' then
  select to_jsonb(s) into v_old from public.academy_training_sessions s where id=p_entity_id for update;
  if v_old is null then raise exception 'Training session not found' using errcode='P0002'; end if;
  if p_new_status not in ('OPEN','CLOSED','CANCELLED','COMPLETED','DRAFT') then raise exception 'Invalid session status' using errcode='22023'; end if;
  if p_new_status='OPEN' and not exists(select 1 from public.academy_training_sessions s join public.academy_training_offerings o on o.id=s.offering_id where s.id=p_entity_id and o.status='ACTIVE') then raise exception 'Session requires an active offering' using errcode='23514'; end if;
  if p_new_status='OPEN' and (select count(*) from public.academy_training_enrollments where session_id=p_entity_id and enrollment_status in ('PENDING','CONFIRMED','COMPLETED')) >= (select capacity from public.academy_training_sessions where id=p_entity_id) then raise exception 'Session capacity is already reached' using errcode='23514'; end if;
  update public.academy_training_sessions set status=p_new_status,updated_at=now() where id=p_entity_id;
  select session_code into v_key from public.academy_training_sessions where id=p_entity_id;
  select to_jsonb(s) into v_new from public.academy_training_sessions s where id=p_entity_id;
 else
  raise exception 'Entity type must be OFFERING or SESSION' using errcode='22023';
 end if;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(auth.uid(),'TRAINING_'||p_entity_type,p_entity_id,v_key,'STATUS_CHANGED',v_old,v_new,left(coalesce(p_note,''),1000));
end; $$;

revoke all on function public.academy_set_training_status(text,uuid,text,text) from public,anon;
grant execute on function public.academy_set_training_status(text,uuid,text,text) to authenticated;
