-- themes only had an org-scoped policy ("org members manage own themes").
-- A published course's public renderer (/c/[slug]) needs to read the
-- theme it's assigned, as an anonymous visitor -- same gap pattern as the
-- courses/sections/lessons/blocks/questions tables already had a public
-- read policy for, but themes was missed since it's referenced by
-- courses.theme_id rather than being part of the section/lesson tree.

create policy "anyone reads themes of published courses" on themes
  for select using (
    exists (select 1 from courses c where c.theme_id = themes.id and c.status = 'PUBLISHED')
  );
