
-- The exercises were already inserted by the previous (partially successful) migration.
-- Now insert the training program with a proper UUID.
INSERT INTO public.training_programs (
  title, description, category, level, sport, price, is_active, status, is_trial,
  total_weeks, block_type, periodization_config
) VALUES (
  '8-Week Foundation Block',
  'A periodized, joint-friendly strength protocol designed to build structural integrity, fix imbalances, and establish a baseline of real strength. Perfect for beginners and adults wanting to move pain-free.',
  'foundation',
  'Beginner',
  'General',
  0,
  true,
  'published',
  false,
  8,
  'linear',
  '{
    "phases": [
      {"name": "Structural Integrity", "weeks": [1,2,3,4], "focus": "Movement quality, joint stability, work capacity"},
      {"name": "Base Strength", "weeks": [5,6,7,8], "focus": "Progressive overload, compound strength, core endurance"}
    ]
  }'::jsonb
);
