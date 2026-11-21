drop policy if exists "Academy editors can read content drafts" on public.content_items;
create policy "Academy editors can read content drafts" on public.content_items
for select to authenticated
using (
 status='PUBLISHED' and visibility in ('PUBLIC','DISCOVERABLE')
 or exists (
  select 1 from public.academy_memberships m
  where m.user_id=auth.uid() and m.membership_status='ACTIVE'
   and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')
 )
);
drop policy if exists "Academy editors can read content department links" on public.content_department_links;
create policy "Academy editors can read content department links" on public.content_department_links
for select to authenticated
using (exists (
 select 1 from public.academy_memberships m
 where m.user_id=auth.uid() and m.membership_status='ACTIVE'
 and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')
));
drop policy if exists "Academy editors can read content domain links" on public.content_domain_links;
create policy "Academy editors can read content domain links" on public.content_domain_links
for select to authenticated
using (exists (
 select 1 from public.academy_memberships m
 where m.user_id=auth.uid() and m.membership_status='ACTIVE'
 and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')
));