
-- Timestamp trigger function (reusable)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  athlete_name TEXT,
  is_pro BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SUBSCRIPTIONS TABLE
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  plan TEXT NOT NULL DEFAULT 'custom_program',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROTOCOLS TABLE (workout templates)
CREATE TABLE public.protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own protocols" ON public.protocols FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view template protocols" ON public.protocols FOR SELECT USING (is_template = true);
CREATE POLICY "Users can update their own protocols" ON public.protocols FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own protocols" ON public.protocols FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON public.protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROTOCOL EXERCISES TABLE
CREATE TABLE public.protocol_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  weight NUMERIC,
  rpe NUMERIC,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.protocol_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exercises for their protocols" ON public.protocol_exercises
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.protocols WHERE protocols.id = protocol_exercises.protocol_id AND (protocols.user_id = auth.uid() OR protocols.is_template = true))
  );
CREATE POLICY "Users can insert exercises for their protocols" ON public.protocol_exercises
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.protocols WHERE protocols.id = protocol_exercises.protocol_id AND protocols.user_id = auth.uid())
  );
CREATE POLICY "Users can update exercises for their protocols" ON public.protocol_exercises
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.protocols WHERE protocols.id = protocol_exercises.protocol_id AND protocols.user_id = auth.uid())
  );

-- PROGRESS LOGS TABLE (for 1RM tracking)
CREATE TABLE public.progress_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  reps INTEGER NOT NULL DEFAULT 1,
  estimated_1rm NUMERIC,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress" ON public.progress_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own progress" ON public.progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- DEFAULT PROTOCOL TEMPLATE (assigned to new users)
INSERT INTO public.protocols (id, title, description, is_template, is_default)
VALUES ('00000000-0000-0000-0000-000000000001', 'Introductory Strength Protocol', 'Your starting point while Matt builds your custom program.', true, true);

INSERT INTO public.protocol_exercises (protocol_id, exercise_name, sets, reps, notes, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Goblet Squats', 3, '8-10', 'Focus on depth and bracing. Control the descent.', 1),
  ('00000000-0000-0000-0000-000000000001', 'Push-Ups', 3, '10-15', 'Controlled eccentric — 3 seconds down. Full lockout.', 2),
  ('00000000-0000-0000-0000-000000000001', 'Plank', 3, '30-45s', 'Work capacity foundation. Squeeze everything.', 3);

-- Function to copy default protocol to new user on signup
CREATE OR REPLACE FUNCTION public.assign_default_protocol()
RETURNS TRIGGER AS $$
DECLARE
  new_protocol_id UUID;
  template_id UUID;
BEGIN
  SELECT id INTO template_id FROM public.protocols WHERE is_default = true AND is_template = true LIMIT 1;
  
  IF template_id IS NOT NULL THEN
    INSERT INTO public.protocols (user_id, title, description, is_template, is_default)
    SELECT NEW.id, title, description, false, false
    FROM public.protocols WHERE id = template_id
    RETURNING id INTO new_protocol_id;
    
    INSERT INTO public.protocol_exercises (protocol_id, exercise_name, sets, reps, notes, sort_order)
    SELECT new_protocol_id, exercise_name, sets, reps, notes, sort_order
    FROM public.protocol_exercises WHERE protocol_id = template_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_user_assign_protocol
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_protocol();
