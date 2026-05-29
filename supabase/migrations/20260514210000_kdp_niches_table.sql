-- kdp_niches: curated activity/theme niches for word search books (NOT POD product phrases)
CREATE TABLE IF NOT EXISTS kdp_niches (
  id         bigserial PRIMARY KEY,
  niche      text NOT NULL UNIQUE,
  category   text,     -- hobby | holiday | occupation | animal | food | sport | nature | theme | occasion | history
  used_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Cover image URL for KDP books (stored in Supabase Storage public bucket)
ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS cover_url text;

-- Old Gumroad product ID saved here before we delete + relist with corrected title
ALTER TABLE kdp_books ADD COLUMN IF NOT EXISTS gumroad_old_product_id text;

-- Migrate any existing bad-titled Gumroad products: save ID so uploader can delete them,
-- then clear gumroad_product_id so they get re-uploaded with a clean niche title.
UPDATE kdp_books
  SET gumroad_old_product_id = gumroad_product_id,
      gumroad_product_id     = NULL,
      gumroad_url            = NULL,
      status                 = 'ready'
WHERE gumroad_product_id IS NOT NULL;

-- Seed 70+ curated niches proven to sell as Amazon KDP word search books
INSERT INTO kdp_niches (niche, category) VALUES
  ('Camping',               'hobby'),
  ('Gardening',             'hobby'),
  ('Cooking',               'hobby'),
  ('Fishing',               'hobby'),
  ('Golf',                  'sport'),
  ('Yoga',                  'hobby'),
  ('Knitting',              'hobby'),
  ('Baking',                'hobby'),
  ('Photography',           'hobby'),
  ('Travel',                'hobby'),
  ('Hiking',                'hobby'),
  ('Cycling',               'sport'),
  ('Dog Lovers',            'animal'),
  ('Cat Lovers',            'animal'),
  ('Horse Lovers',          'animal'),
  ('Birds',                 'animal'),
  ('Butterflies',           'animal'),
  ('Farm Animals',          'animal'),
  ('Nurses',                'occupation'),
  ('Teachers',              'occupation'),
  ('Firefighters',          'occupation'),
  ('Police Officers',       'occupation'),
  ('Military Veterans',     'occupation'),
  ('Doctors',               'occupation'),
  ('Librarians',            'occupation'),
  ('Accountants',           'occupation'),
  ('Christmas',             'holiday'),
  ('Halloween',             'holiday'),
  ('Thanksgiving',          'holiday'),
  ('Easter',                'holiday'),
  ('Valentine Day',         'holiday'),
  ('Summer Fun',            'holiday'),
  ('Winter Wonderland',     'holiday'),
  ('Fourth of July',        'holiday'),
  ('Coffee Lovers',         'food'),
  ('Wine Lovers',           'food'),
  ('Pizza Lovers',          'food'),
  ('Chocolate Lovers',      'food'),
  ('Vegetables and Herbs',  'food'),
  ('Fruits',                'food'),
  ('Flowers',               'nature'),
  ('Ocean and Beach',       'nature'),
  ('Mountains',             'nature'),
  ('Forest',                'nature'),
  ('Desert',                'nature'),
  ('Tropical Paradise',     'nature'),
  ('National Parks',        'nature'),
  ('Bible Stories',         'theme'),
  ('Christian Faith',       'theme'),
  ('Inspirational Quotes',  'theme'),
  ('80s Nostalgia',         'theme'),
  ('90s Nostalgia',         'theme'),
  ('Classic Movies',        'theme'),
  ('Rock Music',            'theme'),
  ('Country Music',         'theme'),
  ('US States',             'theme'),
  ('World Geography',       'theme'),
  ('Famous Cities',         'theme'),
  ('Dinosaurs',             'theme'),
  ('Space and Astronomy',   'theme'),
  ('Science',               'theme'),
  ('Superheroes',           'theme'),
  ('Fantasy',               'theme'),
  ('Mystery',               'theme'),
  ('Science Fiction',       'theme'),
  ('Cars and Trucks',       'hobby'),
  ('Aviation',              'hobby'),
  ('Sailing',               'hobby'),
  ('Retirement',            'occasion'),
  ('Birthday Celebration',  'occasion'),
  ('Wedding',               'occasion'),
  ('Baby Shower',           'occasion'),
  ('Bridal Shower',         'occasion'),
  ('Basketball',            'sport'),
  ('Football',              'sport'),
  ('Baseball',              'sport'),
  ('Soccer',                'sport'),
  ('Ancient Egypt',         'history'),
  ('Medieval History',      'history'),
  ('Greek Mythology',       'history')
ON CONFLICT (niche) DO NOTHING;
