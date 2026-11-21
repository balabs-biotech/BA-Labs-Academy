create policy "Editors can read assessment questions" on public.academy_assessment_questions
for select to authenticated using(exists(select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')));
create policy "Editors can read assessment options" on public.academy_assessment_options
for select to authenticated using(exists(select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')));
create policy "Editors can read path assessment links" on public.academy_path_assessments
for select to authenticated using(exists(select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE' and m.role in ('OWNER','ADMIN','EDITOR','REVIEWER')));
