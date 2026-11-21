-- Track learner progress per path item so prerequisites are enforced per pathway.
CREATE TABLE IF NOT EXISTS public.academy_path_item_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_item_id uuid NOT NULL REFERENCES public.academy_learning_path_items(id) ON DELETE CASCADE,
  progress_status text NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (progress_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
  progress_percent numeric NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, path_item_id)
);

ALTER TABLE public.academy_path_item_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their own path item progress"
  ON public.academy_path_item_progress;
CREATE POLICY "Members can read their own path item progress"
  ON public.academy_path_item_progress
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.academy_path_item_progress FROM anon, authenticated;
GRANT SELECT ON TABLE public.academy_path_item_progress TO authenticated;

CREATE OR REPLACE FUNCTION public.academy_record_path_item_progress(
  p_path_item_id uuid,
  p_completed boolean DEFAULT false
)
RETURNS public.academy_path_item_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_path_id uuid;
  v_content_id uuid;
  v_record public.academy_path_item_progress;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  SELECT pi.path_id, pi.content_id
    INTO v_path_id, v_content_id
  FROM public.academy_learning_path_items pi
  JOIN public.academy_learning_paths p
    ON p.id = pi.path_id
   AND p.status = 'PUBLISHED'
   AND p.visibility = 'PUBLIC'
   AND p.published_at IS NOT NULL
  JOIN public.content_items c
    ON c.id = pi.content_id
   AND c.status = 'PUBLISHED'
   AND c.editorial_status = 'PUBLISHED'
   AND c.visibility = 'PUBLIC'
  JOIN public.academy_path_enrollments e
    ON e.path_id = pi.path_id
   AND e.user_id = v_uid
   AND e.enrollment_status = 'ACTIVE'
  WHERE pi.id = p_path_item_id;

  IF v_path_id IS NULL OR v_content_id IS NULL THEN
    RAISE EXCEPTION 'Active enrollment and published path item are required'
      USING errcode = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.academy_path_item_prerequisites prereq
    WHERE prereq.path_id = v_path_id
      AND prereq.item_id = p_path_item_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.academy_path_item_progress completed
        WHERE completed.user_id = v_uid
          AND completed.path_item_id = prereq.prerequisite_item_id
          AND completed.progress_status = 'COMPLETED'
      )
  ) THEN
    RAISE EXCEPTION 'Path item prerequisites are not completed'
      USING errcode = '23514';
  END IF;

  INSERT INTO public.academy_path_item_progress (
    user_id, path_item_id, progress_status, progress_percent,
    started_at, completed_at, last_accessed_at, updated_at
  )
  VALUES (
    v_uid,
    p_path_item_id,
    CASE WHEN coalesce(p_completed, false) THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
    CASE WHEN coalesce(p_completed, false) THEN 100 ELSE 10 END,
    now(),
    CASE WHEN coalesce(p_completed, false) THEN now() ELSE NULL END,
    now(),
    now()
  )
  ON CONFLICT (user_id, path_item_id) DO UPDATE
  SET progress_status = CASE
        WHEN public.academy_path_item_progress.progress_status = 'COMPLETED'
          THEN 'COMPLETED'
        WHEN EXCLUDED.progress_status = 'COMPLETED'
          THEN 'COMPLETED'
        ELSE 'IN_PROGRESS'
      END,
      progress_percent = greatest(
        public.academy_path_item_progress.progress_percent,
        EXCLUDED.progress_percent
      ),
      started_at = coalesce(public.academy_path_item_progress.started_at, now()),
      completed_at = coalesce(
        public.academy_path_item_progress.completed_at,
        EXCLUDED.completed_at
      ),
      last_accessed_at = now(),
      updated_at = now()
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$function$;

REVOKE ALL ON FUNCTION public.academy_record_path_item_progress(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_record_path_item_progress(uuid, boolean)
  TO authenticated;
