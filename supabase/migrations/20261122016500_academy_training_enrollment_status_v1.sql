create or replace function public.academy_set_training_enrollment_status(p_enrollment_id uuid,p_new_status text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare oldj jsonb; newj jsonb; sid uuid; current_status text; cap integer; occupied integer; participant text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_enrollment_id is null or p_new_status is null or p_new_status not in ('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW') then raise exception 'Invalid enrollment status parameters' using errcode='22023'; end if;
 select to_jsonb(e),e.session_id,e.enrollment_status,e.participant_email into oldj,sid,current_status,participant from public.academy_training_enrollments e where e.id=p_enrollment_id for update;
 if oldj is null then raise exception 'Enrollment not found' using errcode='P0002'; end if;
 if current_status='WAITLISTED' and p_new_status not in ('PENDING','CANCELLED') then raise exception 'Waitlisted enrollment must first be admitted to the pending list' using errcode='23514'; end if;
 if p_new_status in ('PENDING','CONFIRMED') then
  select capacity into cap from public.academy_training_sessions where id=sid for update;
  select count(*) into occupied from public.academy_training_enrollments where session_id=sid and id<>p_enrollment_id and enrollment_status in ('PENDING','CONFIRMED','COMPLETED');
  if occupied>=cap then raise exception 'Session capacity reached' using errcode='23514'; end if;
 end if;
 if p_new_status='COMPLETED' and not exists(select 1 from public.academy_training_attendance a where a.enrollment_id=p_enrollment_id and a.attendance_status in ('PRESENT','LATE')) then raise exception 'At least one validated attendance record is required before completion' using errcode='23514'; end if;
 update public.academy_training_enrollments set enrollment_status=p_new_status,updated_at=now() where id=p_enrollment_id;
 select to_jsonb(e) into newj from public.academy_training_enrollments e where e.id=p_enrollment_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note) values(auth.uid(),'TRAINING_ENROLLMENT',p_enrollment_id,participant,'STATUS_CHANGED',oldj,newj,left(coalesce(p_note,''),1000));
end; $$;
revoke all on function public.academy_set_training_enrollment_status(uuid,text,text) from public,anon;
grant execute on function public.academy_set_training_enrollment_status(uuid,text,text) to authenticated;