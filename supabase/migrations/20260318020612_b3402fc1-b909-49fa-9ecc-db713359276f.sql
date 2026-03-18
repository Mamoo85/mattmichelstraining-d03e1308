INSERT INTO tier_features (feature_key, feature_label, description, sort_order, tier_basic, tier_pro, tier_elite, tier_team, tier_legend)
VALUES ('ask_coach_matt', 'Ask Coach Matt', 'Send questions and form check videos to Coach Matt from within programs', 13, false, true, true, true, true)
ON CONFLICT (feature_key) DO NOTHING;