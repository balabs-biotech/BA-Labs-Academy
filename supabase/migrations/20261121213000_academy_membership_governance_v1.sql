-- Academy membership governance. The first-owner bootstrap remains service_role-only.
drop policy if exists "Academy owners and admins can read memberships" on public.academy_memberships;
create policy "Academy owners and admins can read memberships" on public.academy_memberships
for select to authenticated
using (
 exists (
  select 1 from public.academy_memberships actor
  where actor.user_id=auth.uid() and actor.membership_status='ACTIVE'
   and actor.role in ('OWNER','ADMIN')
 )
);

create or replace function public.academy_manage_membership(
 p_user_id uuid,p_role text,p_status text,p_note text default ''
) returns void
language plpgsql security definer set search_path='' as $function$
declare
 v_actor uuid:=auth.uid(); v_actor_role text; v_old jsonb; v_new jsonb;
 v_target_role text; v_target_status text;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select role into v_actor_role from public.academy_memberships
 where user_id=v_actor and membership_status='ACTIVE';
 if v_actor_role not in ('OWNER','ADMIN') or v_actor_role is null then
  raise exception 'Active Owner or Admin role required' using errcode='42501';
 end if;
 if p_user_id is null or p_role not in ('OWNER','ADMIN','EDITOR','REVIEWER') or p_status not in ('ACTIVE','SUSPENDED') then
  raise exception 'Invalid membership parameters' using errcode='22023';
 end if;
 if not exists(select 1 from auth.users where id=p_user_id) then
  raise exception 'Auth user does not exist' using errcode='P0002';
 end if;
 if v_actor_role='ADMIN' and p_role not in ('EDITOR','REVIEWER') then
  raise exception 'Admins may assign only Editor or Reviewer roles' using errcode='42501';
 end if;
 if v_actor_role='ADMIN' and p_user_id=v_actor then
  raise exception 'Admins cannot modify their own membership' using errcode='42501';
 end if;
 select to_jsonb(m) into v_old from public.academy_memberships m where user_id=p_user_id for update;
 if v_old is not null and (v_old->>'role')='OWNER' and ((p_role<>'OWNER') or p_status<>'ACTIVE') then
  if (select count(*) from public.academy_memberships where role='OWNER' and membership_status='ACTIVE' and user_id<>p_user_id)=0 then
   raise exception 'At least one active Owner must remain' using errcode='23514';
  end if;
 end if;
 if v_actor_role='OWNER' and p_user_id=v_actor and (p_role<>'OWNER' or p_status<>'ACTIVE') then
  if (select count(*) from public.academy_memberships where role='OWNER' and membership_status='ACTIVE' and user_id<>p_user_id)=0 then
   raise exception 'You cannot remove the last active Owner' using errcode='23514';
  end if;
 end if;
 insert into public.academy_memberships(user_id,role,membership_status)
 values(p_user_id,p_role,p_status)
 on conflict(user_id) do update set role=excluded.role,membership_status=excluded.membership_status,updated_at=now();
 select to_jsonb(m) into v_new from public.academy_memberships m where user_id=p_user_id;
 insert into public.academy_editorial_events(actor_user_id,entity_type,entity_id,entity_key,action,old_data,new_data,note)
 values(v_actor,'MEMBERSHIP',p_user_id,p_user_id::text,case when v_old is null then 'MEMBER_CREATED' else 'MEMBER_UPDATED' end,v_old,v_new,left(coalesce(p_note,''),1000));
end;$function$;
revoke all on function public.academy_manage_membership(uuid,text,text,text) from public,anon;
grant execute on function public.academy_manage_membership(uuid,text,text,text) to authenticated;

create or replace function public.academy_list_members()
returns table(user_id uuid,email text,role text,membership_status text,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $function$
begin
 perform public.academy_assert_role(array['OWNER','ADMIN']);
 return query select m.user_id,u.email,m.role,m.membership_status,m.created_at,m.updated_at
 from public.academy_memberships m join auth.users u on u.id=m.user_id
 order by m.created_at asc;
end;$function$;
revoke all on function public.academy_list_members() from public,anon;
grant execute on function public.academy_list_members() to authenticated;
