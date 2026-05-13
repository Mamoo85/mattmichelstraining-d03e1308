
-- Normalize all existing emails first (defensive — should already be lowercase via promote)
UPDATE public.buyer_pools SET contact_email = lower(contact_email) WHERE contact_email <> lower(contact_email);

-- Plain unique constraint that ON CONFLICT (contact_email) can target
ALTER TABLE public.buyer_pools
  ADD CONSTRAINT buyer_pools_contact_email_unique UNIQUE (contact_email);
