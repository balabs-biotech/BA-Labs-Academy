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
  if upper(btrim(p_code)) !~ '^[A-Z0-9][A-Z0-9_-]*$' then
    raise exception 'code must contain only letters, digits, hyphens or underscores' using errcode='22023';
  end if;
  if lower(btrim(p_slug)) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug must be lowercase alphanumeric words separated by hyphens' using errcode='22023';
  end if;
  if p_difficulty_level is null or p_difficulty_level not in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED') then
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
;

CREATE OR REPLACE FUNCTION public.academy_save_learning_path_editorial(p_path_id uuid, p_code text, p_slug text, p_title text, p_summary text, p_target_audience text, p_difficulty_level text, p_estimated_duration_minutes integer, p_version_label text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_path_id uuid;
begin
  perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
  v_path_id := public.academy_save_learning_path_draft(
    p_path_id,p_code,p_slug,p_title,p_summary,p_target_audience,
    p_difficulty_level,p_estimated_duration_minutes,p_version_label
  );
  perform public.academy_save_learning_path_items(v_path_id,p_items);
  return v_path_id;
end;
$function$
;
revoke all on function public.academy_save_learning_path_draft(uuid,text,text,text,text,text,text,integer,text) from public,anon;
revoke all on function public.academy_save_learning_path_editorial(uuid,text,text,text,text,text,text,integer,text,jsonb) from public,anon;
grant execute on function public.academy_save_learning_path_draft(uuid,text,text,text,text,text,text,integer,text) to authenticated;
grant execute on function public.academy_save_learning_path_editorial(uuid,text,text,text,text,text,text,integer,text,jsonb) to authenticated;
