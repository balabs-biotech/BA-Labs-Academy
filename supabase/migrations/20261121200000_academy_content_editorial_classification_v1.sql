-- Atomic content editor: metadata, classification and Atlas relations.
create or replace function public.academy_save_content_editorial(
 p_content_id uuid,p_business_id text,p_slug text,p_title text,p_summary text,p_resource_type text,
 p_language_code text,p_learning_level text,p_departments jsonb,p_domains jsonb
) returns uuid language plpgsql security definer set search_path='' as $function$
declare
 v_uid uuid:=auth.uid(); v_id uuid; v_old jsonb; v_new jsonb; v_node_id uuid;
 v_department jsonb; v_domain jsonb; v_domain_code text; v_domain_node uuid;
 v_dept_count integer:=0; v_primary_count integer:=0;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if nullif(btrim(p_business_id),'') is null or p_business_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{1,79}$' then raise exception 'Invalid business identifier' using errcode='22023'; end if;
 if nullif(btrim(p_slug),'') is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Slug must use lowercase letters, digits and hyphens' using errcode='22023'; end if;
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_resource_type),'') is null then raise exception 'Title and resource type are required' using errcode='22023'; end if;
 if p_departments is null or jsonb_typeof(p_departments)<>'array' or jsonb_array_length(p_departments)>20 or p_domains is null or jsonb_typeof(p_domains)<>'array' or jsonb_array_length(p_domains)>50 then raise exception 'Invalid classification payload' using errcode='22023'; end if;
 if p_content_id is null then
  insert into public.content_items(business_id,slug,title,summary,resource_type,language_code,learning_level,editorial_status,status,visibility)
  values(btrim(p_business_id),btrim(p_slug),btrim(p_title),coalesce(p_summary,''),btrim(p_resource_type),coalesce(nullif(btrim(p_language_code),''),'fr'),p_learning_level,'DRAFT','DRAFT','INTERNAL') returning id into v_id;
 else
  select to_jsonb(c) into v_old from public.content_items c where c.id=p_content_id and c.status='DRAFT' and c.editorial_status in ('PLANNED','OUTLINE','DRAFT') for update;
  if v_old is null then raise exception 'Editable content draft not found' using errcode='P0002'; end if;
  update public.content_items set business_id=btrim(p_business_id),slug=btrim(p_slug),title=btrim(p_title),summary=coalesce(p_summary,''),resource_type=btrim(p_resource_type),language_code=coalesce(nullif(btrim(p_language_code),''),'fr'),learning_level=p_learning_level,updated_at=now() where id=p_content_id returning id into v_id;
 end if;
 delete from public.content_department_links where content_id=v_id;
 delete from public.content_domain_links where content_id=v_id;
 for v_department in select value from jsonb_array_elements(p_departments) loop
  if nullif(v_department->>'code','') is null or not exists(select 1 from public.departments d where d.code=v_department->>'code') then raise exception 'Unknown or empty department code' using errcode='23503'; end if;
  insert into public.content_department_links(content_id,department_code,is_primary) values(v_id,v_department->>'code',coalesce((v_department->>'is_primary')::boolean,false));
  v_dept_count:=v_dept_count+1;
  if coalesce((v_department->>'is_primary')::boolean,false) then v_primary_count:=v_primary_count+1; end if;
 end loop;
 if v_dept_count>0 and v_primary_count<>1 then raise exception 'Exactly one primary department is required when departments are assigned' using errcode='23514'; end if;
 for v_domain in select value from jsonb_array_elements(p_domains) loop
  v_domain_code:=v_domain->>'code';
  if nullif(v_domain_code,'') is null or not exists(select 1 from public.domains d join public.content_department_links l on l.department_code=d.department_code and l.content_id=v_id where d.code=v_domain_code) then raise exception 'Domain must belong to one of the selected departments' using errcode='23514'; end if;
  insert into public.content_domain_links(content_id,domain_code) values(v_id,v_domain_code);
 end loop;
 select n.id into v_node_id from public.atlas_nodes n join public.content_items c on c.business_id=n.entity_key where c.id=v_id and n.entity_type in ('MODULE','CONTENT') for update;
 if v_node_id is null then
  insert into public.atlas_nodes(node_key,entity_type,entity_key,title_override,visibility,status) select 'module:'||business_id,'MODULE',business_id,title,'INTERNAL','DRAFT' from public.content_items where id=v_id returning id into v_node_id;
 else
  if exists(select 1 from public.atlas_nodes where id=v_node_id and status<>'DRAFT') then raise exception 'Atlas node is already published; content edits require a new version' using errcode='23514'; end if;
  update public.atlas_nodes set node_key='module:'||(select business_id from public.content_items where id=v_id),title_override=(select title from public.content_items where id=v_id),updated_at=now() where id=v_node_id;
 end if;
 delete from public.atlas_edges where source_node_id=v_node_id and relation_type='USES' and status='DRAFT';
 for v_domain_code in select domain_code from public.content_domain_links where content_id=v_id loop
  select id into v_domain_node from public.atlas_nodes where entity_type='DOMAIN' and entity_key=v_domain_code;
  if v_domain_node is not null then
   insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status) values(v_node_id,v_domain_node,'USES','Ressource classée dans ce domaine','DRAFT')
   on conflict(source_node_id,target_node_id,relation_type) do update set rationale=excluded.rationale,status='DRAFT';
  end if;
 end loop;
 select to_jsonb(c) into v_new from public.content_items c where c.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(v_uid,'CONTENT_ITEM',v_id,p_business_id,case when v_old is null then 'CREATED' else 'UPDATED' end,v_old,v_new,'');
 return v_id;
end;$function$;
revoke all on function public.academy_save_content_editorial(uuid,text,text,text,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.academy_save_content_editorial(uuid,text,text,text,text,text,text,text,jsonb,jsonb) to authenticated;