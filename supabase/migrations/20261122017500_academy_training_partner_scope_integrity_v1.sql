create or replace function public.academy_validate_training_delivery_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_offering public.academy_training_offerings%rowtype; v_partner public.academy_training_partners%rowtype; v_agreement public.academy_training_agreements%rowtype;
begin
 if tg_table_name='academy_training_offerings' then
  if new.delivery_regime='PRIVATE_WORKSHOP' then return new; end if;
  select * into v_partner from public.academy_training_partners where id=new.partner_id;
  select * into v_agreement from public.academy_training_agreements where id=new.agreement_id;
  if v_partner.id is null or v_agreement.id is null or v_partner.status<>'ACTIVE' or v_agreement.status<>'ACTIVE' or v_agreement.partner_id<>v_partner.id then raise exception 'Active partner and matching active agreement are required' using errcode='23514'; end if;
  if not (new.specialty_code=any(v_partner.approved_specialties)) or not (new.specialty_code=any(v_agreement.permitted_specialties)) then raise exception 'Offering specialty is outside the partner or agreement scope' using errcode='23514'; end if;
  return new;
 end if;
 select * into v_offering from public.academy_training_offerings where id=new.offering_id;
 if v_offering.id is null then raise exception 'Training offering not found' using errcode='23503'; end if;
 if v_offering.delivery_regime='PRIVATE_WORKSHOP' then return new; end if;
 select * into v_partner from public.academy_training_partners where id=v_offering.partner_id;
 select * into v_agreement from public.academy_training_agreements where id=v_offering.agreement_id;
 if v_partner.id is null or v_agreement.id is null or v_partner.status<>'ACTIVE' or v_agreement.status<>'ACTIVE' then raise exception 'Partner approval and agreement must be active' using errcode='23514'; end if;
 if not (v_offering.specialty_code=any(v_partner.approved_specialties)) or not (v_offering.specialty_code=any(v_agreement.permitted_specialties)) then raise exception 'Offering specialty is outside the partner or agreement scope' using errcode='23514'; end if;
 if not (new.venue_code=any(v_agreement.permitted_venues)) or not (new.delivery_mode=any(v_partner.approved_delivery_modes)) or not (new.delivery_mode=any(v_agreement.permitted_delivery_modes)) then raise exception 'Session venue or delivery mode is outside the approved scope' using errcode='23514'; end if;
 if (v_agreement.valid_from is not null and (new.starts_at at time zone 'Africa/Algiers')::date<v_agreement.valid_from)
 or (v_agreement.valid_until is not null and (new.ends_at at time zone 'Africa/Algiers')::date>v_agreement.valid_until)
 or (v_partner.approval_valid_from is not null and (new.starts_at at time zone 'Africa/Algiers')::date<v_partner.approval_valid_from)
 or (v_partner.approval_valid_until is not null and (new.ends_at at time zone 'Africa/Algiers')::date>v_partner.approval_valid_until) then raise exception 'Session dates exceed partner approval or agreement validity' using errcode='23514'; end if;
 return new;
end; $$;
drop trigger if exists academy_training_offering_scope_guard on public.academy_training_offerings;
create trigger academy_training_offering_scope_guard before insert or update of specialty_code,delivery_regime,partner_id,agreement_id on public.academy_training_offerings for each row execute function public.academy_validate_training_delivery_scope();
drop trigger if exists academy_training_session_scope_guard on public.academy_training_sessions;
create trigger academy_training_session_scope_guard before insert or update of offering_id,starts_at,ends_at,venue_code,delivery_mode on public.academy_training_sessions for each row execute function public.academy_validate_training_delivery_scope();
revoke all on function public.academy_validate_training_delivery_scope() from public,anon,authenticated;