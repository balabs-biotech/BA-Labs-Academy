-- Keep competency-domain classification represented in the Atlas and require an anchor before publication.
do $migration$
declare v_old text; v_new text;
begin
 select pg_get_functiondef('public.academy_save_competency_domains(uuid,text[])'::regprocedure) into v_old;
 v_old:=replace(v_old,'declare v_code text; v_count integer:=0;','declare v_code text; v_count integer:=0; v_skill_node uuid;');
 v_new:=replace(v_old,
  E' insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)\n select auth.uid(),''SKILL'',c.id,c.code,''UPDATED'',',
  E' select n.id into v_skill_node from public.atlas_nodes n join public.academy_competencies c on c.code=n.entity_key\n where c.id=p_competency_id and n.entity_type=''SKILL'' for update;\n if v_skill_node is null then raise exception ''Matching Atlas skill node is missing'' using errcode=''23514''; end if;\n delete from public.atlas_edges where source_node_id=v_skill_node and relation_type=''BELONGS_TO'' and status=''DRAFT'';\n insert into public.atlas_edges(source_node_id,target_node_id,relation_type,rationale,status)\n select v_skill_node,n.id,''BELONGS_TO'',''Compétence rattachée à son domaine disciplinaire.'',''DRAFT''\n from public.academy_competency_domains cd join public.atlas_nodes n on n.entity_type=''DOMAIN'' and n.entity_key=cd.domain_code\n where cd.competency_id=p_competency_id\n on conflict(source_node_id,target_node_id,relation_type) do update set rationale=excluded.rationale,status=''DRAFT'';\n insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,new_data,note)\n select auth.uid(),''SKILL'',c.id,c.code,''UPDATED'','
 );
 if v_new=v_old then raise exception 'Could not safely extend competency domain Atlas synchronization'; end if;
 execute v_new;
end;$migration$;

do $migration$
declare v_old text; v_new text;
begin
 select pg_get_functiondef('public.academy_publish_competency(uuid,text,text)'::regprocedure) into v_old;
 v_new:=replace(v_old,
  E' select n.id into v_node_id from public.atlas_nodes n where n.entity_type=''SKILL''',
  E' if not exists(select 1 from public.academy_competency_domains where competency_id=p_competency_id) then\n  raise exception ''At least one disciplinary domain anchor is required before publishing a competency'' using errcode=''23514'';\n end if;\n select n.id into v_node_id from public.atlas_nodes n where n.entity_type=''SKILL'''
 );
 if v_new=v_old then raise exception 'Could not safely enforce competency domain anchor'; end if;
 execute v_new;
end;$migration$;