-- Seed pod_niche_library with 25 niches targeting Etsy's top-20 most-searched keywords.
-- Focuses on audiences we CAN serve (mugs, tumblers, shirts, onesies, hoodies) even
-- when the primary keyword is a product we can't make (jewelry, nails, etc.).

INSERT INTO pod_niche_library (niche, product_type, active, source) VALUES

-- HORSE (7 niches — 187% YoY growth, Year of the Horse 2026)
('horse mom mug gift funny', 'mug', true, 'top20_keywords'),
('horse lover tumbler gift women', 'tumbler', true, 'top20_keywords'),
('horse girl hoodie gift funny', 'hoodie', true, 'top20_keywords'),
('horse lover tshirt funny gift', 'tshirt', true, 'top20_keywords'),
('western horse lover mug gift', 'mug', true, 'top20_keywords'),
('horse riding girl gift sweatshirt', 'sweatshirt', true, 'top20_keywords'),
('equestrian horse gift tumbler women', 'tumbler', true, 'top20_keywords'),

-- WEDDING (5 niches)
('bride gift mug funny wedding', 'mug', true, 'top20_keywords'),
('maid of honor gift mug funny', 'mug', true, 'top20_keywords'),
('bridesmaid gift tumbler personalized wedding', 'tumbler', true, 'top20_keywords'),
('wedding anniversary gift funny mug couple', 'mug', true, 'top20_keywords'),
('bride to be gift hoodie funny', 'hoodie', true, 'top20_keywords'),

-- BABY SHOWER — physical products (5 niches)
('baby shower gift funny onesie newborn', 'onesie', true, 'top20_keywords'),
('new mom gift funny mug baby shower', 'mug', true, 'top20_keywords'),
('baby shower mom to be tumbler gift', 'tumbler', true, 'top20_keywords'),
('funny new baby gift onesie humor', 'onesie', true, 'top20_keywords'),
('baby shower host gift mug funny', 'mug', true, 'top20_keywords'),

-- GIFT FOR HER / GIFT FOR HIM (4 niches)
('personalized gift for her funny mug birthday', 'mug', true, 'top20_keywords'),
('personalized gift for him funny tumbler', 'tumbler', true, 'top20_keywords'),
('gift for her funny hoodie birthday', 'hoodie', true, 'top20_keywords'),
('gift for him funny tshirt birthday', 'tshirt', true, 'top20_keywords'),

-- BEAUTY / NAIL / SELF-CARE ADJACENT (4 niches — targeting press-on-nail buyer profile)
('funny self care mug gift women', 'mug', true, 'top20_keywords'),
('beauty lover funny tshirt gift women', 'tshirt', true, 'top20_keywords'),
('spa day funny mug gift best friend', 'mug', true, 'top20_keywords'),
('glam girl funny hoodie gift birthday', 'hoodie', true, 'top20_keywords')

ON CONFLICT (niche) DO NOTHING;
