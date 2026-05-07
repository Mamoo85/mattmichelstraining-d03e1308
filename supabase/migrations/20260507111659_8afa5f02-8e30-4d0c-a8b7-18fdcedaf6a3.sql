-- Purge junk page-section labels misextracted as candidate names
DELETE FROM public.hire_alert_candidates
WHERE name IN (
  'About Us','All Menus','Business Manager','Changing Lives','Empowering Workers',
  'Keywords Location','Local Union','Main Content','Main Menu','Only Customize',
  'Pay Dues','Union Representatives','Worker Apprentices','Worker Journeyperson',
  'Worker Journeypersons','About Our'
);