-- Allow active editorial members to inspect the academic taxonomy, including drafts.
drop policy if exists "Academy editors can read departments" on public.departments;
create policy "Academy editors can read departments"
on public.departments for select to authenticated
using (exists (
  select 1 from public.academy_memberships m
  where m.user_id=auth.uid() and m.membership_status='ACTIVE'
    and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')
));

drop policy if exists "Academy editors can read domains" on public.domains;
create policy "Academy editors can read domains"
on public.domains for select to authenticated
using (exists (
  select 1 from public.academy_memberships m
  where m.user_id=auth.uid() and m.membership_status='ACTIVE'
    and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')
));
