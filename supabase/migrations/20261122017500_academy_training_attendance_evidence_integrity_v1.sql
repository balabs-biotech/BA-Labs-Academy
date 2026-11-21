create or replace function public.academy_training_attendance_complete(p_enrollment_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 with session_days as (
  select (s.starts_at at time zone 'Africa/Algiers')::date first_day,(s.ends_at at time zone 'Africa/Algiers')::date last_day
  from public.academy_training_enrollments e join public.academy_training_sessions s on s.id=e.session_id where e.id=p_enrollment_id
 ), expected as (
  select generate_series(first_day,last_day,interval '1 day')::date training_date from session_days
 ), validated as (
  select a.training_date from public.academy_training_attendance a join expected x on x.training_date=a.training_date
  where a.enrollment_id=p_enrollment_id and a.attendance_status in ('PRESENT','LATE')
 )
 select exists(select 1 from session_days) and (select count(*) from expected)=(select count(*) from validated);
$$;

create or replace function public.academy_guard_training_evidence_integrity()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_enrollment_id uuid; v_old_status text;
begin
 if tg_table_name='academy_training_enrollments' then
  if new.enrollment_status='COMPLETED' and old.enrollment_status is distinct from 'COMPLETED'
     and not public.academy_training_attendance_complete(new.id) then
   raise exception 'Attendance must be validated for every calendar day of the training session before completion' using errcode='23514';
  end if;
  return new;
 elsif tg_table_name='academy_training_documents' then
  if not public.academy_training_attendance_complete(new.enrollment_id) then
   raise exception 'A document requires validated attendance for every calendar day of the session' using errcode='23514';
  end if;
  return new;
 elsif tg_table_name='academy_training_attendance' then
  v_enrollment_id:=case when tg_op='DELETE' then old.enrollment_id else new.enrollment_id end;
  select enrollment_status into v_old_status from public.academy_training_enrollments where id=v_enrollment_id;
  if v_old_status='COMPLETED' or exists(select 1 from public.academy_training_documents d where d.enrollment_id=v_enrollment_id and d.revoked_at is null) then
   raise exception 'Attendance evidence is locked after completion or document issuance' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 return null;
end; $$;

drop trigger if exists academy_training_completion_evidence_guard on public.academy_training_enrollments;
create trigger academy_training_completion_evidence_guard before update of enrollment_status on public.academy_training_enrollments for each row execute function public.academy_guard_training_evidence_integrity();
drop trigger if exists academy_training_document_evidence_guard on public.academy_training_documents;
create trigger academy_training_document_evidence_guard before insert on public.academy_training_documents for each row execute function public.academy_guard_training_evidence_integrity();
drop trigger if exists academy_training_attendance_immutability_guard on public.academy_training_attendance;
create trigger academy_training_attendance_immutability_guard before insert or update or delete on public.academy_training_attendance for each row execute function public.academy_guard_training_evidence_integrity();
revoke all on function public.academy_training_attendance_complete(uuid) from public,anon,authenticated;
revoke all on function public.academy_guard_training_evidence_integrity() from public,anon,authenticated;