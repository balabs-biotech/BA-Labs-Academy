drop policy if exists "Public can read competencies linked to public content"
  on public.academy_competencies;

create policy "Public can read published public competencies"
  on public.academy_competencies for select to anon, authenticated
  using (status = 'PUBLISHED' and visibility = 'PUBLIC');

drop policy if exists "Public can read competency links for public content"
  on public.academy_content_competencies;

create policy "Public can read competency links for public content and skills"
  on public.academy_content_competencies for select to anon, authenticated
  using (
    exists (
      select 1 from public.content_items c
      where c.id = content_id
        and c.status = 'PUBLISHED'
        and c.editorial_status = 'PUBLISHED'
        and c.visibility = 'PUBLIC'
    )
    and exists (
      select 1 from public.academy_competencies skill
      where skill.id = competency_id
        and skill.status = 'PUBLISHED'
        and skill.visibility = 'PUBLIC'
    )
  );
