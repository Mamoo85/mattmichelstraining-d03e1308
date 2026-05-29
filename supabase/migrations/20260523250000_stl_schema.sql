-- STL digital download schema: templates + listing tracking
-- Runs on both projects; secondary project (zmyczlfuufhngzovkjdh) is where the
-- etsy-digital-uploader function runs, so the tables are used there.

CREATE TABLE IF NOT EXISTS stl_templates (
  id               text        PRIMARY KEY,
  title            text        NOT NULL,
  description      text,
  category         text        NOT NULL,
  tags             text[]      NOT NULL DEFAULT '{}',
  price_cents      int         NOT NULL DEFAULT 349,
  filename_prefix  text        NOT NULL,
  active           bool        NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stl_listings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      text        NOT NULL REFERENCES stl_templates(id),
  etsy_listing_id  text,
  storage_path     text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','generating','listed','failed')),
  error_msg        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stl_listings_status_idx   ON stl_listings(status);
CREATE INDEX IF NOT EXISTS stl_listings_template_idx ON stl_listings(template_id);

-- Seed: 20 validated templates
INSERT INTO stl_templates (id, title, description, category, tags, price_cents, filename_prefix) VALUES
('cookie-round',
 'Round Cookie Cutter 50mm | STL File for 3D Printing',
 'Printable 50mm round cookie cutter. Clean 2mm wall, integrated handle. Print in PLA at 0.2mm layer height.',
 'cookie_cutter',
 ARRAY['cookie cutter','round cutter','3d printable','stl file','baking tool','fondant cutter','clay cutter','kitchen tool','diy baking','custom cookie','pastry tool','biscuit cutter','food safe stl'],
 349, 'round-cookie-cutter'),

('cookie-star-5pt',
 '5-Point Star Cookie Cutter | STL File for 3D Printing',
 'Printable 5-point star cookie cutter, 56mm tip-to-tip. Clean 2mm wall, integrated handle.',
 'cookie_cutter',
 ARRAY['star cookie cutter','5 point star','3d printable','stl file','baking tool','fondant cutter','clay cutter','kitchen tool','holiday baking','custom cookie','star shape','biscuit cutter','food safe stl'],
 349, 'star-5pt-cookie-cutter'),

('cookie-star-8pt',
 '8-Point Star Cookie Cutter | STL File for 3D Printing',
 'Printable 8-point star cookie cutter. Great for holiday cookies, clay, fondant. 2mm wall, handle included.',
 'cookie_cutter',
 ARRAY['star cookie cutter','8 point star','3d printable','stl file','baking tool','fondant cutter','clay cutter','christmas baking','holiday cookie','custom cutter','star shape','biscuit cutter','food safe stl'],
 349, 'star-8pt-cookie-cutter'),

('cookie-hexagon',
 'Hexagon Cookie Cutter | STL File for 3D Printing',
 'Printable hexagon cookie cutter 56mm flat-to-flat. Perfect for honeycomb patterns. 2mm wall, handle.',
 'cookie_cutter',
 ARRAY['hexagon cookie cutter','hex cutter','3d printable','stl file','baking tool','fondant cutter','clay cutter','geometric cutter','honeycomb cookie','custom cookie','hex shape','biscuit cutter','food safe stl'],
 349, 'hexagon-cookie-cutter'),

('cookie-heart',
 'Heart Cookie Cutter | STL File for 3D Printing',
 'Printable parametric heart cookie cutter. Classic heart shape, 2mm wall, integrated handle. Perfect for Valentine's Day.',
 'cookie_cutter',
 ARRAY['heart cookie cutter','heart cutter','3d printable','stl file','baking tool','fondant cutter','clay cutter','valentines day','love cookie','custom cutter','heart shape','biscuit cutter','food safe stl'],
 349, 'heart-cookie-cutter'),

('wall-hook-small',
 'Small Wall Hook 30mm | STL File for 3D Printing',
 'Compact wall hook with mounting plate. 30mm projection, two screw holes. Print in PETG for strength.',
 'wall_hook',
 ARRAY['wall hook','small hook','3d printable','stl file','coat hook','key hook','entryway hook','home organization','printable hook','wall mount','bathroom hook','garage hook','petg print'],
 299, 'wall-hook-small'),

('wall-hook-medium',
 'Medium Wall Hook 50mm | STL File for 3D Printing',
 'Mid-size wall hook. 50mm projection, mounting plate with two screw holes. Ideal for jackets and bags.',
 'wall_hook',
 ARRAY['wall hook','medium hook','3d printable','stl file','coat hook','jacket hook','entryway hook','home organization','printable hook','wall mount','closet hook','bag hook','petg print'],
 299, 'wall-hook-medium'),

('wall-hook-large',
 'Large Wall Hook 70mm | STL File for 3D Printing',
 'Heavy-duty wall hook. 70mm projection, large mounting plate. Handles coats, backpacks, and more.',
 'wall_hook',
 ARRAY['wall hook','large hook','3d printable','stl file','heavy duty hook','backpack hook','coat hook','home organization','printable hook','wall mount','garage hook','utility hook','petg print'],
 299, 'wall-hook-large'),

('cable-clip-2mm',
 'Micro Cable Clip 2mm | STL File for 3D Printing',
 'Snap-on cable clip for 2mm cables — earbuds, thin charging cables. Mounts anywhere.',
 'cable_management',
 ARRAY['cable clip','cable organizer','3d printable','stl file','desk organization','cable management','earbud clip','wire clip','cord organizer','desk tidy','cable holder','wire organizer','home office'],
 249, 'cable-clip-2mm'),

('cable-clip-5mm',
 'USB Cable Clip 5mm | STL File for 3D Printing',
 'Snap-on cable clip for 5mm cables — USB-A, USB-C, standard charging cables.',
 'cable_management',
 ARRAY['cable clip','usb cable clip','3d printable','stl file','desk organization','cable management','usb organizer','wire clip','cord organizer','desk tidy','cable holder','wire organizer','home office'],
 249, 'cable-clip-5mm'),

('cable-clip-10mm',
 'Power Cable Clip 10mm | STL File for 3D Printing',
 'Snap-on clip for 10mm power cords and thicker cables. Desk or wall mount.',
 'cable_management',
 ARRAY['cable clip','power cable clip','3d printable','stl file','desk organization','cable management','cord clip','wire clip','power cord organizer','desk tidy','cable holder','wire organizer','home office'],
 249, 'cable-clip-10mm'),

('phone-stand',
 'Phone Stand Portrait | STL File for 3D Printing',
 'Minimalist phone stand in portrait orientation. Stable base, back support, front ledge.',
 'desk_organizer',
 ARRAY['phone stand','phone holder','3d printable','stl file','desk accessory','phone dock','smartphone stand','desk organization','printable stand','phone rest','office desk','home office','phone cradle'],
 399, 'phone-stand'),

('pen-holder',
 'Hexagonal Pen Holder | STL File for 3D Printing',
 'Elegant hexagonal pen and pencil cup. Holds 12-15 pens. 4mm walls, solid base.',
 'desk_organizer',
 ARRAY['pen holder','pencil cup','3d printable','stl file','desk organizer','hexagon holder','pencil holder','desk accessory','office organizer','printable cup','pen cup','stationery holder','hex design'],
 399, 'pen-holder-hex'),

('card-holder',
 'Business Card Holder | STL File for 3D Printing',
 'Angled business card display stand. Holds ~20 cards at a clean viewing angle. Desk or reception.',
 'desk_organizer',
 ARRAY['business card holder','card stand','3d printable','stl file','desk organizer','card display','office accessory','card rack','desk display','printable holder','reception desk','name card','office decor'],
 399, 'business-card-holder'),

('soap-dish',
 'Soap Dish with Drainage Grid | STL File for 3D Printing',
 'Bar soap dish with 5 drainage slots to keep soap dry. Fits standard bar soaps.',
 'home',
 ARRAY['soap dish','soap holder','3d printable','stl file','bathroom organizer','bar soap holder','drainage soap dish','bathroom accessory','printable dish','soap tray','kitchen soap','bathroom decor','minimalist bath'],
 349, 'soap-dish'),

('drawer-divider-s',
 'Drawer Divider 150mm | STL File for 3D Printing',
 'Simple 150mm drawer divider. 3mm thick, 40mm tall. Print multiple to organize any drawer.',
 'home',
 ARRAY['drawer divider','drawer organizer','3d printable','stl file','kitchen organizer','drawer insert','utensil divider','home organization','printable divider','drawer tidy','small divider','storage solution','minimalist'],
 199, 'drawer-divider-150mm'),

('drawer-divider-l',
 'Drawer Divider 250mm | STL File for 3D Printing',
 'Long 250mm drawer divider. 3mm thick, 50mm tall. Ideal for cutlery and tool drawers.',
 'home',
 ARRAY['drawer divider','long divider','3d printable','stl file','kitchen organizer','drawer insert','cutlery divider','home organization','printable divider','drawer tidy','large divider','storage solution','utensil organizer'],
 199, 'drawer-divider-250mm'),

('dice-tray',
 'Hexagonal Dice Tray | STL File for 3D Printing',
 'Hexagonal dice rolling tray with 28mm walls. Keeps dice contained during tabletop games.',
 'gaming',
 ARRAY['dice tray','dice rolling tray','3d printable','stl file','tabletop gaming','dnd dice','board game','rpg accessory','hex dice tray','game accessory','printable tray','dungeons dragons','tabletop rpg'],
 449, 'dice-tray-hex'),

('key-rack',
 '4-Peg Key Rack | STL File for 3D Printing',
 'Wall-mounted key rack with 4 pegs. Fits standard keys, keychains, and small bags. Two screw holes.',
 'home',
 ARRAY['key rack','key holder','3d printable','stl file','entryway organizer','key peg','wall key rack','key storage','home organizer','printable rack','key hook','entryway decor','key hanger'],
 349, 'key-rack-4-peg'),

('plant-drain',
 'Plant Pot Drainage Insert 140mm | STL File for 3D Printing',
 'Drainage ring insert for 140mm (5.5") pots. 8 ribs elevate soil above water. Prevents root rot.',
 'home',
 ARRAY['pot drainage','plant pot insert','3d printable','stl file','plant care','drainage ring','indoor plant','succulent pot','garden tool','petg print','planter accessory','root rot prevention','planter insert']
 , 249, 'plant-drain-ring')

ON CONFLICT (id) DO NOTHING;
