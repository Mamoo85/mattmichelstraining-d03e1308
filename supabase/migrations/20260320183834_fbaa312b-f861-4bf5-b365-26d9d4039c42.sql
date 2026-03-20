-- Create custom_program_requests table
CREATE TABLE public.custom_program_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  name text NOT NULL,
  age text,
  sport text,
  experience text,
  goals text,
  equipment text,
  injuries text,
  days_per_week text,
  additional_notes text,
  generated_program_id uuid REFERENCES public.training_programs(id),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- Add free_program_redeemed to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_program_redeemed boolean NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.custom_program_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests" ON public.custom_program_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own requests
CREATE POLICY "Users can read own requests" ON public.custom_program_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admins can update any request
CREATE POLICY "Admins can update requests" ON public.custom_program_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Protect free_program_redeemed from client tampering
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role') <> 'service_role' AND NOT has_role(auth.uid(), 'admin') THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.is_pro            := OLD.is_pro;
    NEW.account_role      := OLD.account_role;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.is_vip            := OLD.is_vip;
    NEW.is_in_person      := OLD.is_in_person;
    NEW.free_program_redeemed := OLD.free_program_redeemed;
  END IF;
  RETURN NEW;
END;
$function$;