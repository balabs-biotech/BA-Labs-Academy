create or replace function public.academy_save_training_billing_record(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_enrollment uuid; v_owner text; v_invoice text; v_currency text; v_amount bigint; v_status text; v_note text; v_old jsonb; v_new jsonb; v_old_status text; v_regime text; v_responsibility text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid billing payload' using errcode='22023'; end if;
 v_enrollment:=nullif(p_payload->>'enrollment_id','')::uuid;v_owner:=nullif(p_payload->>'billing_owner','');v_invoice:=nullif(btrim(p_payload->>'external_invoice_reference'),'');v_currency:=upper(coalesce(nullif(btrim(p_payload->>'currency_code'),''),'DZD'));v_amount:=nullif(p_payload->>'amount_minor_units','')::bigint;v_status:=coalesce(nullif(p_payload->>'payment_status',''),'UNPAID');v_note:=left(coalesce(p_payload->>'accounting_note',''),1000);
 if v_enrollment is null or v_owner is null or v_owner not in ('BA_LABS','PARTNER') or v_invoice is null or v_currency !~ '^[A-Z]{3}$' or v_amount is null or v_amount<0 or v_status not in ('UNPAID','PARTIALLY_PAID','PAID','REFUNDED','CANCELLED') then
  raise exception 'Billing owner, invoice reference, currency, non-negative amount and valid payment status are required' using errcode='22023';
 end if;
 select o.delivery_regime,a.billing_responsibility into v_regime,v_responsibility from public.academy_training_enrollments e join public.academy_training_sessions s on s.id=e.session_id join public.academy_training_offerings o on o.id=s.offering_id left join public.academy_training_agreements a on a.id=o.agreement_id where e.id=v_enrollment;
 if v_regime is null then raise exception 'Training enrollment not found' using errcode='P0002'; end if;
 if v_regime='PRIVATE_WORKSHOP' and v_owner<>'BA_LABS' then raise exception 'Private BA Labs workshop invoices must be assigned to BA Labs' using errcode='23514'; end if;
 if v_regime<>'PRIVATE_WORKSHOP' and (v_responsibility='UNDECIDED' or (v_responsibility<>'SPLIT' and v_responsibility<>v_owner)) then raise exception 'Invoice owner is outside the signed agreement billing responsibility' using errcode='23514'; end if;
 if nullif(p_payload->>'id','') is null then
  insert into public.academy_training_billing_records(enrollment_id,billing_owner,external_invoice_reference,currency_code,amount_minor_units,payment_status,accounting_note) values(v_enrollment,v_owner,v_invoice,v_currency,v_amount,v_status,v_note) returning id into v_id;
 else
  v_id:=(p_payload->>'id')::uuid;
  select to_jsonb(b),b.payment_status into v_old,v_old_status from public.academy_training_billing_records b where b.id=v_id and b.enrollment_id=v_enrollment for update;
  if v_old is null then raise exception 'Billing record not found' using errcode='P0002'; end if;
  if v_old_status in ('REFUNDED','CANCELLED') and v_status<>v_old_status then raise exception 'Refunded or cancelled billing records are terminal' using errcode='23514'; end if;
  if v_old_status='PAID' and v_status not in ('PAID','REFUNDED') then raise exception 'Paid records may only remain paid or be refunded' using errcode='23514'; end if;
  if v_old_status='PARTIALLY_PAID' and v_status='UNPAID' then raise exception 'Partial payment cannot return to unpaid without a new record' using errcode='23514'; end if;
  if v_old_status is distinct from v_status and nullif(btrim(p_payload->>'accounting_note'),'') is null then raise exception 'A note is required when changing payment status' using errcode='22023'; end if;
  update public.academy_training_billing_records set billing_owner=v_owner,external_invoice_reference=v_invoice,currency_code=v_currency,amount_minor_units=v_amount,payment_status=v_status,accounting_note=v_note where id=v_id;
 end if;
 select to_jsonb(b) into v_new from public.academy_training_billing_records b where b.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note) values(auth.uid(),'TRAINING_BILLING',v_id,v_invoice,case when v_old is null then 'CREATED' else 'UPDATED' end,v_old,v_new,v_note);
 return v_id;
end; $$;
revoke all on function public.academy_save_training_billing_record(jsonb) from public,anon;
grant execute on function public.academy_save_training_billing_record(jsonb) to authenticated;