-- 1) Drop the overly permissive authenticated SELECT on business_listings base table
DROP POLICY IF EXISTS "Authenticated users can view active listings" ON public.business_listings;

-- 2) Add admin-only SELECT on base table (so admins can still see email/phone)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_listings' AND policyname = 'Admins can view all listings'
  ) THEN
    CREATE POLICY "Admins can view all listings"
      ON public.business_listings FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 3) Grant SELECT on business_listings_public view to authenticated and anon
GRANT SELECT ON public.business_listings_public TO authenticated;
GRANT SELECT ON public.business_listings_public TO anon;

-- 4) Add public SELECT policy on legal_documents for approved docs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'Anyone can read approved legal documents'
  ) THEN
    CREATE POLICY "Anyone can read approved legal documents"
      ON public.legal_documents FOR SELECT TO anon, authenticated
      USING (status = 'approved');
  END IF;
END $$;