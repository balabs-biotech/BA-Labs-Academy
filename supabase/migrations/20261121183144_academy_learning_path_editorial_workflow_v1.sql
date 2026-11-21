
-- Draft visibility for active Academy editorial members.
drop policy if exists "Academy editors can read learning path drafts" on public.academy_learning_paths;
create policy "Academy editors can read learning path drafts" on public.academy_learning_paths
for select to authenticated using (
  exists(select 1 from public.academy_memberships m where m.user_id=auth.uid()
    and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER'))
);
drop policy if exists "Academy editors can read learning path items" on public.academy_learning_path_items;
create policy "Academy editors can read learning path items" on public.academy_learning_path_items
for select to authenticated using (
  exists(select 1 from public.academy_memberships m where m.user_id=auth.uid()
    and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER'))
);
drop policy if exists "Academy editors can read path prerequisites" on public.academy_path_item_prerequisites;
create policy "Academy editors can read path prerequisites" on public.academy_path_item_prerequisites
for select to authenticated using (
  exists(select 1 from public.academy_memberships m where m.user_id=auth.uid()
    and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER'))
);
-- Ensure both prerequisite endpoints belong to the same published path.
drop policy if exists "Public can read prerequisites for published paths" on public.academy_path_item_prerequisites;
create policy "Public can read prerequisites for published paths"
on public.academy_path_item_prerequisites for select to anon,authenticated using (
  exists(
    select 1 from public.academy_learning_paths p
    join public.academy_learning_path_items i
      on i.path_id=p.id and i.id=academy_path_item_prerequisites.item_id
    join public.academy_learning_path_items prereq
      on prereq.path_id=p.id and prereq.id=academy_path_item_prerequisites.prerequisite_item_id
    where p.id=academy_path_item_prerequisites.path_id
      and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null
  )
);

CREATE OR REPLACE FUNCTION public.academy_save_learning_path_draft(p_path_id uuid, p_code text, p_slug text, p_title text, p_summary text, p_target_audience text, p_difficulty_level text, p_estimated_duration_minutes integer, p_version_label text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);

  if nullif(btrim(p_code),'') is null
    or nullif(btrim(p_slug),'') is null
    or nullif(btrim(p_title),'') is null then
    raise exception 'code, slug and title are required' using errcode='22023';
  end if;
  if p_difficulty_level not in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED') then
    raise exception 'Invalid difficulty level' using errcode='22023';
  end if;
  if p_estimated_duration_minutes is not null and p_estimated_duration_minutes <= 0 then
    raise exception 'Duration must be positive' using errcode='22023';
  end if;

  if p_path_id is null then
    insert into public.academy_learning_paths (
      code, slug, title, summary, target_audience, difficulty_level,
      estimated_duration_minutes, status, visibility, version_label
    ) values (
      upper(btrim(p_code)), lower(btrim(p_slug)), btrim(p_title),
      coalesce(p_summary,''), coalesce(p_target_audience,''),
      p_difficulty_level, p_estimated_duration_minutes, 'DRAFT', 'INTERNAL',
      coalesce(nullif(btrim(p_version_label),''),'0.1')
    )
    returning id into v_id;

    select to_jsonb(p) into v_new from public.academy_learning_paths p where p.id=v_id;
    insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data)
    values(v_uid,'LEARNING_PATH',v_id,upper(btrim(p_code)),'CREATED',v_new);
  else
    select to_jsonb(p) into v_old
    from public.academy_learning_paths p
    where p.id=p_path_id and p.status='DRAFT'
    for update;
    if v_old is null then
      raise exception 'Editable learning path draft not found' using errcode='P0002';
    end if;

    update public.academy_learning_paths
    set code=upper(btrim(p_code)),
        slug=lower(btrim(p_slug)),
        title=btrim(p_title),
        summary=coalesce(p_summary,''),
        target_audience=coalesce(p_target_audience,''),
        difficulty_level=p_difficulty_level,
        estimated_duration_minutes=p_estimated_duration_minutes,
        version_label=coalesce(nullif(btrim(p_version_label),''),'0.1'),
        updated_at=now()
    where id=p_path_id
    returning id into v_id;

    select to_jsonb(p) into v_new from public.academy_learning_paths p where p.id=v_id;
    insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data)
    values(v_uid,'LEARNING_PATH',v_id,upper(btrim(p_code)),'UPDATED',v_old,v_new);
  end if;

  return v_id;
end;
$function$

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


revoke all on function public.academy_save_learning_path_draft(uuid,text,text,text,text,text,text,integer,text) from public,anon;
revoke all on function public.academy_save_learning_path_items(uuid,jsonb) from public,anon;
revoke all on function public.academy_publish_learning_path(uuid,text) from public,anon;
grant execute on function public.academy_save_learning_path_draft(uuid,text,text,text,text,text,text,integer,text) to authenticated;
grant execute on function public.academy_save_learning_path_items(uuid,jsonb) to authenticated;
grant execute on function public.academy_publish_learning_path(uuid,text) to authenticated;

