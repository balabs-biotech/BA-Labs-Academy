-- Publish pathway graph node and USES / REQUIRES edges atomically with the pathway.
CREATE OR REPLACE FUNCTION public.academy_publish_learning_path(p_path_id uuid, p_note text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_code text;
  v_title text;
  v_path_node_id uuid;
  v_source_node_id uuid;
  v_target_node_id uuid;
  v_item record;
begin
  perform public.academy_assert_role(array['OWNER','ADMIN']);

  select to_jsonb(p),p.code,p.title into v_old,v_code,v_title
  from public.academy_learning_paths p
  where p.id=p_path_id and p.status='DRAFT'
  for update;
  if v_old is null then
    raise exception 'Draft learning path not found' using errcode='P0002';
  end if;
  if not exists(select 1 from public.academy_learning_path_items i where i.path_id=p_path_id) then
    raise exception 'A learning path must contain at least one resource' using errcode='23514';
  end if;
  if exists (
    select 1 from public.academy_learning_path_items i
    join public.content_items c on c.id=i.content_id
    where i.path_id=p_path_id
      and (c.status<>'PUBLISHED' or c.editorial_status<>'PUBLISHED' or c.visibility<>'PUBLIC')
  ) then
    raise exception 'All pathway resources must remain published and public' using errcode='23514';
  end if;

  select n.id into v_path_node_id
  from public.atlas_nodes n
  where n.entity_type='PATHWAY' and n.entity_key=v_code
  for update;

  if v_path_node_id is null then
    insert into public.atlas_nodes(node_key,entity_type,entity_key,title_override,visibility,status)
    values('pathway:'||v_code,'PATHWAY',v_code,v_title,'PUBLIC','DRAFT')
    returning id into v_path_node_id;
  end if;

  update public.atlas_nodes
  set title_override=v_title,visibility='PUBLIC',status='PUBLISHED',updated_at=now()
  where id=v_path_node_id;

  for v_item in
    select c.id content_id,c.business_id,c.title
    from public.academy_learning_path_items i
    join public.content_items c on c.id=i.content_id
    where i.path_id=p_path_id
    order by i.sort_order
  loop
    select n.id into v_target_node_id
    from public.atlas_nodes n
    where n.entity_type in ('MODULE','CONTENT')
      and n.entity_key=v_item.business_id
      and n.status='PUBLISHED'
      and n.visibility='PUBLIC'
    order by case when n.entity_type='MODULE' then 0 else 1 end
    limit 1;
    if v_target_node_id is null then
      raise exception 'Published Atlas node missing for pathway resource %',v_item.business_id using errcode='23514';
    end if;

    insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status)
    values(v_path_node_id,v_target_node_id,'USES','Ressource intégrée au parcours '||v_code,'PUBLISHED')
    on conflict(source_node_id,target_node_id,relation_type)
    do update set rationale=excluded.rationale,status='PUBLISHED';
  end loop;

  for v_item in
    select prereq_content.business_id prerequisite_business_id,
           target_content.business_id target_business_id
    from public.academy_path_item_prerequisites prereq
    join public.academy_learning_path_items prerequisite_item
      on prerequisite_item.id=prereq.prerequisite_item_id and prerequisite_item.path_id=prereq.path_id
    join public.content_items prereq_content on prereq_content.id=prerequisite_item.content_id
    join public.academy_learning_path_items target_item
      on target_item.id=prereq.item_id and target_item.path_id=prereq.path_id
    join public.content_items target_content on target_content.id=target_item.content_id
    where prereq.path_id=p_path_id
  loop
    select n.id into v_source_node_id
    from public.atlas_nodes n
    where n.entity_type in ('MODULE','CONTENT')
      and n.entity_key=v_item.prerequisite_business_id
      and n.status='PUBLISHED' and n.visibility='PUBLIC'
    order by case when n.entity_type='MODULE' then 0 else 1 end limit 1;

    select n.id into v_target_node_id
    from public.atlas_nodes n
    where n.entity_type in ('MODULE','CONTENT')
      and n.entity_key=v_item.target_business_id
      and n.status='PUBLISHED' and n.visibility='PUBLIC'
    order by case when n.entity_type='MODULE' then 0 else 1 end limit 1;

    if v_source_node_id is null or v_target_node_id is null then
      raise exception 'Atlas nodes missing for a pathway prerequisite relation' using errcode='23514';
    end if;

    insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status)
    values(v_source_node_id,v_target_node_id,'REQUIRES','Prérequis du parcours '||v_code,'PUBLISHED')
    on conflict(source_node_id,target_node_id,relation_type)
    do update set rationale=excluded.rationale,status='PUBLISHED';
  end loop;

  update public.academy_learning_paths
  set status='PUBLISHED',visibility='PUBLIC',published_at=now(),updated_at=now()
  where id=p_path_id;

  select to_jsonb(p) into v_new from public.academy_learning_paths p where p.id=p_path_id;
  insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
  values(v_uid,'LEARNING_PATH',p_path_id,v_code,'PUBLISHED',v_old,v_new,coalesce(p_note,''));
end;
$function$

revoke all on function public.academy_publish_learning_path(uuid,text) from public,anon;
grant execute on function public.academy_publish_learning_path(uuid,text) to authenticated;
