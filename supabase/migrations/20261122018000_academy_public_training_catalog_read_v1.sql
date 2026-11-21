grant select on public.academy_training_offerings,public.academy_training_sessions to anon,authenticated;
drop policy if exists "Public can read active training offerings" on public.academy_training_offerings;
create policy "Public can read active training offerings" on public.academy_training_offerings for select to anon,authenticated using (status='ACTIVE');
drop policy if exists "Public can read open training sessions" on public.academy_training_sessions;
create policy "Public can read open training sessions" on public.academy_training_sessions for select to anon,authenticated using (status='OPEN' and exists(select 1 from public.academy_training_offerings o where o.id=academy_training_sessions.offering_id and o.status='ACTIVE'));