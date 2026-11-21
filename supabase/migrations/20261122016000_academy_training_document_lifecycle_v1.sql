-- Secure issuance, public verification and revocation for operational training documents.
create unique index if not exists academy_training_one_active_document_per_type
  on public.academy_training_documents(enrollment_id,document_type)
  where revoked_at is null;

create or replace function public.academy_issue_training_document(
  p_enrollment_id uuid,p_document_type text,p_title text,p_issuer_kind text default null,p_issuer_reference text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 e public.academy_training_enrollments%rowtype; s public.academy_training_sessions%rowtype; o public.academy_training_offerings%rowtype;
 p public.academy_training_partners%rowtype; a public.academy_training_agreements%rowtype;
 k text; n text; r text; c text; t text; did uuid; snap jsonb; newj jsonb; att integer;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_enrollment_id is null or nullif(btrim(p_title),'') is null then raise exception 'Enrollment and document title are required' using errcode='22023'; end if;
 select * into e from public.academy_training_enrollments where id=p_enrollment_id for update;
 if not found or e.enrollment_status<>'COMPLETED' then raise exception 'Only completed enrollments can receive a training document' using errcode='23514'; end if;
 select * into s from public.academy_training_sessions where id=e.session_id;
 select * into o from public.academy_training_offerings where id=s.offering_id;
 select count(*) into att from public.academy_training_attendance where enrollment_id=p_enrollment_id and attendance_status in ('PRESENT','LATE');
 if att=0 then raise exception 'At least one validated attendance record is required' using errcode='23514'; end if;
 if p_document_type not in ('PARTICIPATION_ATTESTATION','PRACTICAL_COMPLETION_ATTESTATION','PARTNER_CERTIFICATE','STATE_RECOGNIZED_CERTIFICATE') then raise exception 'Unsupported training document type' using errcode='22023'; end if;
 if exists(select 1 from public.academy_training_documents where enrollment_id=p_enrollment_id and document_type=p_document_type and revoked_at is null) then raise exception 'An active document of this type already exists for this enrollment' using errcode='23505'; end if;
 if o.delivery_regime='PRIVATE_WORKSHOP' then
  if p_document_type not in ('PARTICIPATION_ATTESTATION','PRACTICAL_COMPLETION_ATTESTATION') or (p_issuer_kind is not null and p_issuer_kind<>'BA_LABS_PRIVATE') then raise exception 'Private BA Labs workshops can issue participation or practical completion attestations only' using errcode='22023'; end if;
  k:='BA_LABS_PRIVATE'; n:='BA Labs'; r:=null;
 else
  select * into p from public.academy_training_partners where id=o.partner_id;
  select * into a from public.academy_training_agreements where id=o.agreement_id;
  if p.id is null or a.id is null then raise exception 'Partner and agreement records are required' using errcode='23514'; end if;
  k:=p_issuer_kind;
  if k='APPROVED_PARTNER' then
   if p_document_type not in ('PARTNER_CERTIFICATE','STATE_RECOGNIZED_CERTIFICATE') or a.document_issuer<>'PARTNER' then raise exception 'The agreement does not authorize partner document issuance' using errcode='23514'; end if;
   n:=p.legal_name; r:=coalesce(nullif(btrim(p_issuer_reference),''),a.agreement_code);
  elsif k='PUBLIC_AUTHORITY' then
   if p_document_type<>'STATE_RECOGNIZED_CERTIFICATE' or nullif(btrim(p_issuer_reference),'') is null or nullif(btrim(p.approval_authority),'') is null then raise exception 'A public authority reference and identified authority are required' using errcode='23514'; end if;
   n:=p.approval_authority; r:=btrim(p_issuer_reference);
  else raise exception 'A partner or public-authority issuer must be specified' using errcode='22023';
  end if;
 end if;
 t:=encode(extensions.gen_random_bytes(32),'hex');
 c:='BAL-TRN-'||to_char(now() at time zone 'utc','YYYYMMDD')||'-'||upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,10));
 snap:=jsonb_build_object('offering_code',o.offering_code,'offering_title',o.title,'session_code',s.session_code,'starts_at',s.starts_at,'ends_at',s.ends_at,'venue_code',s.venue_code,'delivery_mode',s.delivery_mode,'attendance_days_recorded',att,'enrollment_status',e.enrollment_status);
 insert into public.academy_training_documents(enrollment_id,document_code,document_type,issuer_kind,issuer_name,issuer_reference,title,evidence_snapshot,verification_token_hash,created_by)
 values(p_enrollment_id,c,p_document_type,k,n,r,btrim(p_title),snap,encode(extensions.digest(t,'sha256'),'hex'),auth.uid()) returning id into did;
 select to_jsonb(d) into newj from public.academy_training_documents d where d.id=did;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note) values(auth.uid(),'TRAINING_DOCUMENT',did,c,'ISSUED',newj,'Document issued through controlled training workflow');
 return jsonb_build_object('document_id',did,'document_code',c,'verification_token',t,'document_type',p_document_type,'issuer_name',n,'issued_at',now());
end; $$;

create or replace function public.academy_verify_training_document(p_verification_token text)
returns table(document_code text,document_type text,title text,issuer_name text,issuer_reference text,issued_at timestamptz,verification_status text)
language sql security definer stable set search_path='' as $$
 select d.document_code,d.document_type,d.title,d.issuer_name,d.issuer_reference,d.issued_at,
 case when d.revoked_at is null then 'VALID' else 'REVOKED' end
 from public.academy_training_documents d
 where p_verification_token is not null and length(p_verification_token)=64
 and d.verification_token_hash=encode(extensions.digest(p_verification_token,'sha256'),'hex')
 limit 1;
$$;

create or replace function public.academy_revoke_training_document(p_document_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare oldj jsonb; newj jsonb; c text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_document_id is null or nullif(btrim(p_reason),'') is null then raise exception 'Document and revocation reason are required' using errcode='22023'; end if;
 select to_jsonb(d),d.document_code into oldj,c from public.academy_training_documents d where d.id=p_document_id for update;
 if oldj is null then raise exception 'Training document not found' using errcode='P0002'; end if;
 if oldj->>'revoked_at' is not null then raise exception 'Training document is already revoked' using errcode='23514'; end if;
 update public.academy_training_documents set revoked_at=now(),revocation_reason=left(btrim(p_reason),1000) where id=p_document_id;
 select to_jsonb(d) into newj from public.academy_training_documents d where d.id=p_document_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note) values(auth.uid(),'TRAINING_DOCUMENT',p_document_id,c,'REVOKED',oldj,newj,left(btrim(p_reason),1000));
end; $$;

revoke all on function public.academy_issue_training_document(uuid,text,text,text,text) from public,anon;
revoke all on function public.academy_verify_training_document(text) from public;
revoke all on function public.academy_revoke_training_document(uuid,text) from public,anon;
grant execute on function public.academy_issue_training_document(uuid,text,text,text,text) to authenticated;
grant execute on function public.academy_verify_training_document(text) to anon,authenticated;
grant execute on function public.academy_revoke_training_document(uuid,text) to authenticated;
