-- Fix product prices to match correct subscription pricing
UPDATE products SET price = 12.99 WHERE name = 'Basic Membership';
UPDATE products SET price = 19.99 WHERE name = 'Foundation Membership';
UPDATE products SET price = 49.99 WHERE name = 'Custom Membership';
UPDATE products SET price = 99.99 WHERE name = 'Team/Elite Membership';

-- Clean up tier_features: remove non-differentiating and disabled features
-- Remove Video Analysis (false for all tiers - not available yet)
DELETE FROM tier_features WHERE feature_key = 'video_analysis';

-- Remove redundant features that overlap with others
-- Ask Coach Matt overlaps with Coach Messaging
DELETE FROM tier_features WHERE feature_key = 'ask_coach_matt';

-- Remove niche features that clutter the comparison
DELETE FROM tier_features WHERE feature_key = 'community_workouts';
DELETE FROM tier_features WHERE feature_key = 'session_booking';
DELETE FROM tier_features WHERE feature_key = 'velocity_tracker';
DELETE FROM tier_features WHERE feature_key = 'posture_analysis';
DELETE FROM tier_features WHERE feature_key = 'nutrition_scanner';

-- Update remaining features with cleaner labels and proper sort order
UPDATE tier_features SET sort_order = 1, feature_label = 'Exercise Library', description = '200+ exercises filtered by sport, level & focus' WHERE feature_key = 'exercise_library';
UPDATE tier_features SET sort_order = 2, feature_label = 'Workout Logger', description = 'Log sets, reps & weights with progress tracking' WHERE feature_key = 'workout_logger';
UPDATE tier_features SET sort_order = 3, feature_label = 'Monthly Focus', description = 'New training focus from Coach Matt every month' WHERE feature_key = 'monthly_focus';
UPDATE tier_features SET sort_order = 4, feature_label = 'Progress Tracking', description = 'Charts, PRs & lift history over time' WHERE feature_key = 'progress_tracking';
UPDATE tier_features SET sort_order = 5, feature_label = 'Monthly Challenges', description = 'Compete on the community leaderboard' WHERE feature_key = 'challenges';
UPDATE tier_features SET sort_order = 6, feature_label = 'Fix It Library', description = 'Injury recovery & corrective exercise videos' WHERE feature_key = 'fix_it_library';
UPDATE tier_features SET sort_order = 7, feature_label = 'Coach Messaging', description = 'Direct access to Coach Matt' WHERE feature_key = 'coach_messaging';
UPDATE tier_features SET sort_order = 8, feature_label = 'Flag for Coach', description = 'Flag any exercise for personal review' WHERE feature_key = 'flag_coach';
UPDATE tier_features SET sort_order = 9, feature_label = 'Form Check Videos', description = 'Submit videos for technique review' WHERE feature_key = 'form_checks';
UPDATE tier_features SET sort_order = 10, feature_label = 'Custom Programming', description = 'Personalized 8-week program built by Matt' WHERE feature_key = 'custom_programming';
UPDATE tier_features SET sort_order = 11, feature_label = 'Team Management', description = 'Roster management & bulk programming' WHERE feature_key = 'team_management';