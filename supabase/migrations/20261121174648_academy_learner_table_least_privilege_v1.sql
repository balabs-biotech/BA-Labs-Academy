-- Reduce learner table privileges to the operations currently required by the app.
-- Row-level security remains the primary row boundary; grants limit available SQL operations.

REVOKE ALL ON TABLE public.academy_member_progress FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.academy_member_progress FROM authenticated;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.academy_member_progress TO authenticated;

REVOKE ALL ON TABLE public.academy_path_enrollments FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.academy_path_enrollments FROM authenticated;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.academy_path_enrollments TO authenticated;

-- Explicitly keep editorial audit data inaccessible to client roles.
REVOKE ALL ON TABLE public.academy_editorial_events FROM anon, authenticated;
