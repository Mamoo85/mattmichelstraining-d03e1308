
-- Add account_role to profiles for parent/athlete/independent tracking
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS account_role text NOT NULL DEFAULT 'independent_adult';

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_account_role ON public.profiles(account_role);
