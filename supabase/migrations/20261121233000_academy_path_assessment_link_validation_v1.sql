create or replace function public.academy_save_path_assessments(p_path_id uuid,p_requirements jsonb) returns void
language plpgsql security definer set search_path='' as $function$
declare v_req jsonb; v_order integer:=0; v_assessment_id uuid; v_score numeric;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN','EDITOR']);
 if coalesce(jsonb_typeof(p_requirements),'')<>'array' then raise exception 'Requirements must be a JSON array' using errcode='22023'; end if;
 if not exists(select 1 from public.academy_learning_paths where id=p_path_id and status='DRAFT') then
  raise exception 'Only draft pathways can be configured' using errcode='42501';
 end if;
 delete from public.academy_path_assessments where path_id=p_path_id;
 for v_req in select value from jsonb_array_elements(p_requirements) loop
  v_order:=v_order+1;
  if coalesce(v_req->>'assessment_id','')='' then raise exception 'Assessment ID is required' using errcode='22023'; end if;
  v_assessment_id:=(v_req->>'assessment_id')::uuid;
  v_score:=coalesce((v_req->>'minimum_score')::numeric,70);
  if v_score<0 or v_score>100 then raise exception 'Minimum score must be between 0 and 100' using errcode='22023'; end if;
  if not exists(select 1 from public.academy_assessments where id=v_assessment_id and status='PUBLISHED' and visibility='PUBLIC') then
   raise exception 'Only published public assessments can be linked to a public pathway' using errcode='23503';
  end if;
  insert into public.academy_path_assessments(path_id,assessment_id,sort_order,is_required,minimum_score)
  values(p_path_id,v_assessment_id,v_order,coalesce((v_req->>'is_required')::boolean,true),v_score);
 end loop;
end;$function$;
revoke all on function public.academy_save_path_assessments(uuid,jsonb) from public,anon;
grant execute on function public.academy_save_path_assessments(uuid,jsonb) to authenticated;
