-- Refresh stale source data for M² Brief weekly newsletter
UPDATE public.monthly_challenges
SET is_active = false
WHERE is_active = true;

INSERT INTO public.monthly_challenges (title, description, metric_label, month, year, is_active)
VALUES (
  'The Late-April Recovery Reset',
  '7 nights of 8+ hours sleep paired with a daily 5-minute mobility flow. Track your nights and report back at the end of the week.',
  'nights logged',
  4,
  2026,
  true
)
ON CONFLICT (month, year) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      metric_label = EXCLUDED.metric_label,
      is_active = true;

INSERT INTO public.monthly_focus (month, year, title, topic, reasoning, matt_quote, status, metric_label, target_goal)
VALUES (
  4,
  2026,
  'Build the Engine',
  'Aerobic Base for Athletes',
  'Most youth athletes train for explosive output but lack the aerobic base to recover between reps and finish strong in the fourth quarter. Building base capacity in the off-weeks pays off when the games get tight.',
  'Speed is sexy. But aerobic capacity is what keeps you on the field in the 4th quarter.',
  'approved',
  'easy aerobic minutes',
  120
)
ON CONFLICT (month, year) DO UPDATE
  SET title = EXCLUDED.title,
      topic = EXCLUDED.topic,
      reasoning = EXCLUDED.reasoning,
      matt_quote = EXCLUDED.matt_quote,
      status = EXCLUDED.status;