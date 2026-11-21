-- Competency editorial workflow: atomic draft save, resource mapping and Atlas sync.
drop policy if exists "Academy editors can read draft competencies" on public.academy_competencies;
create policy "Academy editors can read draft competencies"
on public.academy_competencies for select to authenticated
using (exists (select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')));
drop policy if exists "Academy editors can read draft competency links" on public.academy_content_competencies;
create policy "Academy editors can read draft competency links"
on public.academy_content_competencies for select to authenticated
using (exists (select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')));

create or replace function public.academy_save_competency_editorial(p_competency_id uuid,p_code text,p_title text,p_description text,p_competency_level text,p_mappings jsonb)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_id uuid; v_old jsonb; v_new jsonb; v_node_id uuid; v_mapping jsonb; v_content_id uuid; v_expected_level text; v_hint text; v_business_id text; v_content_title text; v_content_node_id uuid; v_count integer:=0; v_old_code text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if p_code is null or p_code !~ '^[A-Z0-9][A-Z0-9_-]{1,47}$' then raise exception 'Competency code must be 2-48 uppercase letters, digits, _ or -' using errcode='22023'; end if;
 if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'Competency title is required' using errcode='22023'; end if;
 if p_competency_level not in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT') then raise exception 'Invalid competency level' using errcode='22023'; end if;
 if p_mappings is null or jsonb_typeof(p_mappings)<>'array' or jsonb_array_length(p_mappings)>100 then raise exception 'Mappings must be an array with at most 100 entries' using errcode='22023'; end if;
 if p_competency_id is null then
  insert into public.academy_competencies(code,title,description,competency_level,status,visibility) values(p_code,trim(p_title),coalesce(p_description,''),p_competency_level,'DRAFT','INTERNAL') returning id into v_id;
 else
  select to_jsonb(c),c.code into v_old,v_old_code from public.academy_competencies c where c.id=p_competency_id and c.status='DRAFT' for update;
  if v_old is null then raise exception 'Draft competency not found' using errcode='P0002'; end if;
  update public.academy_competencies set code=p_code,title=trim(p_title),description=coalesce(p_description,''),competency_level=p_competency_level,updated_at=now() where id=p_competency_id returning id into v_id;
 end if;
 select n.id into v_node_id from public.atlas_nodes n where n.entity_type='SKILL' and n.entity_key=coalesce(v_old_code,p_code) for update;
 if v_node_id is null then
  insert into public.atlas_nodes(node_key,entity_type,entity_key,title_override,visibility,status) values('skill:'||p_code,'SKILL',p_code,trim(p_title),'INTERNAL','DRAFT') returning id into v_node_id;
 else
  if exists(select 1 from public.atlas_nodes n where n.id=v_node_id and n.status<>'DRAFT') then raise exception 'Matching Atlas skill node is not a draft' using errcode='23514'; end if;
  update public.atlas_nodes set node_key='skill:'||p_code,entity_key=p_code,title_override=trim(p_title),visibility='INTERNAL',updated_at=now() where id=v_node_id;
 end if;
 delete from public.academy_content_competencies where competency_id=v_id;
 delete from public.atlas_edges where status='DRAFT' and relation_type='SUPPORTS' and target_node_id=v_node_id;
 for v_mapping in select value from jsonb_array_elements(p_mappings) loop
  v_count:=v_count+1;
  begin v_content_id:=(v_mapping->>'content_id')::uuid; exception when others then raise exception 'Invalid content_id in mapping %',v_count using errcode='22023'; end;
  v_expected_level:=coalesce(v_mapping->>'expected_level','FOUNDATION'); v_hint:=coalesce(v_mapping->>'assessment_hint','');
  if v_expected_level not in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED','EXPERT') then raise exception 'Invalid expected level in mapping %',v_count using errcode='22023'; end if;
  select c.business_id,c.title into v_business_id,v_content_title from public.content_items c where c.id=v_content_id;
  if v_business_id is null then raise exception 'Mapped content item % does not exist',v_content_id using errcode='P0002'; end if;
  insert into public.academy_content_competencies(content_id,competency_id,expected_level,assessment_hint) values(v_content_id,v_id,v_expected_level,v_hint);
  select n.id into v_content_node_id from public.atlas_nodes n where n.entity_type in ('CONTENT','MODULE') and n.entity_key=v_business_id for update;
  if v_content_node_id is null then
   insert into public.atlas_nodes(node_key,entity_type,entity_key,title_override,visibility,status) values('content:'||v_business_id,'CONTENT',v_business_id,v_content_title,'INTERNAL','DRAFT')
   on conflict(entity_type,entity_key) do update set title_override=excluded.title_override,updated_at=now() returning id into v_content_node_id;
  end if;
  insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status) values(v_content_node_id,v_node_id,'SUPPORTS',v_hint,'DRAFT')
  on conflict(source_node_id,target_node_id,relation_type) do update set rationale=excluded.rationale,status='DRAFT';
 end loop;
 select to_jsonb(c) into v_new from public.academy_competencies c where c.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(auth.uid(),'SKILL',v_id,p_code,case when v_old is null then 'CREATED' else 'UPDATED' end,v_old,v_new,'');
 return v_id;
end;$function$;

create or replace function public.academy_publish_competency(p_competency_id uuid,p_visibility text default 'PUBLIC',p_note text default '')
returns void language plpgsql security definer set search_path='' as $function$
declare v_uid uuid:=auth.uid(); v_old jsonb; v_new jsonb; v_code text; v_node_id uuid;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 if p_visibility not in ('PUBLIC','DISCOVERABLE') then raise exception 'Published competency must be PUBLIC or DISCOVERABLE' using errcode='22023'; end if;
 select to_jsonb(c),c.code into v_old,v_code from public.academy_competencies c where c.id=p_competency_id and c.status='DRAFT' for update;
 if v_old is null then raise exception 'Draft competency not found' using errcode='P0002'; end if;
 select n.id into v_node_id from public.atlas_nodes n where n.entity_type='SKILL' and n.entity_key=v_code and n.status='DRAFT' for update;
 if v_node_id is null then raise exception 'Matching Atlas skill node is missing or not draft' using errcode='23514'; end if;
 update public.academy_competencies set status='PUBLISHED',visibility=p_visibility,updated_at=now() where id=p_competency_id;
 update public.atlas_nodes set status='PUBLISHED',visibility=p_visibility,updated_at=now() where id=v_node_id;
 update public.atlas_edges e set status='PUBLISHED' where e.status='DRAFT' and (e.source_node_id=v_node_id or e.target_node_id=v_node_id)
 and exists(select 1 from public.atlas_nodes s where s.id=e.source_node_id and s.status='PUBLISHED')
 and exists(select 1 from public.atlas_nodes t where t.id=e.target_node_id and t.status='PUBLISHED');
 select to_jsonb(c) into v_new from public.academy_competencies c where c.id=p_competency_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note) values(v_uid,'SKILL',p_competency_id,v_code,'PUBLISHED',v_old,v_new,coalesce(p_note,''));
end;$function$;
revoke all on function public.academy_save_competency_editorial(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.academy_save_competency_editorial(uuid,text,text,text,text,jsonb) to authenticated;
revoke all on function public.academy_publish_competency(uuid,text,text) from public,anon;
grant execute on function public.academy_publish_competency(uuid,text,text) to authenticated;
