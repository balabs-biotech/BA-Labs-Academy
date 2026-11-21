create or replace function public.academy_validate_training_document_issuer()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_regime text;
  v_specialty text;
  v_venue text;
  v_mode text;
  v_partner_status text;
  v_partner_approval text;
  v_partner_valid_from date;
  v_partner_valid_until date;
  v_partner_specialties text[];
  v_partner_modes text[];
  v_agreement_status text;
  v_agreement_from date;
  v_agreement_until date;
  v_agreement_specialties text[];
  v_agreement_venues text[];
  v_agreement_modes text[];
  v_agreement_issuer text;
begin
  select o.delivery_regime,o.specialty_code,s.venue_code,s.delivery_mode,
         p.status,p.approval_number,p.approval_valid_from,p.approval_valid_until,
         p.approved_specialties,p.approved_delivery_modes,
         a.status,a.valid_from,a.valid_until,a.permitted_specialties,a.permitted_venues,
         a.permitted_delivery_modes,a.document_issuer
    into v_regime,v_specialty,v_venue,v_mode,
         v_partner_status,v_partner_approval,v_partner_valid_from,v_partner_valid_until,
         v_partner_specialties,v_partner_modes,
         v_agreement_status,v_agreement_from,v_agreement_until,v_agreement_specialties,
         v_agreement_venues,v_agreement_modes,v_agreement_issuer
  from public.academy_training_enrollments e
  join public.academy_training_sessions s on s.id=e.session_id
  join public.academy_training_offerings o on o.id=s.offering_id
  left join public.academy_training_agreements a on a.id=o.agreement_id
  left join public.academy_training_partners p on p.id=o.partner_id
  where e.id=new.enrollment_id;

  if v_regime is null then
    raise exception 'Training enrollment, session or offering not found';
  end if;

  if v_regime='PRIVATE_WORKSHOP' then
    if new.issuer_kind<>'BA_LABS_PRIVATE'
       or new.document_type not in ('PARTICIPATION_ATTESTATION','PRACTICAL_COMPLETION_ATTESTATION','INTERNAL_ASSESSMENT_RECORD') then
      raise exception 'Private workshop can issue BA Labs private attestations only';
    end if;
    return new;
  end if;

  if v_regime not in ('PARTNER_DELIVERED','APPROVED_ESTABLISHMENT') then
    raise exception 'Unsupported training delivery regime';
  end if;

  if v_partner_status<>'ACTIVE' or v_agreement_status<>'ACTIVE'
     or v_partner_approval is null or v_agreement_issuer='UNDECIDED' then
    raise exception 'Active approved partner and active agreement are required';
  end if;
  if (v_partner_valid_from is not null and current_date<v_partner_valid_from)
     or (v_partner_valid_until is not null and current_date>v_partner_valid_until)
     or (v_agreement_from is not null and current_date<v_agreement_from)
     or (v_agreement_until is not null and current_date>v_agreement_until) then
    raise exception 'Partner approval or agreement is outside its validity period';
  end if;
  if not (v_specialty=any(coalesce(v_partner_specialties,'{}'::text[])))
     or not (v_specialty=any(coalesce(v_agreement_specialties,'{}'::text[]))) then
    raise exception 'Training specialty is outside the approved agreement scope';
  end if;
  if not (v_venue=any(coalesce(v_agreement_venues,'{}'::text[]))) then
    raise exception 'Training venue is not authorized by the agreement';
  end if;
  if not (v_mode=any(coalesce(v_partner_modes,'{}'::text[])))
     or not (v_mode=any(coalesce(v_agreement_modes,'{}'::text[]))) then
    raise exception 'Training delivery mode is outside the approved scope';
  end if;
  if new.issuer_kind='APPROVED_PARTNER' and v_agreement_issuer<>'PARTNER' then
    raise exception 'Agreement does not authorize the partner to issue documents';
  end if;
  if new.issuer_kind='PUBLIC_AUTHORITY' and new.issuer_reference is null then
    raise exception 'Public authority reference is required';
  end if;
  if new.issuer_kind='BA_LABS_PRIVATE' then
    raise exception 'BA Labs cannot issue private attestations under the partner-delivered regime';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_training_document_issuer_guard on public.academy_training_documents;
create trigger academy_training_document_issuer_guard
before insert or update of enrollment_id,document_type,issuer_kind,issuer_reference
on public.academy_training_documents
for each row execute function public.academy_validate_training_document_issuer();

revoke all on function public.academy_validate_training_document_issuer() from public,anon,authenticated;
