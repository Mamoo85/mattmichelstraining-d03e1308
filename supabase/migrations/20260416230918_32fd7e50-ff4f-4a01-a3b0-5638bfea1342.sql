-- Cleanup all test/duplicate hire_alert_clients rows and consolidate to one canonical test client
DELETE FROM public.hire_alert_clients;

INSERT INTO public.hire_alert_clients (
  owner_email,
  company_name,
  plan,
  active,
  target_roles
) VALUES (
  'matt@mattmichelstraining.com',
  'M2 Test Co',
  'standalone',
  true,
  ARRAY[
    'boiler_operator','hvac_tech','plumber','electrician','pipefitter',
    'steam_engineer','industrial_mechanic','refrigeration_tech','pressure_vessel',
    'fire_suppression','cna','lpn','rn','director_of_nursing','home_health_aide'
  ]
);