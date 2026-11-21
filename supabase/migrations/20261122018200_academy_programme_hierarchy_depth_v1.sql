begin;
alter table public.academy_program_nodes
 drop constraint if exists academy_program_nodes_node_type_check;
alter table public.academy_program_nodes
 add constraint academy_program_nodes_node_type_check
 check (node_type in ('CYCLE','YEAR','SEMESTER','BLOCK','MODULE','UNIT','CHAPTER','SEQUENCE','LESSON','ACTIVITY'));

create or replace function public.academy_validate_program_node_parent()
returns trigger language plpgsql security definer set search_path='' as $function$
declare v_parent_type text; v_parent_rank integer; v_child_rank integer;
begin
 if new.parent_node_id is null then
  if new.node_type not in ('CYCLE','BLOCK') then
   raise exception 'Programme root nodes must be CYCLE or BLOCK' using errcode='23514';
  end if;
  return new;
 end if;
 select node_type into v_parent_type from public.academy_program_nodes
  where id=new.parent_node_id and program_id=new.program_id;
 if v_parent_type is null then raise exception 'Parent node must exist in the same programme' using errcode='23503'; end if;
 v_parent_rank:=case v_parent_type when 'CYCLE' then 1 when 'YEAR' then 2 when 'SEMESTER' then 3 when 'BLOCK' then 4 when 'MODULE' then 5 when 'UNIT' then 6 when 'CHAPTER' then 7 when 'SEQUENCE' then 8 when 'LESSON' then 9 when 'ACTIVITY' then 10 else 0 end;
 v_child_rank:=case new.node_type when 'CYCLE' then 1 when 'YEAR' then 2 when 'SEMESTER' then 3 when 'BLOCK' then 4 when 'MODULE' then 5 when 'UNIT' then 6 when 'CHAPTER' then 7 when 'SEQUENCE' then 8 when 'LESSON' then 9 when 'ACTIVITY' then 10 else 0 end;
 if v_child_rank<=v_parent_rank then raise exception 'Programme hierarchy cannot move to the same or a higher level' using errcode='23514'; end if;
 return new;
end;$function$;
revoke all on function public.academy_validate_program_node_parent() from public,anon,authenticated;
commit;