
-- Add show_name to user_privacy_settings
ALTER TABLE public.user_privacy_settings
ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;

-- Add random_alias to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS random_alias text;

-- Update check_user_visibility to support show_name
CREATE OR REPLACE FUNCTION public.check_user_visibility(_target_user_id uuid, _field text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE _field
    WHEN 'show_points' THEN COALESCE((SELECT show_points FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_level' THEN COALESCE((SELECT show_level FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_lifts' THEN COALESCE((SELECT show_lifts FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_challenges' THEN COALESCE((SELECT show_challenges FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_nutrition' THEN COALESCE((SELECT show_nutrition FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_streaks' THEN COALESCE((SELECT show_streaks FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_programs' THEN COALESCE((SELECT show_programs FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    WHEN 'show_name' THEN COALESCE((SELECT show_name FROM user_privacy_settings WHERE user_id = _target_user_id), true)
    ELSE true
  END
$$;

-- Create function to generate random alias
CREATE OR REPLACE FUNCTION public.generate_random_alias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  adjectives TEXT[] := ARRAY['Iron','Steel','Titan','Shadow','Storm','Thunder','Stealth','Savage','Apex','Forge','Granite','Blazing','Frostbite','Voltage','Nitro','Onyx','Phantom','Rapid','Venom','Arctic'];
  animals TEXT[] := ARRAY['Wolf','Hawk','Bear','Fox','Panther','Viper','Falcon','Lion','Eagle','Cobra','Raven','Tiger','Shark','Phoenix','Stallion','Lynx','Jaguar','Rhino','Bull','Mustang'];
  alias TEXT;
  tries INT := 0;
BEGIN
  IF NEW.random_alias IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  LOOP
    alias := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
          || animals[1 + floor(random() * array_length(animals, 1))::int]
          || (10 + floor(random() * 90))::int::text;
    
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE random_alias = alias);
    tries := tries + 1;
    EXIT WHEN tries > 10;
  END LOOP;
  
  NEW.random_alias := alias;
  RETURN NEW;
END;
$$;

-- Create trigger for new profiles
DROP TRIGGER IF EXISTS trg_generate_random_alias ON public.profiles;
CREATE TRIGGER trg_generate_random_alias
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_random_alias();

-- Backfill existing profiles that don't have an alias
UPDATE public.profiles
SET random_alias = 
  (ARRAY['Iron','Steel','Titan','Shadow','Storm','Thunder','Stealth','Savage','Apex','Forge','Granite','Blazing','Frostbite','Voltage','Nitro','Onyx','Phantom','Rapid','Venom','Arctic'])[1 + floor(random() * 20)::int]
  || (ARRAY['Wolf','Hawk','Bear','Fox','Panther','Viper','Falcon','Lion','Eagle','Cobra','Raven','Tiger','Shark','Phoenix','Stallion','Lynx','Jaguar','Rhino','Bull','Mustang'])[1 + floor(random() * 20)::int]
  || (10 + floor(random() * 90))::int::text
WHERE random_alias IS NULL;
