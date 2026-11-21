-- Reject NULL and non-array payloads before attempting to expand JSON items.
CREATE OR REPLACE FUNCTION public.academy_save_learning_path_items(p_path_id uuid, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_prereq jsonb;
  v_content_id uuid;
  v_prereq_content_id uuid;
  v_item_id uuid;
  v_map jsonb := '{}'::jsonb;
  v_count integer := 0;
  v_order integer := 0;
  v_old jsonb;
  v_new jsonb;
begin
  perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'items must be a JSON array' using errcode='22023';
  end if;
  select to_jsonb(p) into v_old from public.academy_learning_paths p
  where p.id=p_path_id and p.status='DRAFT' for update;
  if v_old is null then raise exception 'Editable learning path draft not found' using errcode='P0002'; end if;
  if exists(select 1 from public.academy_path_enrollments e where e.path_id=p_path_id)
    or exists(select 1 from public.academy_path_item_progress pr
      join public.academy_learning_path_items i on i.id=pr.path_item_id where i.path_id=p_path_id) then
    raise exception 'Path structure is locked after enrollment or progress exists' using errcode='55000';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) a group by (a->>'content_id') having count(*) > 1) then
    raise exception 'A resource can appear only once in a learning path' using errcode='23505';
  end if;
  delete from public.academy_path_item_prerequisites where path_id=p_path_id;
  delete from public.academy_learning_path_items where path_id=p_path_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_order := v_order + 1;
    begin v_content_id := (v_item->>'content_id')::uuid;
    exception when others then raise exception 'Each item requires a valid content_id UUID' using errcode='22023'; end;
    if not exists(select 1 from public.content_items c where c.id=v_content_id
      and c.status='PUBLISHED' and c.editorial_status='PUBLISHED' and c.visibility='PUBLIC') then
      raise exception 'Every pathway resource must be published and public' using errcode='23514';
    end if;
    insert into public.academy_learning_path_items(path_id,content_id,sort_order,is_required)
    values(p_path_id,v_content_id,v_order,coalesce((v_item->>'is_required')::boolean,true))
    returning id into v_item_id;
    v_map := v_map || jsonb_build_object(v_content_id::text,v_item_id::text);
    v_count := v_count + 1;
  end loop;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_content_id := (v_item->>'content_id')::uuid;
    v_item_id := (v_map->>v_content_id::text)::uuid;
    if jsonb_typeof(coalesce(v_item->'prerequisites','[]'::jsonb)) <> 'array' then
      raise exception 'prerequisites must be an array of content_id UUIDs' using errcode='22023';
    end if;
    for v_prereq in select value from jsonb_array_elements(coalesce(v_item->'prerequisites','[]'::jsonb)) loop
      begin v_prereq_content_id := (v_prereq #>> '{}')::uuid;
      exception when others then raise exception 'Prerequisite references must be content_id UUIDs' using errcode='22023'; end;
      if not (v_map ? v_prereq_content_id::text) then
        raise exception 'Every prerequisite must reference a resource in this same path' using errcode='23514';
      end if;
      insert into public.academy_path_item_prerequisites(path_id,item_id,prerequisite_item_id)
      values(p_path_id,v_item_id,(v_map->>v_prereq_content_id::text)::uuid);
    end loop;
  end loop;
  if exists (
    with recursive walk(start_id,node_id,visited,cycle) as (
      select item_id,prerequisite_item_id,array[item_id,prerequisite_item_id]::uuid[],item_id=prerequisite_item_id
      from public.academy_path_item_prerequisites where path_id=p_path_id
      union all
      select w.start_id,p.prerequisite_item_id,w.visited || p.prerequisite_item_id,p.prerequisite_item_id=any(w.visited)
      from walk w join public.academy_path_item_prerequisites p
        on p.path_id=p_path_id and p.item_id=w.node_id
      where not w.cycle
    ) select 1 from walk where cycle
  ) then raise exception 'Prerequisite graph contains a cycle' using errcode='23514'; end if;
  select to_jsonb(p) into v_new from public.academy_learning_paths p where p.id=p_path_id;
  insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data)
  values(v_uid,'LEARNING_PATH',p_path_id,v_new->>'code','STRUCTURE_UPDATED',v_old,v_new);
  return v_count;
end;
$function$

