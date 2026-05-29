-- ad_creatives — ad_creative_assets + mockup_templates + Storage bucket policies
-- Part of DWA SaaS Platform: Ad Creative Generator (sharp-based, free)
-- ad-creative-generator function uploads JPEGs to Supabase Storage and logs URLs here

-- mockup_templates: template configs for ad creatives
CREATE TABLE IF NOT EXISTS mockup_templates (
  id              text PRIMARY KEY,                  -- slug e.g. 'sq-blue-price', 'story-white-badge'
  name            text NOT NULL,
  platform        text NOT NULL DEFAULT 'all',       -- 'facebook' | 'instagram' | 'pinterest' | 'google' | 'all'
  aspect_ratio    text NOT NULL DEFAULT '1:1',       -- '1:1' | '9:16' | '4:5' | '1.91:1'
  background_url  text,                              -- Supabase Storage path: templates/{id}.png
  config          jsonb NOT NULL DEFAULT '{}',       -- { width, height, product_zone, text_zones[] }
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ad_creative_assets: generated creatives linked to etsy listings
CREATE TABLE IF NOT EXISTS ad_creative_assets (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  listing_id      text NOT NULL,                     -- etsy_listings.listing_id
  template_id     text NOT NULL REFERENCES mockup_templates(id),
  asset_url       text NOT NULL,                     -- public Supabase Storage URL
  storage_path    text NOT NULL,                     -- ad-creatives/{listing_id}/{template_id}.jpg
  dimensions      jsonb DEFAULT '{}',                -- { width, height }
  created_at      timestamptz DEFAULT now(),
  UNIQUE(listing_id, template_id)
);

CREATE INDEX IF NOT EXISTS ad_creative_assets_listing_idx   ON ad_creative_assets (listing_id);
CREATE INDEX IF NOT EXISTS ad_creative_assets_user_idx      ON ad_creative_assets (user_id);
CREATE INDEX IF NOT EXISTS ad_creative_assets_template_idx  ON ad_creative_assets (template_id);

ALTER TABLE ad_creative_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_creatives" ON ad_creative_assets;
CREATE POLICY "own_creatives" ON ad_creative_assets
  FOR ALL
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001');

-- Seed 10 starter templates
-- Matt replaces background PNGs with real Canva/Photoshop exports
-- product_zone: where to composite the product image
-- text_zones: price + headline overlays via SVG in sharp

INSERT INTO mockup_templates (id, name, platform, aspect_ratio, config) VALUES
  ('sq-navy-price',    'Square Navy — Price Badge',    'all',       '1:1',    '{"width":1080,"height":1080,"product_zone":{"left":80,"top":80,"width":700,"height":700},"text_zones":[{"label":"price","x":830,"y":960,"size":52,"color":"#FFFFFF","align":"center"},{"label":"headline","x":540,"y":1020,"size":32,"color":"#CCCCCC","align":"center"}]}'::jsonb),
  ('sq-white-clean',   'Square White — Clean',         'all',       '1:1',    '{"width":1080,"height":1080,"product_zone":{"left":90,"top":90,"width":720,"height":720},"text_zones":[{"label":"price","x":540,"y":980,"size":56,"color":"#333333","align":"center"},{"label":"headline","x":540,"y":1040,"size":30,"color":"#666666","align":"center"}]}'::jsonb),
  ('sq-dark-bold',     'Square Dark — Bold Type',      'facebook',  '1:1',    '{"width":1080,"height":1080,"product_zone":{"left":60,"top":60,"width":680,"height":680},"text_zones":[{"label":"price","x":820,"y":900,"size":60,"color":"#FFD700","align":"center"},{"label":"headline","x":540,"y":980,"size":36,"color":"#FFFFFF","align":"center"}]}'::jsonb),
  ('sq-peach-soft',    'Square Peach — Soft Brand',    'instagram', '1:1',    '{"width":1080,"height":1080,"product_zone":{"left":100,"top":100,"width":660,"height":660},"text_zones":[{"label":"price","x":830,"y":940,"size":48,"color":"#5C3317","align":"center"},{"label":"headline","x":540,"y":1010,"size":28,"color":"#5C3317","align":"center"}]}'::jsonb),
  ('story-white',      'Story White — Minimal',        'instagram', '9:16',   '{"width":1080,"height":1920,"product_zone":{"left":100,"top":200,"width":880,"height":880},"text_zones":[{"label":"price","x":540,"y":1200,"size":72,"color":"#222222","align":"center"},{"label":"headline","x":540,"y":1290,"size":40,"color":"#444444","align":"center"}]}'::jsonb),
  ('story-dark',       'Story Dark — Impact',          'instagram', '9:16',   '{"width":1080,"height":1920,"product_zone":{"left":90,"top":180,"width":900,"height":900},"text_zones":[{"label":"price","x":540,"y":1200,"size":76,"color":"#FFDD00","align":"center"},{"label":"headline","x":540,"y":1300,"size":42,"color":"#FFFFFF","align":"center"}]}'::jsonb),
  ('pin-portrait',     'Pinterest Portrait',           'pinterest', '2:3',    '{"width":1000,"height":1500,"product_zone":{"left":60,"top":60,"width":880,"height":880},"text_zones":[{"label":"price","x":500,"y":1050,"size":60,"color":"#FFFFFF","align":"center"},{"label":"headline","x":500,"y":1130,"size":34,"color":"#EEEEEE","align":"center"}]}'::jsonb),
  ('fb-landscape',     'Facebook Landscape',           'facebook',  '1.91:1', '{"width":1200,"height":628,"product_zone":{"left":20,"top":20,"width":580,"height":588},"text_zones":[{"label":"price","x":900,"y":380,"size":52,"color":"#FFFFFF","align":"center"},{"label":"headline","x":900,"y":450,"size":28,"color":"#DDDDDD","align":"center"}]}'::jsonb),
  ('sq-etsy-banner',   'Square Etsy Banner Style',     'all',       '1:1',    '{"width":1080,"height":1080,"product_zone":{"left":50,"top":50,"width":750,"height":750},"text_zones":[{"label":"price","x":860,"y":870,"size":50,"color":"#F56400","align":"center"},{"label":"headline","x":540,"y":1000,"size":30,"color":"#333333","align":"center"}]}'::jsonb),
  ('sq-gradient-pop',  'Square Gradient — Pop',        'all',       '1:1',    '{"width":1080,"height":1080,"product_zone":{"left":80,"top":80,"width":700,"height":700},"text_zones":[{"label":"price","x":840,"y":900,"size":54,"color":"#FFFFFF","align":"center"},{"label":"headline","x":540,"y":980,"size":32,"color":"#EEEEEE","align":"center"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
