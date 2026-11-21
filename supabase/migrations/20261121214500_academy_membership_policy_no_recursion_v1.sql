create or replace function public.academy_is_owner_or_admin()
returns boolean language sql stable security definer set search_path='' as $function$
 select exists(select 1 from public.academy_memberships m
  where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN'));
$function$;
revoke all on function public.academy_is_owner_or_admin() from public,anon;
grant execute on function public.academy_is_owner_or_admin() to authenticated;
drop policy if exists "Academy owners and admins can read memberships" on public.academy_memberships;
create policy "Academy owners and admins can read memberships" on public.academy_memberships
for select to authenticated using (public.academy_is_owner_or_admin());