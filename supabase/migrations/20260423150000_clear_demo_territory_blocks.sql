-- Clear demo contractor IDs from all non-Detroit territories so real customers can sign up.
-- Root cause: 20260414120000 and 20260414100000 set active_contractor_id on EVERY territory
-- (including Livonia, Warren, Troy, etc.) to demo/test contractors at matt@detroitwebagent.com.
-- This caused all territories to show as CLAIMED on the signup page.
--
-- Strategy: clear active_contractor_id on all territories where the linked contractor
-- is a demo/test record (identified by email = matt@detroitwebagent.com).
-- Keep Detroit territories as-is (useful for demo flow + lead routing tests).

UPDATE contractor_lead_sites
SET active_contractor_id = NULL
WHERE active_contractor_id IN (
  SELECT id FROM contractor_clients
  WHERE email IN ('matt@detroitwebagent.com', 'matt@mattmichelstraining.com')
)
AND LOWER(city) NOT IN ('detroit');

-- Confirm: after this migration, only Detroit rows should have demo contractor IDs.
-- All other cities (Livonia, Warren, Troy, Dearborn, Sterling Heights, Royal Oak,
-- Pontiac, Ann Arbor, etc.) will show as OPEN (green) on the contractor leads page.
