-- Rename tier_features columns: pro→foundation, elite→custom, team→team_elite
ALTER TABLE public.tier_features RENAME COLUMN tier_pro TO tier_foundation;
ALTER TABLE public.tier_features RENAME COLUMN tier_elite TO tier_custom;
ALTER TABLE public.tier_features RENAME COLUMN tier_team TO tier_team_elite;