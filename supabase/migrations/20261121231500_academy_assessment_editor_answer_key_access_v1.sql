create or replace function public.academy_is_editorial_member()
returns boolean language sql stable security definer set search_path='' as $function$
 select exists(select 1 from public.academy_memberships m where m.user_id=auth.uid()
  and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER'));
$function$;
revoke all on function public.academy_is_editorial_member() from public,anon;
grant execute on function public.academy_is_editorial_member() to authenticated;
grant select on public.academy_assessment_answer_keys to authenticated;
create policy "Editorial members can read assessment answer keys" on public.academy_assessment_answer_keys
for select to authenticated using(public.academy_is_editorial_member());
