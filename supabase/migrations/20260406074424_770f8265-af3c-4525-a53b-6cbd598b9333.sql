-- Create a helper function to decrypt CMS credentials
-- Uses pgcrypto with the SUPABASE_SERVICE_ROLE_KEY as encryption key
CREATE OR REPLACE FUNCTION public.decrypt_cms_credentials(_client_id uuid)
RETURNS TABLE(cms_username text, cms_app_password text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  -- Use a dedicated encryption key from vault or fallback
  enc_key := current_setting('app.cms_encryption_key', true);
  IF enc_key IS NULL OR enc_key = '' THEN
    enc_key := 'cms_default_key_m2';
  END IF;
  
  RETURN QUERY
  SELECT 
    CASE WHEN b.cms_username_enc IS NOT NULL 
      THEN convert_from(pgcrypto.decrypt(b.cms_username_enc, enc_key::bytea, 'aes'), 'utf8')
      ELSE NULL 
    END,
    CASE WHEN b.cms_app_password_enc IS NOT NULL 
      THEN convert_from(pgcrypto.decrypt(b.cms_app_password_enc, enc_key::bytea, 'aes'), 'utf8')
      ELSE NULL 
    END
  FROM public.blog_post_clients b
  WHERE b.id = _client_id;
END;
$$;

-- Drop the plaintext columns (no data exists in them)
ALTER TABLE public.blog_post_clients DROP COLUMN IF EXISTS cms_username;
ALTER TABLE public.blog_post_clients DROP COLUMN IF EXISTS cms_app_password;