
-- Admin trash for soft-deleting items with 30-day retention
CREATE TABLE public.admin_trash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_table TEXT NOT NULL,
  original_id TEXT NOT NULL,
  deleted_by UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  original_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  label TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.admin_trash ENABLE ROW LEVEL SECURITY;

-- Only admins can manage trash
CREATE POLICY "Admins can manage trash" ON public.admin_trash
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add soft-delete column to parent_inbox
ALTER TABLE public.parent_inbox ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Add soft-delete column to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
