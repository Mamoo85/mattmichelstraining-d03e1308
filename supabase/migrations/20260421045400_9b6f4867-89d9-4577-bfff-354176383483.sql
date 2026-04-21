-- For each email with duplicates, repoint contractor_lead_sites.active_contractor_id
-- from any duplicate id to the survivor id (lowest ctid).
WITH ranked AS (
  SELECT id, email, ctid,
         min(ctid) OVER (PARTITION BY email) AS keep_ctid
  FROM public.contractor_clients
),
keepers AS (
  SELECT DISTINCT ON (email) email, id AS keep_id
  FROM ranked WHERE ctid = keep_ctid
),
losers AS (
  SELECT r.id AS dup_id, k.keep_id
  FROM ranked r
  JOIN keepers k ON k.email = r.email
  WHERE r.ctid <> r.keep_ctid
)
UPDATE public.contractor_lead_sites s
SET active_contractor_id = l.keep_id
FROM losers l
WHERE s.active_contractor_id = l.dup_id;

-- Now safe to delete duplicates
DELETE FROM public.contractor_clients
WHERE ctid NOT IN (
  SELECT min(ctid) FROM public.contractor_clients GROUP BY email
);

ALTER TABLE public.contractor_clients
  ADD CONSTRAINT contractor_clients_email_key UNIQUE (email);