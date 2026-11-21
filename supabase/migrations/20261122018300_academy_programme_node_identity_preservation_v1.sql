begin;

-- Preserve stable node IDs across draft edits. Programme-node IDs will be used
-- by later curriculum relations (competencies, paths, assessments and assets).
create or replace function public.academy_save_program_draft(
 p_program_id uuid,p_code text,p_slug text,p_title text,p_summary text,p_objectives text,
 p_program_type text,p_target_audience text,p_difficulty_level text,p_estimated_duration_hours numeric,
 p_version_label text,p_departments jsonb,p_domains jsonb,p_nodes jsonb
) returns uuid language plpgsql security definer set search_path='' as $function$
declare
 v_uid uuid:=auth.uid(); v_id uuid; v_old jsonb; v_new jsonb;
 v_item jsonb; v_code text; v_domain text; v_parent_code text; v_parent_id uuid; v_node_id uuid;
 v_node_count integer; v_processed integer:=0; v_pass integer:=0; v_processed_codes text[]:=array[]::text[];
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if nullif(btrim(p_code),'') is null or upper(btrim(p_code)) !~ '^[A-Z0-9][A-Z0-9_-]*$'
  or nullif(btrim(p_slug),'') is null or lower(btrim(p_slug)) !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  or nullif(btrim(p_title),'') is null then
  raise exception 'Programme code, slug and title are required and must be valid' using errcode='22023';
 end if;
 if p_program_type is null or p_program_type not in ('FOUNDATION','SPECIALIZATION','PROFESSIONAL','RESEARCH','TRANSVERSAL')
  or p_difficulty_level is null or p_difficulty_level not in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED') then
  raise exception 'Invalid programme type or difficulty level' using errcode='22023';
 end if;
 if p_estimated_duration_hours is not null and p_estimated_duration_hours<=0 then raise exception 'Duration must be positive' using errcode='22023'; end if;
 if coalesce(jsonb_typeof(p_departments),'')<>'array' or jsonb_array_length(p_departments)<1 or jsonb_array_length(p_departments)>9
  or coalesce(jsonb_typeof(p_domains),'')<>'array' or jsonb_array_length(p_domains)<1 or jsonb_array_length(p_domains)>100
  or coalesce(jsonb_typeof(p_nodes),'')<>'array' or jsonb_array_length(p_nodes)<1 or jsonb_array_length(p_nodes)>500 then
  raise exception 'A programme needs departments, domains and at least one structural node' using errcode='22023';
 end if;
 if (select count(distinct value->>'code') from jsonb_array_elements(p_departments))<>jsonb_array_length(p_departments)
  or (select count(*) from jsonb_array_elements(p_departments) where coalesce((value->>'is_primary')::boolean,false))<>1 then
  raise exception 'Departments must be unique and exactly one must be primary' using errcode='22023';
 end if;
 if (select count(distinct value->>'code') from jsonb_array_elements(p_domains))<>jsonb_array_length(p_domains) then
  raise exception 'Programme domains must be unique' using errcode='22023';
 end if;
 if (select count(distinct upper(btrim(value->>'code'))) from jsonb_array_elements(p_nodes))<>jsonb_array_length(p_nodes) then
  raise exception 'Programme node codes must be unique' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_nodes)
  where coalesce((value->>'sort_order')::integer,0)<1 or (value->>'sort_order')::integer>1000000) then
  raise exception 'Programme node order must be between 1 and 1000000' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_departments) loop
  v_code:=upper(btrim(v_item->>'code'));
  if not exists(select 1 from public.departments d where d.code=v_code and d.status<>'ARCHIVED') then
   raise exception 'Unknown or archived department: %',v_code using errcode='23503';
  end if;
 end loop;
 for v_item in select value from jsonb_array_elements(p_domains) loop
  v_domain:=upper(btrim(v_item->>'code'));
  if not exists(select 1 from public.domains d join public.departments dep on dep.code=d.department_code
   where d.code=v_domain and d.status<>'ARCHIVED' and dep.status<>'ARCHIVED'
   and exists(select 1 from jsonb_array_elements(p_departments) pd where upper(pd->>'code')=dep.code)) then
   raise exception 'Programme domain must belong to one of its selected departments: %',v_domain using errcode='23503';
  end if;
 end loop;
 for v_item in select value from jsonb_array_elements(p_nodes) loop
  if nullif(btrim(v_item->>'code'),'') is null or upper(btrim(v_item->>'code')) !~ '^[A-Z0-9][A-Z0-9_-]*$'
   or nullif(btrim(v_item->>'title'),'') is null
   or coalesce(v_item->>'node_type','') not in ('CYCLE','YEAR','SEMESTER','BLOCK','MODULE','UNIT','CHAPTER','SEQUENCE','LESSON','ACTIVITY')
   or coalesce((v_item->>'sort_order')::integer,0)<=0 then
   raise exception 'Invalid programme hierarchy node' using errcode='22023';
  end if;
 end loop;

 if p_program_id is null then
  insert into public.academy_programs(code,slug,title,summary,objectives,program_type,target_audience,difficulty_level,estimated_duration_hours,version_label)
  values(upper(btrim(p_code)),lower(btrim(p_slug)),btrim(p_title),coalesce(p_summary,''),coalesce(p_objectives,''),p_program_type,
   coalesce(p_target_audience,''),p_difficulty_level,p_estimated_duration_hours,coalesce(nullif(btrim(p_version_label),''),'0.1'))
  returning id into v_id;
  v_old:=null;
 else
  select to_jsonb(p) into v_old from public.academy_programs p where p.id=p_program_id and p.status='DRAFT' for update;
  if v_old is null then raise exception 'Editable programme draft not found' using errcode='P0002'; end if;
  update public.academy_programs set code=upper(btrim(p_code)),slug=lower(btrim(p_slug)),title=btrim(p_title),
   summary=coalesce(p_summary,''),objectives=coalesce(p_objectives,''),program_type=p_program_type,
   target_audience=coalesce(p_target_audience,''),difficulty_level=p_difficulty_level,
   estimated_duration_hours=p_estimated_duration_hours,version_label=coalesce(nullif(btrim(p_version_label),''),'0.1'),updated_at=now()
   where id=p_program_id returning id into v_id;
 end if;

 delete from public.academy_program_departments where program_id=v_id;
 delete from public.academy_program_domains where program_id=v_id;
 insert into public.academy_program_departments(program_id,department_code,is_primary)
  select v_id,upper(value->>'code'),coalesce((value->>'is_primary')::boolean,false) from jsonb_array_elements(p_departments);
 insert into public.academy_program_domains(program_id,domain_code)
  select v_id,upper(value->>'code') from jsonb_array_elements(p_domains);

 -- Move existing sibling orders out of the active range before applying a new
 -- ordering, so swaps/reordering cannot hit immediate unique-index conflicts.
 if exists(select 1 from public.academy_program_nodes where program_id=v_id and sort_order>=1000000000) then
  raise exception 'Existing programme node order exceeds the supported range' using errcode='22023';
 end if;
 update public.academy_program_nodes set sort_order=sort_order+1000000000,updated_at=now()
  where program_id=v_id;

 select jsonb_array_length(p_nodes) into v_node_count;
 while v_processed<v_node_count loop
  v_pass:=v_pass+1;
  if v_pass>v_node_count then
   raise exception 'Programme hierarchy contains a missing parent or cycle' using errcode='23514';
  end if;
  for v_item in select value from jsonb_array_elements(p_nodes) loop
   v_code:=upper(btrim(v_item->>'code'));
   if not (v_code=any(v_processed_codes)) then
    v_parent_code:=nullif(upper(btrim(v_item->>'parent_code')),'');
    if v_parent_code is null or v_parent_code=any(v_processed_codes) then
     v_parent_id:=null;
     if v_parent_code is not null then
      select n.id into v_parent_id from public.academy_program_nodes n
       where n.program_id=v_id and n.code=v_parent_code;
      if v_parent_id is null then raise exception 'Parent node must exist in the same programme: %',v_parent_code using errcode='23503'; end if;
     end if;
     select n.id into v_node_id from public.academy_program_nodes n
      where n.program_id=v_id and n.code=v_code;
     if v_node_id is null then
      insert into public.academy_program_nodes(program_id,parent_node_id,code,node_type,title,summary,sort_order,is_required,estimated_minutes)
      values(v_id,v_parent_id,v_code,upper(v_item->>'node_type'),btrim(v_item->>'title'),coalesce(v_item->>'summary',''),
       (v_item->>'sort_order')::integer,coalesce((v_item->>'is_required')::boolean,true),
       nullif(nullif(v_item->>'estimated_minutes','')::integer,0))
      returning id into v_node_id;
     else
      update public.academy_program_nodes set parent_node_id=v_parent_id,node_type=upper(v_item->>'node_type'),
       title=btrim(v_item->>'title'),summary=coalesce(v_item->>'summary',''),
       sort_order=(v_item->>'sort_order')::integer,is_required=coalesce((v_item->>'is_required')::boolean,true),
       estimated_minutes=nullif(nullif(v_item->>'estimated_minutes','')::integer,0),updated_at=now()
       where id=v_node_id and program_id=v_id;
     end if;
     v_processed_codes:=array_append(v_processed_codes,v_code);
     v_processed:=v_processed+1;
    end if;
   end if;
  end loop;
 end loop;

 delete from public.academy_program_nodes n
  where n.program_id=v_id
  and not exists(select 1 from jsonb_array_elements(p_nodes) incoming
   where upper(btrim(incoming->>'code'))=n.code);

 select to_jsonb(p) into v_new from public.academy_programs p where p.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(v_uid,'PROGRAMME',v_id,upper(btrim(p_code)),case when v_old is null then 'CREATED' else 'UPDATED' end,v_old,v_new,
  'Programme hierarchy and disciplinary scope saved; stable node identifiers preserved');
 return v_id;
end;$function$;

revoke all on function public.academy_save_program_draft(uuid,text,text,text,text,text,text,text,text,numeric,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.academy_save_program_draft(uuid,text,text,text,text,text,text,text,text,numeric,text,jsonb,jsonb,jsonb) to authenticated;

commit;