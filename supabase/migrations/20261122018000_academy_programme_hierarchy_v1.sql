begin;

-- Academic programmes: a curriculum container with a reusable, ordered hierarchy.
create table if not exists public.academy_programs (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 slug text not null unique,
 title text not null,
 summary text not null default '',
 objectives text not null default '',
 program_type text not null check(program_type in ('FOUNDATION','SPECIALIZATION','PROFESSIONAL','RESEARCH','TRANSVERSAL')),
 target_audience text not null default '',
 difficulty_level text not null default 'FOUNDATION'
  check(difficulty_level in ('INTRODUCTORY','FOUNDATION','INTERMEDIATE','ADVANCED')),
 estimated_duration_hours numeric(8,2)
  check(estimated_duration_hours is null or estimated_duration_hours>0),
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
 visibility text not null default 'INTERNAL' check(visibility in ('PUBLIC','DISCOVERABLE','RESTRICTED','INTERNAL')),
 version_label text not null default '0.1',
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.academy_program_departments (
 program_id uuid not null references public.academy_programs(id) on delete cascade,
 department_code text not null references public.departments(code) on delete restrict,
 is_primary boolean not null default false,
 primary key(program_id,department_code)
);
create unique index if not exists academy_program_one_primary_department
 on public.academy_program_departments(program_id) where is_primary;

create table if not exists public.academy_program_domains (
 program_id uuid not null references public.academy_programs(id) on delete cascade,
 domain_code text not null references public.domains(code) on delete restrict,
 primary key(program_id,domain_code)
);

-- Tree levels are structural only; no lesson text or teaching material is stored here.
create table if not exists public.academy_program_nodes (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.academy_programs(id) on delete cascade,
 parent_node_id uuid,
 code text not null,
 node_type text not null check(node_type in ('CYCLE','YEAR','SEMESTER','BLOCK','MODULE','UNIT')),
 title text not null,
 summary text not null default '',
 sort_order integer not null check(sort_order>0),
 is_required boolean not null default true,
 estimated_minutes integer check(estimated_minutes is null or estimated_minutes>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(program_id,id),
 unique(program_id,code),
 unique(program_id,parent_node_id,sort_order),
 foreign key(program_id,parent_node_id)
  references public.academy_program_nodes(program_id,id) on delete cascade,
 check(parent_node_id is null or parent_node_id<>id)
);
create index if not exists academy_program_nodes_parent_order_idx
 on public.academy_program_nodes(program_id,parent_node_id,sort_order);

alter table public.academy_programs enable row level security;
alter table public.academy_program_departments enable row level security;
alter table public.academy_program_domains enable row level security;
alter table public.academy_program_nodes enable row level security;

drop policy if exists "Public can read published academy programmes" on public.academy_programs;
create policy "Public can read published academy programmes" on public.academy_programs
 for select to anon,authenticated using(status='PUBLISHED' and visibility='PUBLIC' and published_at is not null);
drop policy if exists "Editors can read academy programme drafts" on public.academy_programs;
create policy "Editors can read academy programme drafts" on public.academy_programs
 for select to authenticated using(public.academy_is_editorial_member());

drop policy if exists "Public can read published programme departments" on public.academy_program_departments;
create policy "Public can read published programme departments" on public.academy_program_departments
 for select to anon,authenticated using(exists(select 1 from public.academy_programs p where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null));
drop policy if exists "Editors can read programme departments" on public.academy_program_departments;
create policy "Editors can read programme departments" on public.academy_program_departments
 for select to authenticated using(public.academy_is_editorial_member());

drop policy if exists "Public can read published programme domains" on public.academy_program_domains;
create policy "Public can read published programme domains" on public.academy_program_domains
 for select to anon,authenticated using(exists(select 1 from public.academy_programs p where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null));
drop policy if exists "Editors can read programme domains" on public.academy_program_domains;
create policy "Editors can read programme domains" on public.academy_program_domains
 for select to authenticated using(public.academy_is_editorial_member());

drop policy if exists "Public can read published programme nodes" on public.academy_program_nodes;
create policy "Public can read published programme nodes" on public.academy_program_nodes
 for select to anon,authenticated using(exists(select 1 from public.academy_programs p where p.id=program_id and p.status='PUBLISHED' and p.visibility='PUBLIC' and p.published_at is not null));
drop policy if exists "Editors can read programme nodes" on public.academy_program_nodes;
create policy "Editors can read programme nodes" on public.academy_program_nodes
 for select to authenticated using(public.academy_is_editorial_member());

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
 v_parent_rank:=case v_parent_type when 'CYCLE' then 1 when 'YEAR' then 2 when 'SEMESTER' then 3 when 'BLOCK' then 4 when 'MODULE' then 5 when 'UNIT' then 6 else 0 end;
 v_child_rank:=case new.node_type when 'CYCLE' then 1 when 'YEAR' then 2 when 'SEMESTER' then 3 when 'BLOCK' then 4 when 'MODULE' then 5 when 'UNIT' then 6 else 0 end;
 if v_child_rank<=v_parent_rank then raise exception 'Programme hierarchy cannot move to the same or a higher level' using errcode='23514'; end if;
 return new;
end;$function$;
revoke all on function public.academy_validate_program_node_parent() from public,anon,authenticated;
drop trigger if exists academy_program_node_parent_guard on public.academy_program_nodes;
create trigger academy_program_node_parent_guard before insert or update of program_id,parent_node_id,node_type
 on public.academy_program_nodes for each row execute function public.academy_validate_program_node_parent();

create or replace function public.academy_save_program_draft(
 p_program_id uuid,p_code text,p_slug text,p_title text,p_summary text,p_objectives text,
 p_program_type text,p_target_audience text,p_difficulty_level text,p_estimated_duration_hours numeric,
 p_version_label text,p_departments jsonb,p_domains jsonb,p_nodes jsonb
) returns uuid language plpgsql security definer set search_path='' as $function$
declare
 v_uid uuid:=auth.uid(); v_id uuid; v_old jsonb; v_new jsonb;
 v_item jsonb; v_code text; v_domain text; v_parent_code text; v_node_count integer; v_inserted integer:=0; v_pass integer:=0;
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
 if (select count(distinct value->>'code') from jsonb_array_elements(p_nodes))<>jsonb_array_length(p_nodes) then
  raise exception 'Programme node codes must be unique' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_departments) loop
  v_code:=upper(btrim(v_item->>'code'));
  if not exists(select 1 from public.departments d where d.code=v_code and d.status<>'ARCHIVED') then raise exception 'Unknown or archived department: %',v_code using errcode='23503'; end if;
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
   or coalesce(v_item->>'node_type','') not in ('CYCLE','YEAR','SEMESTER','BLOCK','MODULE','UNIT')
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
 delete from public.academy_program_nodes where program_id=v_id;
 insert into public.academy_program_departments(program_id,department_code,is_primary)
  select v_id,upper(value->>'code'),coalesce((value->>'is_primary')::boolean,false) from jsonb_array_elements(p_departments);
 insert into public.academy_program_domains(program_id,domain_code)
  select v_id,upper(value->>'code') from jsonb_array_elements(p_domains);

 select jsonb_array_length(p_nodes) into v_node_count;
 while v_inserted<v_node_count loop
  v_pass:=v_pass+1;
  if v_pass>v_node_count then raise exception 'Programme hierarchy contains a missing parent or cycle' using errcode='23514'; end if;
  for v_item in select value from jsonb_array_elements(p_nodes) loop
   v_code:=upper(btrim(v_item->>'code'));
   if not exists(select 1 from public.academy_program_nodes n where n.program_id=v_id and n.code=v_code) then
    v_parent_code:=nullif(upper(btrim(v_item->>'parent_code')),'');
    if v_parent_code is null or exists(select 1 from public.academy_program_nodes n where n.program_id=v_id and n.code=v_parent_code) then
     insert into public.academy_program_nodes(program_id,parent_node_id,code,node_type,title,summary,sort_order,is_required,estimated_minutes)
     select v_id,(select n.id from public.academy_program_nodes n where n.program_id=v_id and n.code=v_parent_code),
      v_code,upper(v_item->>'node_type'),btrim(v_item->>'title'),coalesce(v_item->>'summary',''),
      (v_item->>'sort_order')::integer,coalesce((v_item->>'is_required')::boolean,true),nullif((v_item->>'estimated_minutes')::integer,0);
     v_inserted:=v_inserted+1;
    end if;
   end if;
  end loop;
 end loop;
 select to_jsonb(p) into v_new from public.academy_programs p where p.id=v_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(v_uid,'PROGRAMME',v_id,upper(btrim(p_code)),case when v_old is null then 'CREATED' else 'UPDATED' end,v_old,v_new,'Programme hierarchy and disciplinary scope saved');
 return v_id;
end;$function$;

create or replace function public.academy_publish_program(p_program_id uuid)
returns void language plpgsql security definer set search_path='' as $function$
declare v_old jsonb; v_new jsonb; v_code text; v_title text;
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 select to_jsonb(p),p.code,p.title into v_old,v_code,v_title from public.academy_programs p
  where p.id=p_program_id and p.status='DRAFT' for update;
 if v_old is null then raise exception 'Programme draft not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.academy_program_departments where program_id=p_program_id and is_primary)
  or not exists(select 1 from public.academy_program_domains where program_id=p_program_id)
  or not exists(select 1 from public.academy_program_nodes where program_id=p_program_id and parent_node_id is null) then
  raise exception 'Programme requires a primary discipline, at least one domain and a root structure node' using errcode='23514';
 end if;
 update public.academy_programs set status='PUBLISHED',visibility='PUBLIC',published_at=now(),updated_at=now() where id=p_program_id;
 select to_jsonb(p) into v_new from public.academy_programs p where p.id=p_program_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(auth.uid(),'PROGRAMME',p_program_id,v_code,'PUBLISHED',v_old,v_new,'Programme hierarchy published');
end;$function$;

revoke all on function public.academy_validate_program_node_parent() from public,anon,authenticated;
revoke all on function public.academy_save_program_draft(uuid,text,text,text,text,text,text,text,text,numeric,text,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.academy_publish_program(uuid) from public,anon;
grant execute on function public.academy_save_program_draft(uuid,text,text,text,text,text,text,text,text,numeric,text,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.academy_publish_program(uuid) to authenticated;
grant select on public.academy_programs,public.academy_program_departments,public.academy_program_domains,public.academy_program_nodes to anon,authenticated;

commit;
