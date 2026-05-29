INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-creatives', 'ad-creatives', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read ad-creatives"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-creatives');
