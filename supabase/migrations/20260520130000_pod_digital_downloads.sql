-- POD Digital Downloads — Hybrid Catalog Extension
-- Adds digital download support to pod_product_queue with zero cross-contamination.
-- Digital items bypass Printify; they are created directly on Etsy as type:"download".

-- ── 1. Extend pod_product_queue for digital items ─────────────────────────────
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS is_digital_download boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_file_specs  text;

-- ── 2. Digital product tracking table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_digital_products (
  id                bigserial    PRIMARY KEY,
  queue_id          bigint       REFERENCES pod_product_queue(id),
  etsy_listing_id   text         NOT NULL,
  file_name         text,
  file_size_kb      int,
  price_cents       int          NOT NULL,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE pod_digital_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_digital_products
  FOR ALL USING (auth.role() = 'service_role');

-- ── 3. Seed 5 high-intent technical digital products ──────────────────────────
INSERT INTO pod_product_queue
  (name, product_type, image_prompt, description, digital_file_specs, retail_price, status, is_digital_download)
VALUES
(
  'Ultimate Gridfinity Workshop Storage STL Pack - 3D Printable Tool Organizer Modular System',
  'digital',
  'Professional 3D printing workshop product showcase: clean isometric render of modular Gridfinity storage bins and drawer inserts arranged on a white pegboard, mechanical engineering aesthetic, pure white background',
  'Instant digital download: 25+ custom STL files for Gridfinity-compatible modular tool organizers. Optimized for PLA/PETG. Modular grid layout covers standard shop sizes.',
  '{"file_types":["STL"],"file_count":"25+","archive_size_mb":18,"hardware_compatibility":"All FDM printers, PLA/PETG optimized","specs":"Modular Grid Layout, Gridfinity Standard"}',
  1999, 'pending', true
),
(
  'Parametric Living Hinge Box Templates - Multi-Size Laser Cutter SVG/DXF Vector Blueprint Bundle',
  'digital',
  'Precision laser cutter SVG blueprint design showcase: clean technical drawing of living hinge box patterns on bright white surface, vector lines in navy blue, engineering diagram aesthetic, multiple sizes flat lay',
  'Instant digital download: professional living hinge box SVG/DXF/AI vector templates. Material thickness optimized for 1/8in and 1/4in CNC wood sheets.',
  '{"file_types":["SVG","DXF","AI"],"file_count":"12 sizes","archive_size_mb":4,"hardware_compatibility":"LightBurn, Inkscape, AutoCAD, Fusion 360","specs":"Material Thickness: 1/8in & 1/4in Optimized"}',
  2450, 'pending', true
),
(
  'CNC Router Feeds & Speeds Calculator Matrix - Professional Machinist Reference Charts (PDF & XLSX)',
  'digital',
  'Professional machinist reference chart design: bold technical data table showing CNC feed rates and RPM values for aluminum, hardwood, acrylic and plastics, clean white and dark grey grid layout, engineering blueprint aesthetic, sharp typography',
  'Instant digital download: CNC router feeds and speeds matrix. Print-ready PDF and fully interactive Excel tool. Formulated for Wood, Plastics, and Aluminum.',
  '{"file_types":["PDF","XLSX"],"file_count":2,"archive_size_mb":2,"hardware_compatibility":"Any CNC router, end mills 1/8in to 1/2in","specs":"Formulated for Wood, Plastics, & Aluminum"}',
  1495, 'pending', true
),
(
  'Commercial Facility OSHA Compliance Safety Signage Pack - 30+ Printable High-Res PDF Warning Layouts',
  'digital',
  'OSHA safety signage design showcase: clean flat lay of professional safety signs on pure white background, bold red and yellow warning colors, ANSI/OSHA standard icon and text layout, industrial facility aesthetic',
  'Instant digital download: 30+ OSHA-compliant printable safety signs. Vector PDF format. Standard 8.5x11 and 11x17 industrial print scales.',
  '{"file_types":["PDF"],"file_count":"30+","archive_size_mb":12,"hardware_compatibility":"Any commercial or office printer, standard paper sizes","specs":"Standard 8.5x11 and 11x17 Industrial Scales"}',
  2900, 'pending', true
),
(
  'Modern Minimalist Home Assistant UI Dashboard Template - Clean YAML Configuration Code Layout',
  'digital',
  'Smart home UI dashboard showcase: clean tablet display showing dark minimalist Home Assistant dashboard with card grid layout, blue accent colors on white background product mockup, modern tech photography style',
  'Instant digital download: professional Home Assistant Lovelace YAML dashboard template. Raw YAML/JSON code assets for responsive mobile and tablet grids.',
  '{"file_types":["YAML","JSON","TXT"],"file_count":3,"archive_size_mb":1,"hardware_compatibility":"Home Assistant 2024.x+, tablet wall mounts, mobile","specs":"Responsive Mobile & Tablet Grids Included"}',
  1800, 'pending', true
)
ON CONFLICT DO NOTHING;
