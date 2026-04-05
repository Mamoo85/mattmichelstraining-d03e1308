-- Seed Matt's own missed-call text-back row
-- Twilio number: (313) 992-1219 — Android forwards unanswered calls here
INSERT INTO public.missed_call_clients (
  business_name,
  contact_name,
  email,
  business_phone,
  twilio_number,
  response_message,
  active
)
SELECT
  'M² Performance Training',
  'Matt Michels',
  'matt@mattmichelstraining.com',
  '+13138064952',
  '+13139921219',
  'Hey! Just missed your call — I''ll call you right back. How can I help you? — Matt @ M² Training',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.missed_call_clients WHERE twilio_number = '+13139921219'
);
