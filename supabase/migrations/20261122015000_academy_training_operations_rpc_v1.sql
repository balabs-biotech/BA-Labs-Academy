-- Validated RPC layer for Academy training operations.
create or replace function public.academy_save_training_offering(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_id uuid; v_code text; v_title text; v_specialty text; v_regime text;
 v_partner uuid; v_agreement uuid; v_old jsonb; v_new jsonb;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid offering payload' using errcode='22023'; end if;
 v_code:=nullif(btrim(p_payload->>'offering_code'),'');
 v_title:=nullif(btrim(p_payload->>'title'),'');
 v_specialty:=nullif(btrim(p_payload->>'specialty_code'),'');
 v_regime:=p_payload->>'delivery_regime';
 if v_code is null or v_code !~ '^[A-Z0-9][A-Z0-9._-]{1,59}$' or v_title is null or v_specialty is null then raise exception 'Offering code, title and specialty are required' using errcode='22023'; end if;
 if v_regime not in ('PRIVATE_WORKSHOP','PARTNER_DELIVERED','APPROVED_ESTABLISHMENT') then raise exception 'Invalid delivery regime' using errcode='22023'; end if;
 v_partner:=nullif(p_payload->>'partner_id','')::uuid;
 v_agreement:=nullif(p_payload->>'agreement_id','')::uuid;
 if v_regime='PRIVATE_WORKSHOP' then
  if v_partner is not null or v_agreement is not null then raise exception 'Private workshop cannot reference partner agreement' using errcode='22023'; end if;
 else
  if v_partner is null or v_agreement is null or not exists(
    select 1 from public.academy_training_partners p join public.academy_training_agreements a on a.partner_id=p.id
    where p.id=v_partner and a.id=v_agreement and p.status='ACTIVE' and a.status='ACTIVE'
  ) then raise exception 'Active matching partner and agreement required' using errcode='23514'; end if;
 end if;
 if nullif(p_payload->>'id','') is null then
  insert into public.academy_training_offerings(offering_code,title,description,specialty_code,audience_profile,delivery_regime,partner_id,agreement_id,default_duration_days,default_capacity,status)
  values(v_code,v_title,coalesce(p_payload->>'description',''),v_specialty,coalesce(p_payload->>'audience_profile','MIXED'),v_regime,v_partner,v_agreement,nullif(p_payload->>'default_duration_days','')::numeric,coalesce(nullif(p_payload->>'default_capacity','')::integer,10),'DRAFT') returning id into v_id;
 else
  v_id:=(p_payload->>'id')::uuid;
  select to_jsonb(o) into v_old from public.academy_training_offerings o where o.id=v_id and o.status='DRAFT' for update;
  if v_old is null then raise exception 'Editable draft offering not found' using errcode='P0002'; end if;
  update public.academy_training_offerings set offering_code=v_code,title=v_title,description=coalesce(p_payload->>'description',''),specialty_code=v_specialty,audience_profile=coalesce(p_payload->>'audience_profile','MIXED'),delivery_regime=v_regime,partner_id=v_partner,agreement_id=v_agreement,default_duration_days=nullif(p_payload->>'default_duration_days','')::numeric,default_capacity=coalesce(nullif(p_payload->>'default_capacity','')::integer,10),updated_at=now() where id=v_id;
 end if;
 select to_jsonb(o) into v_new from public.academy_training_offerings o where o.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(auth.uid(),'TRAINING_OFFERING',v_id,v_code,case when v_old is null then 'CREATED' else 'UPDATED' end,v_old,v_new,left(coalesce(p_payload->>'note',''),1000));
 return v_id;
end; $$;

create or replace function public.academy_save_training_session(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old jsonb; v_new jsonb; v_offering uuid; v_code text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid session payload' using errcode='22023'; end if;
 v_offering:=(p_payload->>'offering_id')::uuid; v_code:=nullif(btrim(p_payload->>'session_code'),'');
 if v_code is null or v_code !~ '^[A-Z0-9][A-Z0-9._-]{1,79}$' then raise exception 'Valid session code required' using errcode='22023'; end if;
 if not exists(select 1 from public.academy_training_offerings where id=v_offering and status='ACTIVE') then raise exception 'Active offering required before scheduling sessions' using errcode='23514'; end if;
 if (select delivery_regime from public.academy_training_offerings where id=v_offering)<>'PRIVATE_WORKSHOP' then
  if not exists(select 1 from public.academy_training_offerings o join public.academy_training_partners p on p.id=o.partner_id join public.academy_training_agreements a on a.id=o.agreement_id where o.id=v_offering and p.status='ACTIVE' and a.status='ACTIVE' and (p.approval_valid_from is null or p.approval_valid_from<=current_date) and (p.approval_valid_until is null or p.approval_valid_until>=current_date) and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date)) then raise exception 'Partner approval and agreement must be active and in date' using errcode='23514'; end if;
 end if;
 if nullif(p_payload->>'id','') is null then
  insert into public.academy_training_sessions(offering_id,session_code,starts_at,ends_at,venue_code,delivery_mode,capacity,status,registration_opens_at,registration_closes_at)
  values(v_offering,v_code,(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,btrim(p_payload->>'venue_code'),p_payload->>'delivery_mode',coalesce(nullif(p_payload->>'capacity','')::integer,(select default_capacity from public.academy_training_offerings where id=v_offering)),'DRAFT',nullif(p_payload->>'registration_opens_at','')::timestamptz,nullif(p_payload->>'registration_closes_at','')::timestamptz) returning id into v_id;
 else
  v_id:=(p_payload->>'id')::uuid;
  select to_jsonb(s) into v_old from public.academy_training_sessions s where s.id=v_id and s.status='DRAFT' for update;
  if v_old is null then raise exception 'Editable draft session not found' using errcode='P0002'; end if;
  update public.academy_training_sessions set offering_id=v_offering,session_code=v_code,starts_at=(p_payload->>'starts_at')::timestamptz,ends_at=(p_payload->>'ends_at')::timestamptz,venue_code=btrim(p_payload->>'venue_code'),delivery_mode=p_payload->>'delivery_mode',capacity=coalesce(nullif(p_payload->>'capacity','')::integer,(select default_capacity from public.academy_training_offerings where id=v_offering)),registration_opens_at=nullif(p_payload->>'registration_opens_at','')::timestamptz,registration_closes_at=nullif(p_payload->>'registration_closes_at','')::timestamptz,updated_at=now() where id=v_id;
 end if;
 select to_jsonb(s) into v_new from public.academy_training_sessions s where s.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(auth.uid(),'TRAINING_SESSION',v_id,v_code,case when v_old is null then 'CREATED' else 'UPDATED' end,v_old,v_new,left(coalesce(p_payload->>'note',''),1000));
 return v_id;
end; $$;

create or replace function public.academy_enroll_training_session(p_session_id uuid,p_participant_name text,p_participant_email text,p_participant_category text default 'OTHER')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.academy_training_sessions%rowtype; v_count integer; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_session_id is null or nullif(btrim(p_participant_name),'') is null or nullif(btrim(p_participant_email),'') is null then raise exception 'Session, participant name and email are required' using errcode='22023'; end if;
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

create or replace function public.academy_record_training_attendance(p_enrollment_id uuid,p_training_date date,p_status text,p_minutes integer default 0,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_session_id uuid; v_starts date; v_ends date;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_enrollment_id is null or p_training_date is null or p_status not in ('PRESENT','LATE','ABSENT','EXCUSED') or coalesce(p_minutes,-1)<0 then raise exception 'Invalid attendance parameters' using errcode='22023'; end if;
 select s.id,(s.starts_at at time zone 'Africa/Algiers')::date,(s.ends_at at time zone 'Africa/Algiers')::date into v_session_id,v_starts,v_ends
 from public.academy_training_enrollments e join public.academy_training_sessions s on s.id=e.session_id where e.id=p_enrollment_id and e.enrollment_status in ('PENDING','CONFIRMED','COMPLETED');
 if v_session_id is null or p_training_date<v_starts or p_training_date>v_ends then raise exception 'Attendance date is outside the session' using errcode='23514'; end if;
 insert into public.academy_training_attendance(enrollment_id,training_date,attendance_status,attended_minutes,recorded_by,note)
 values(p_enrollment_id,p_training_date,p_status,p_minutes,auth.uid(),left(coalesce(p_note,''),1000))
 on conflict(enrollment_id,training_date) do update set attendance_status=excluded.attendance_status,attended_minutes=excluded.attended_minutes,recorded_by=excluded.recorded_by,recorded_at=now(),note=excluded.note returning id into v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)
 values(auth.uid(),'TRAINING_ATTENDANCE',v_id,p_enrollment_id::text,'RECORDED',jsonb_build_object('training_date',p_training_date,'status',p_status,'minutes',p_minutes),left(coalesce(p_note,''),1000));
 return v_id;
end; $$;

revoke all on function public.academy_save_training_offering(jsonb) from public,anon;
revoke all on function public.academy_save_training_session(jsonb) from public,anon;
revoke all on function public.academy_enroll_training_session(uuid,text,text,text) from public,anon;
revoke all on function public.academy_record_training_attendance(uuid,date,text,integer,text) from public,anon;
grant execute on function public.academy_save_training_offering(jsonb) to authenticated;
grant execute on function public.academy_save_training_session(jsonb) to authenticated;
grant execute on function public.academy_enroll_training_session(uuid,text,text,text) to authenticated;
grant execute on function public.academy_record_training_attendance(uuid,date,text,integer,text) to authenticated;
