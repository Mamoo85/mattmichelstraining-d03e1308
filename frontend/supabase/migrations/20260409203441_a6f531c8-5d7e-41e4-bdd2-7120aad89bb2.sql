-- protocol_exercises: fix SELECT from public to authenticated
DROP POLICY "Users can view exercises for their protocols" ON public.protocol_exercises;
CREATE POLICY "Users can view exercises for their protocols"
  ON public.protocol_exercises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM protocols WHERE protocols.id = protocol_exercises.protocol_id AND (protocols.user_id = auth.uid() OR protocols.is_template = true)));

-- protocol_exercises: fix INSERT from public to authenticated
DROP POLICY "Users can insert exercises for their protocols" ON public.protocol_exercises;
CREATE POLICY "Users can insert exercises for their protocols"
  ON public.protocol_exercises FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM protocols WHERE protocols.id = protocol_exercises.protocol_id AND protocols.user_id = auth.uid()));

-- protocol_exercises: fix UPDATE from public to authenticated
DROP POLICY "Users can update exercises for their protocols" ON public.protocol_exercises;
CREATE POLICY "Users can update exercises for their protocols"
  ON public.protocol_exercises FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM protocols WHERE protocols.id = protocol_exercises.protocol_id AND protocols.user_id = auth.uid()));

-- protocols: fix all public-role policies to authenticated
DROP POLICY "Admins can insert protocols for anyone" ON public.protocols;
CREATE POLICY "Admins can insert protocols for anyone"
  ON public.protocols FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Admins can update all protocols" ON public.protocols;
CREATE POLICY "Admins can update all protocols"
  ON public.protocols FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Admins can view all protocols" ON public.protocols;
CREATE POLICY "Admins can view all protocols"
  ON public.protocols FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Users can insert their own protocols" ON public.protocols;
CREATE POLICY "Users can insert their own protocols"
  ON public.protocols FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can update their own protocols" ON public.protocols;
CREATE POLICY "Users can update their own protocols"
  ON public.protocols FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY "Users can view template protocols" ON public.protocols;
CREATE POLICY "Users can view template protocols"
  ON public.protocols FOR SELECT TO authenticated
  USING (is_template = true);

DROP POLICY "Users can view their own protocols" ON public.protocols;
CREATE POLICY "Users can view their own protocols"
  ON public.protocols FOR SELECT TO authenticated
  USING (auth.uid() = user_id);