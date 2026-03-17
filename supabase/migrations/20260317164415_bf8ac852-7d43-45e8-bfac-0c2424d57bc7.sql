
-- Add 'parent' and 'child' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'child';

-- Parent-child linking table
CREATE TABLE public.parent_child_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL,
  child_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, child_user_id)
);

ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Parents can view own links"
  ON public.parent_child_links FOR SELECT
  TO authenticated
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Children can view own links"
  ON public.parent_child_links FOR SELECT
  TO authenticated
  USING (auth.uid() = child_user_id);

CREATE POLICY "Parents can create links"
  ON public.parent_child_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Parents can delete links"
  ON public.parent_child_links FOR DELETE
  TO authenticated
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Admins can manage links"
  ON public.parent_child_links FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow parents to view their child's progress_logs
CREATE POLICY "Parents can view child progress"
  ON public.progress_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_user_id = auth.uid() AND child_user_id = progress_logs.user_id
    )
  );

-- Allow parents to view their child's purchased_programs
CREATE POLICY "Parents can view child programs"
  ON public.purchased_programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_user_id = auth.uid() AND child_user_id = purchased_programs.user_id
    )
  );

-- Allow parents to view child's program_messages
CREATE POLICY "Parents can view child program messages"
  ON public.program_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_user_id = auth.uid() AND child_user_id = program_messages.user_id
    )
  );

-- Allow parents to insert program messages on behalf of child (flag questions)
CREATE POLICY "Parents can flag questions for child"
  ON public.program_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_user_id = auth.uid() AND child_user_id = program_messages.user_id
    )
  );

-- Allow parents to view child's workout logs
CREATE POLICY "Parents can view child workout logs"
  ON public.workout_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_user_id = auth.uid() AND child_user_id = workout_logs.user_id
    )
  );

-- Allow parents to view child's logged exercises
CREATE POLICY "Parents can view child logged exercises"
  ON public.logged_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_child_links pcl
      JOIN workout_logs wl ON wl.user_id = pcl.child_user_id
      WHERE pcl.parent_user_id = auth.uid() AND wl.id = logged_exercises.log_id
    )
  );

-- Allow parents to view child's user_active_programs
CREATE POLICY "Parents can view child active programs"
  ON public.user_active_programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_user_id = auth.uid() AND child_user_id = user_active_programs.user_id
    )
  );
