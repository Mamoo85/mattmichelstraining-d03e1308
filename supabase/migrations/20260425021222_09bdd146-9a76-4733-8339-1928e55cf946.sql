-- Drop the over-permissive public read policy
DROP POLICY IF EXISTS "public_read_checkout_receipts" ON public.checkout_receipts;

-- Authenticated users can only see receipts for their own email
CREATE POLICY "select_own_receipt_by_email"
  ON public.checkout_receipts
  FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'));