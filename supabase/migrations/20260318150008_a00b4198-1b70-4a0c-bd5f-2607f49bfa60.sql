
-- AI action approval queue
CREATE TABLE public.ai_action_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,           -- form_check, coach_reply, newsletter, program_reply, exercise_sub, recovery_advice, ask_coach, program_generate, copilot, etc.
  target_user_id UUID,                 -- athlete the result is for (null for admin-only actions like newsletter)
  context JSONB NOT NULL DEFAULT '{}'::jsonb,  -- input context sent to AI
  ai_result TEXT NOT NULL DEFAULT '',  -- AI-generated output
  status TEXT NOT NULL DEFAULT 'pending',      -- pending, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  admin_notes TEXT
);

ALTER TABLE public.ai_action_queue ENABLE ROW LEVEL SECURITY;

-- Only admins can see and manage the queue
CREATE POLICY "Admins can manage ai queue"
  ON public.ai_action_queue
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert ai queue"
  ON public.ai_action_queue
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can read (edge functions)
CREATE POLICY "Service role can read ai queue"
  ON public.ai_action_queue
  FOR SELECT
  TO service_role
  USING (true);

-- Users can view their own pending actions
CREATE POLICY "Users can view own pending actions"
  ON public.ai_action_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = target_user_id);
