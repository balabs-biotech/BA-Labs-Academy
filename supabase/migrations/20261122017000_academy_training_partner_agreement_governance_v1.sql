create or replace function public.academy_save_training_partner(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; oldj jsonb; newj jsonb; v_code text; v_name text; v_specialties text[]; v_modes text[];
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid partner payload' using errcode='22023'; end if;
 v_code:=nullif(upper(btrim(p_payload->>'partner_code')),'');v_name:=nullif(btrim(p_payload->>'legal_name'),'');
 if v_code is null or v_code !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' or v_name is null then raise exception 'Partner code and legal name are required' using errcode='22023'; end if;
 v_specialties:=array(select jsonb_array_elements_text(coalesce(p_payload->'approved_specialties','[]'::jsonb)));
 v_modes:=array(select jsonb_array_elements_text(coalesce(p_payload->'approved_delivery_modes','[]'::jsonb)));
 if exists(select 1 from unnest(v_modes) m where m not in ('IN_PERSON','HYBRID','DISTANCE','ALTERNATING')) then raise exception 'Invalid approved delivery mode' using errcode='22023'; end if;
 if nullif(p_payload->>'id','') is null then
  insert into public.academy_training_partners(partner_code,legal_name,approval_number,approval_authority,approval_valid_from,approval_valid_until,approved_specialties,approved_delivery_modes,status)
  values(v_code,v_name,nullif(btrim(p_payload->>'approval_number'),''),nullif(btrim(p_payload->>'approval_authority'),''),nullif(p_payload->>'approval_valid_from','')::date,nullif(p_payload->>'approval_valid_until','')::date,v_specialties,v_modes,'DRAFT') returning id into v_id;
 else
  v_id:=(p_payload->>'id')::uuid;
  select to_jsonb(p) into oldj from public.academy_training_partners p where p.id=v_id and p.status='DRAFT' for update;
  if oldj is null then raise exception 'Editable draft partner not found' using errcode='P0002'; end if;
  update public.academy_training_partners set partner_code=v_code,legal_name=v_name,approval_number=nullif(btrim(p_payload->>'approval_number'),''),approval_authority=nullif(btrim(p_payload->>'approval_authority'),''),approval_valid_from=nullif(p_payload->>'approval_valid_from','')::date,approval_valid_until=nullif(p_payload->>'approval_valid_until','')::date,approved_specialties=v_specialties,approved_delivery_modes=v_modes,updated_at=now() where id=v_id;
 end if;
 select to_jsonb(p) into newj from public.academy_training_partners p where p.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note) values(auth.uid(),'TRAINING_PARTNER',v_id,v_code,case when oldj is null then 'CREATED' else 'UPDATED' end,oldj,newj,left(coalesce(p_payload->>'note',''),1000));
 return v_id;
end; $$;

create or replace function public.academy_save_training_agreement(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; oldj jsonb; newj jsonb; v_partner uuid; v_code text; v_title text; v_specialties text[]; v_venues text[]; v_modes text[]; v_billing text; v_issuer text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid agreement payload' using errcode='22023'; end if;
 v_partner:=nullif(p_payload->>'partner_id','')::uuid;v_code:=nullif(upper(btrim(p_payload->>'agreement_code')),'');v_title:=nullif(btrim(p_payload->>'agreement_title'),'');
 if v_partner is null or v_code is null or v_code !~ '^[A-Z0-9][A-Z0-9._-]{1,59}$' or v_title is null then raise exception 'Partner, agreement code and title are required' using errcode='22023'; end if;
 if not exists(select 1 from public.academy_training_partners where id=v_partner and status='ACTIVE') then raise exception 'An active partner is required' using errcode='23514'; end if;
 v_specialties:=array(select jsonb_array_elements_text(coalesce(p_payload->'permitted_specialties','[]'::jsonb)));
 v_venues:=array(select jsonb_array_elements_text(coalesce(p_payload->'permitted_venues','[]'::jsonb)));
 v_modes:=array(select jsonb_array_elements_text(coalesce(p_payload->'permitted_delivery_modes','[]'::jsonb)));
 v_billing:=coalesce(p_payload->>'billing_responsibility','UNDECIDED');v_issuer:=coalesce(p_payload->>'document_issuer','UNDECIDED');
 if v_billing not in ('BA_LABS','PARTNER','SPLIT','UNDECIDED') or v_issuer not in ('BA_LABS_PRIVATE','PARTNER','UNDECIDED') then raise exception 'Invalid agreement responsibilities' using errcode='22023'; end if;
 if exists(select 1 from unnest(v_modes) m where m not in ('IN_PERSON','HYBRID','DISTANCE','ALTERNATING')) then raise exception 'Invalid permitted delivery mode' using errcode='22023'; end if;
 if nullif(p_payload->>'id','') is null then
  insert into public.academy_training_agreements(partner_id,agreement_code,agreement_title,valid_from,valid_until,permitted_specialties,permitted_venues,permitted_delivery_modes,billing_responsibility,document_issuer,signed_at,status)
  values(v_partner,v_code,v_title,nullif(p_payload->>'valid_from','')::date,nullif(p_payload->>'valid_until','')::date,v_specialties,v_venues,v_modes,v_billing,v_issuer,nullif(p_payload->>'signed_at','')::date,'DRAFT') returning id into v_id;
 else
  v_id:=(p_payload->>'id')::uuid;
  select to_jsonb(a) into oldj from public.academy_training_agreements a where a.id=v_id and a.status='DRAFT' for update;
  if oldj is null then raise exception 'Editable draft agreement not found' using errcode='P0002'; end if;
  update public.academy_training_agreements set partner_id=v_partner,agreement_code=v_code,agreement_title=v_title,valid_from=nullif(p_payload->>'valid_from','')::date,valid_until=nullif(p_payload->>'valid_until','')::date,permitted_specialties=v_specialties,permitted_venues=v_venues,permitted_delivery_modes=v_modes,billing_responsibility=v_billing,document_issuer=v_issuer,signed_at=nullif(p_payload->>'signed_at','')::date where id=v_id;
 end if;
 select to_jsonb(a) into newj from public.academy_training_agreements a where a.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note) values(auth.uid(),'TRAINING_AGREEMENT',v_id,v_code,case when oldj is null then 'CREATED' else 'UPDATED' end,oldj,newj,left(coalesce(p_payload->>'note',''),1000));
 return v_id;
end; $$;

create or replace function public.academy_set_training_reference_status(p_entity_type text,p_entity_id uuid,p_new_status text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare oldj jsonb;newj jsonb;v_key text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_entity_id is null or p_new_status is null then raise exception 'Reference and status are required' using errcode='22023'; end if;
 if p_entity_type='PARTNER' then
  select to_jsonb(p),p.partner_code into oldj,v_key from public.academy_training_partners p where id=p_entity_id for update;
  if oldj is null then raise exception 'Partner not found' using errcode='P0002'; end if;
  if p_new_status not in ('ACTIVE','SUSPENDED','EXPIRED','DRAFT') then raise exception 'Invalid partner status' using errcode='22023'; end if;
  if p_new_status='ACTIVE' and (select approval_number is null or approval_authority is null or cardinality(approved_specialties)=0 or cardinality(approved_delivery_modes)=0 or (approval_valid_from is not null and approval_valid_from>current_date) or (approval_valid_until is not null and approval_valid_until<current_date) from public.academy_training_partners where id=p_entity_id) then raise exception 'Partner approval evidence, validity and scope are required' using errcode='23514'; end if;
  update public.academy_training_partners set status=p_new_status,updated_at=now() where id=p_entity_id;
  select to_jsonb(p) into newj from public.academy_training_partners p where id=p_entity_id;
 elsif p_entity_type='AGREEMENT' then
  select to_jsonb(a),a.agreement_code into oldj,v_key from public.academy_training_agreements a where id=p_entity_id for update;
  if oldj is null then raise exception 'Agreement not found' using errcode='P0002'; end if;
  if p_new_status not in ('ACTIVE','SUSPENDED','EXPIRED','TERMINATED','DRAFT') then raise exception 'Invalid agreement status' using errcode='22023'; end if;
  if p_new_status='ACTIVE' and not exists(select 1 from public.academy_training_agreements a join public.academy_training_partners p on p.id=a.partner_id where a.id=p_entity_id and p.status='ACTIVE' and a.signed_at is not null and cardinality(a.permitted_specialties)>0 and cardinality(a.permitted_venues)>0 and cardinality(a.permitted_delivery_modes)>0 and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date)) then raise exception 'Agreement requires an active partner, signature, valid dates and defined scope' using errcode='23514'; end if;
  update public.academy_training_agreements set status=p_new_status where id=p_entity_id;
  select to_jsonb(a) into newj from public.academy_training_agreements a where id=p_entity_id;
 else raise exception 'Entity type must be PARTNER or AGREEMENT' using errcode='22023';
 end if;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note) values(auth.uid(),'TRAINING_'||p_entity_type,p_entity_id,v_key,'STATUS_CHANGED',oldj,newj,left(coalesce(p_note,''),1000));
end; $$;
revoke all on function public.academy_save_training_partner(jsonb) from public,anon;
revoke all on function public.academy_save_training_agreement(jsonb) from public,anon;
revoke all on function public.academy_set_training_reference_status(text,uuid,text,text) from public,anon;
grant execute on function public.academy_save_training_partner(jsonb) to authenticated;
grant execute on function public.academy_save_training_agreement(jsonb) to authenticated;
grant execute on function public.academy_set_training_reference_status(text,uuid,text,text) to authenticated;