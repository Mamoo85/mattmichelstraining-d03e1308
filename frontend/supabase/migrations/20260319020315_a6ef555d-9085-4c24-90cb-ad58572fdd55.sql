
-- User privacy settings table (one row per user)
CREATE TABLE public.user_privacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  show_points boolean NOT NULL DEFAULT true,
  show_level boolean NOT NULL DEFAULT true,
  show_lifts boolean NOT NULL DEFAULT true,
  show_challenges boolean NOT NULL DEFAULT true,
  show_nutrition boolean NOT NULL DEFAULT false,
  show_streaks boolean NOT NULL DEFAULT true,
  show_programs boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view own privacy settings"
  ON public.user_privacy_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own privacy settings"
  ON public.user_privacy_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own privacy settings"
  ON public.user_privacy_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all settings
CREATE POLICY "Admins can view all privacy settings"
  ON public.user_privacy_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can read other users' settings (needed to check visibility)
CREATE POLICY "Authenticated can read privacy settings for visibility checks"
  ON public.user_privacy_settings FOR SELECT
  TO authenticated
  USING (true);

-- Auto-create privacy settings row on profile creation
CREATE OR REPLACE FUNCTION public.create_default_privacy_settings()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_privacy_settings (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_privacy_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_privacy_settings();

-- Updated_at trigger
CREATE TRIGGER trg_privacy_settings_updated_at
  BEFORE UPDATE ON public.user_privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
