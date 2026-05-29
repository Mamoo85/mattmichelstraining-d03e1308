-- ============================================================================
-- POD New Product Types: Constraint + Queue + Visual-Audit Tracking
-- Migration: 20260521150000_pod_new_types_queue.sql
--
-- Adds 7 new product types to the system (confirmed Printify blueprint IDs
-- from printify.com/app/products/{id} URLs):
--   canvas (190), leggings (516), pillow (1572), tanktop (1062),
--   croptop (627), joggers (591), laptopsleeve (429)
-- Fixes 3 stub blueprint IDs that were previously 0:
--   sticker (400), poster_v/h (852), truckercap (1446)
--
-- Queues 50 products (5 per type × 10 types) for the next 9am–1pm UTC window.
-- Products are created UNPUBLISHED. Visual audit runs via pod-visual-repair
-- auditVisual mode after each batch is created; failing designs stay unpublished
-- for manual review; passing designs are published via publishIds mode.
-- ============================================================================

-- ── 1. Expand pod_product_queue constraint to include all live types ──────────
ALTER TABLE pod_product_queue
  DROP CONSTRAINT IF EXISTS pod_product_queue_product_type_check;

ALTER TABLE pod_product_queue
  ADD CONSTRAINT pod_product_queue_product_type_check
  CHECK (product_type IN (
    'tshirt','hoodie','mug','sock','hat','mousepad','onesie','tumbler',
    'blanket','sweatshirt','longsleeve','travelmug','tumbler40','wineglass',
    'pintglass','shotglass','candle','coaster','greetingcard','sticker',
    'poster_v','poster_h','ornament','journal','truckercap','petbandana',
    'canvas','leggings','pillow','tanktop','croptop','joggers','laptopsleeve',
    'digital','phonecase_slim','phonecase_tough','puzzle'
  ));

-- ── 2. Visual-audit batch tracking table ─────────────────────────────────────
-- Tracks each batch of new-type products through the audit-then-publish cycle.
CREATE TABLE IF NOT EXISTS pod_new_type_audit_batches (
  id             bigserial    PRIMARY KEY,
  product_type   text         NOT NULL,
  queue_ids      int[]        NOT NULL,           -- pod_product_queue row IDs
  printify_ids   text[],                          -- populated after creation
  audit_status   text         NOT NULL DEFAULT 'pending',
  -- 'pending' → 'created' → 'auditing' → 'published' | 'failed'
  audit_scores   jsonb,                           -- {printify_id: score} from auditVisual
  failed_ids     text[],                          -- IDs that didn't pass score ≥3
  published_ids  text[],                          -- IDs successfully published
  created_at     timestamptz  NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

ALTER TABLE pod_new_type_audit_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_new_type_audit_batches
  FOR ALL USING (auth.role() = 'service_role');

-- ── 3. Queue 50 products (5 per type × 10 types) ─────────────────────────────
-- All queued as 'pending' — processed by pod-new-products 9am–1pm UTC daily.
-- retail_price is in cents (matching FINAL_PRICES in printify-product-creator).

INSERT INTO pod_product_queue
  (name, product_type, image_prompt, description, tags, retail_price, status)
VALUES

-- ─── CANVAS (5) — bp 190, $49.99 ──────────────────────────────────────────
(
  'Wildflower Meadow Cottagecore Canvas Gallery Wrap — Botanical Farmhouse Wall Art',
  'canvas',
  'Rich art nouveau botanical illustration: dried wildflowers, pampas grass, and meadow botanicals in warm sepia and sage tones, painterly oil-painting style, full-bleed edge-to-edge, farmhouse cottagecore aesthetic',
  'Beautiful wildflower meadow canvas print for farmhouse and cottagecore home decor.',
  '{}', 4999, 'pending'
),
(
  'Mountain Lake Wilderness Canvas Print — Pacific Northwest Minimalist Landscape Wall Art',
  'canvas',
  'Minimalist watercolor landscape: misty mountain peaks reflected in a glassy alpine lake, cool blue-grey palette with warm sunrise accents, full-bleed, serene Pacific Northwest wilderness art',
  'Stunning minimalist Pacific Northwest mountain lake canvas print for home or office.',
  '{}', 4999, 'pending'
),
(
  'Dark Academia Library Bookshelf Canvas — Antique Vintage Scholar Home Decor',
  'canvas',
  'Deep sepia oil-painted antique library: floor-to-ceiling leather-bound volumes, trailing ivy, brass bookplates, warm candlelight chiaroscuro, rich old-world academic atmosphere, full-bleed gallery canvas',
  'Dark academia library canvas print — the ultimate wall art for book lovers and scholars.',
  '{}', 4999, 'pending'
),
(
  'Celestial Moon Phase Chart Canvas Wall Art — Mystic Astrology Galaxy Print',
  'canvas',
  'Elegant celestial moon phase chart: eight phases of the moon in metallic gold on deep midnight-blue background, fine constellation lines and star clusters, minimalist cosmic art, full-bleed gallery canvas',
  'Stunning moon phase constellation canvas print — perfect for astrology lovers and bedroom wall art.',
  '{}', 4999, 'pending'
),
(
  'Retro Vaporwave Neon Grid Cityscape Canvas — Synthwave Retrowave Wall Art Print',
  'canvas',
  'Bold vaporwave retro cityscape: neon grid horizon, glowing purple-pink-cyan color palette, isometric wireframe buildings, retro sunset gradient sky, full-bleed edge-to-edge gallery canvas',
  'Retro vaporwave neon canvas print — the perfect gaming room and retrowave aesthetic wall art.',
  '{}', 4999, 'pending'
),

-- ─── LEGGINGS (5) — bp 516, $44.99 ────────────────────────────────────────
(
  'Galaxy Tie-Dye All-Over-Print Yoga Leggings — Cosmic High Waist Women',
  'leggings',
  'Vibrant all-over-print: swirling tie-dye galaxy in rich cobalt blue, violet, and magenta with star clusters and nebula clouds, seamless repeating pattern filling the entire canvas, bold saturated cosmic colors',
  'Stunning galaxy tie-dye AOP yoga leggings — high-waist fit, perfect for yoga class and festivals.',
  '{}', 4499, 'pending'
),
(
  'Wildflower Botanical AOP Yoga Leggings — Cottagecore Nature High Waist Women',
  'leggings',
  'Lush all-over-print: densely packed wildflowers, meadow botanicals, and trailing vines in warm sage green, blush, and golden yellow, seamless floral repeat pattern filling the entire canvas edge-to-edge',
  'Beautiful botanical wildflower all-over-print leggings — cottagecore and nature lover gift.',
  '{}', 4499, 'pending'
),
(
  'Bioluminescent Mushroom Forest AOP Leggings — Dark Cottagecore Witchy Women',
  'leggings',
  'Dark mystical all-over-print: glowing bioluminescent mushrooms, phosphorescent mycelium networks, and deep forest moss on dark emerald green, rich full-canvas seamless pattern, witchy cottagecore aesthetic',
  'Dark cottagecore mushroom all-over-print leggings — witchy aesthetic, yoga and festival wear.',
  '{}', 4499, 'pending'
),
(
  'Tropical Hibiscus Floral AOP Yoga Leggings — Hawaii Botanical Beach Women',
  'leggings',
  'Bold tropical all-over-print: large hibiscus blooms, palm leaves, and bird-of-paradise flowers in vivid coral, sunset orange, and deep green, seamless repeating tropical pattern filling entire canvas',
  'Gorgeous tropical floral AOP leggings — perfect for beach vacation, yoga, and tropical aesthetic.',
  '{}', 4499, 'pending'
),
(
  'Geometric Aztec Tribal All-Over Print Yoga Leggings — Southwestern Boho High Waist',
  'leggings',
  'Bold geometric all-over-print: interlocking Aztec diamond lattice, stepped pyramid motifs, and tribal medallions in terracotta red, turquoise, and warm sand, seamless repeating southwestern pattern, full canvas',
  'Bold Aztec geometric AOP leggings — southwestern boho tribal aesthetic, yoga and activewear.',
  '{}', 4499, 'pending'
),

-- ─── PILLOW (5) — bp 1572, $32.99 ─────────────────────────────────────────
(
  'Funny Dog Mom Throw Pillow — Custom Dog Breed Humorous Home Decor Gift',
  'pillow',
  'Cute cartoon golden retriever face with bold text "Dog Mom" in a fun serif font, centered on white background with paw print accents, warm and friendly illustration style',
  'Adorable dog mom throw pillow — the perfect gift for dog lovers and pet moms.',
  '{}', 3299, 'pending'
),
(
  'Mountain Cabin Rustic Lodge Throw Pillow — Wilderness Home Decor Gift',
  'pillow',
  'Cozy cabin in snow-dusted pine forest at dusk, warm amber cabin light glowing through windows, simple silhouette illustration style in navy and gold, centered on deep forest-green background',
  'Beautiful mountain cabin throw pillow — rustic lodge wilderness home decor for nature lovers.',
  '{}', 3299, 'pending'
),
(
  'Wildflower Botanical Boho Throw Pillow — Cottagecore Floral Home Decor',
  'pillow',
  'Loose watercolor wildflower bouquet centered on cream background: peonies, ranunculus, dried pampas, and eucalyptus in soft blush and sage tones, airy botanical illustration, centered with generous padding',
  'Beautiful wildflower botanical throw pillow — boho cottagecore floral home decor gift.',
  '{}', 3299, 'pending'
),
(
  'Sarcastic Work From Home Funny Throw Pillow — Office Humor Gift',
  'pillow',
  'Bold typography centered on white: large serif text "My Commute is 12 Steps" with a tiny house icon and a coffee cup, clean flat illustration style, black text with a warm amber accent',
  'Hilarious work-from-home throw pillow — funny office humor gift for remote workers.',
  '{}', 3299, 'pending'
),
(
  'Gothic Moon Phase Mystical Throw Pillow — Celestial Astrology Home Decor',
  'pillow',
  'Elegant gold monoline celestial design centered on deep midnight navy: eight moon phases arranged in an arc above a crescent moon and stars, delicate fine-line gold ink illustration on dark background',
  'Mystical moon phase throw pillow — celestial astrology gothic home decor for bedroom.',
  '{}', 3299, 'pending'
),

-- ─── TANK TOP (5) — bp 1062, $29.99 ───────────────────────────────────────
(
  'Funny Nurse Life AOP Tank Top — Running on Coffee and Chaos RN Gift',
  'tanktop',
  'Bold all-over-print: large chunky text "Running on Coffee and Chaos" with stethoscope icons and coffee cup illustrations scattered across the canvas in bold navy and white on a rich deep red background, full canvas',
  'Hilarious nurse life AOP tank top — the perfect funny nursing gift for nurses and RNs.',
  '{}', 2999, 'pending'
),
(
  'Tropical Floral All-Over-Print Tank Top — Beach Vacation Summer Boho Women',
  'tanktop',
  'Bold tropical all-over-print: lush hibiscus, monstera leaves, and birds of paradise in vibrant coral, yellow, and deep green, seamless repeating tropical pattern filling entire canvas, full-bleed summer aesthetic',
  'Gorgeous tropical floral AOP tank top — perfect beach vacation and summer festival wear.',
  '{}', 2999, 'pending'
),
(
  'Cat Mom Galaxy AOP Tank Top — Cosmic Celestial Funny Pet Lover Women',
  'tanktop',
  'Fun all-over-print: cute cartoon cat faces floating in a swirling galaxy of stars and nebula clouds, bold cat silhouettes with glowing eyes scattered across deep cosmic purple background, full canvas pattern',
  'Adorable cat mom galaxy AOP tank top — perfect funny gift for cat lovers and pet moms.',
  '{}', 2999, 'pending'
),
(
  'Retired Teacher Summer AOP Tank Top — Old School Funny Retirement Gift',
  'tanktop',
  'Playful all-over-print: scattered vintage school items — pencils, apples, books, blackboards with "RETIRED" — in bold retro flat illustration style on a bright sunshine yellow background, full canvas repeat',
  'Funny retired teacher AOP tank top — hilarious retirement gift for teachers.',
  '{}', 2999, 'pending'
),
(
  'Tie-Dye Sunrise Festival AOP Tank Top — Bohemian Summer Rainbow Women',
  'tanktop',
  'Vibrant all-over-print: swirling sunrise tie-dye pattern in warm peach, burnt orange, magenta, and golden yellow, seamless spiral dye pattern filling entire canvas edge-to-edge, bold bohemian summer aesthetic',
  'Stunning tie-dye sunrise AOP tank top — boho festival and summer beach wear.',
  '{}', 2999, 'pending'
),

-- ─── CROP TOP (5) — bp 627, $32.99 ────────────────────────────────────────
(
  'Wildflower Botanical Bees AOP Crop Top — Cottagecore Spring Nature Women',
  'croptop',
  'Charming all-over-print: honey bees and wildflowers — daisies, lavender, and clover — scattered across a soft sage-green background, cute flat botanical illustration style, seamless full-canvas repeat',
  'Adorable wildflower bees AOP crop top — cottagecore nature aesthetic for spring and summer.',
  '{}', 3299, 'pending'
),
(
  'Cosmic Galaxy Stardust All-Over Print Crop Tee — Celestial Space Women',
  'croptop',
  'Vibrant all-over-print: swirling galaxy with star clusters, nebula wisps, and scattered stardust in deep midnight navy, violet, and iridescent teal, seamless cosmic pattern filling entire canvas',
  'Stunning galaxy stardust AOP crop top — celestial space aesthetic for star lovers.',
  '{}', 3299, 'pending'
),
(
  'Retro Mushroom Psychedelic AOP Crop Tee — Y2K Aesthetic Cottagecore Women',
  'croptop',
  'Bold all-over-print: retro psychedelic mushrooms — red and white spotted amanitas, wavy stems and clouds — in groovy 70s color palette of mustard yellow, burnt orange, and avocado green, full-canvas seamless repeat',
  'Retro mushroom psychedelic AOP crop top — Y2K and cottagecore aesthetic for festival and casual wear.',
  '{}', 3299, 'pending'
),
(
  'Vintage Floral Market AOP Crop Top — Boho Floral Aesthetic Women Summer',
  'croptop',
  'Rich all-over-print: vintage market floral illustration — densely layered roses, ranunculus, and greenery in warm cream, dusty rose, and sage, loose painterly style, seamless repeat filling entire canvas',
  'Beautiful vintage floral market AOP crop top — boho aesthetic summer and festival wear.',
  '{}', 3299, 'pending'
),
(
  'Cute Cat Collage AOP Crop Tee — Quirky Funny Cat Mom Pattern Women',
  'croptop',
  'Fun all-over-print: dense collage of cute cartoon cats in various poses — sleeping, stretching, with paw prints and heart accents — in pastel lavender and peach on white background, seamless repeat',
  'Adorable cat collage AOP crop top — the perfect funny gift for cat moms and cat lovers.',
  '{}', 3299, 'pending'
),

-- ─── JOGGERS (5) — bp 591, $44.99 ─────────────────────────────────────────
(
  'Galaxy All-Over Print Joggers — Cosmic Celestial Lounge Sweatpants Women',
  'joggers',
  'Bold all-over-print: swirling deep space galaxy in cobalt blue, violet, and magenta with bright star clusters, seamless cosmic pattern filling the entire canvas edge-to-edge, rich saturated colors',
  'Stunning galaxy AOP joggers — cosmic celestial lounge pants perfect for athleisure and casual wear.',
  '{}', 4499, 'pending'
),
(
  'Tie-Dye Wave Bright AOP Joggers — Colorful Festival Lounge Sweatpants',
  'joggers',
  'Vibrant all-over-print: bold tie-dye wave pattern in electric rainbow colors — deep cobalt, hot pink, vivid lime, and sunset orange — seamless swirl pattern filling entire canvas, full-bleed',
  'Bold tie-dye AOP joggers — colorful festival lounge pants for athleisure and casual wear.',
  '{}', 4499, 'pending'
),
(
  'Vintage Floral Botanical AOP Joggers — Cottagecore Garden Lounge Pants Women',
  'joggers',
  'Lush all-over-print: vintage botanical illustration — cabbage roses, peonies, and trailing ivy — in warm blush, sage, and dusty rose on a deep forest green background, seamless full-canvas pattern',
  'Beautiful floral botanical AOP joggers — cottagecore garden aesthetic lounge pants.',
  '{}', 4499, 'pending'
),
(
  'Dark Academia Library Wallpaper AOP Joggers — Bookworm Scholar Lounge Pants',
  'joggers',
  'Moody all-over-print: dark academia library wallpaper pattern — antique books, quill pens, ink bottles, and gold compass roses — on deep burgundy background, dense seamless repeat, rich vintage aesthetic',
  'Dark academia library AOP joggers — bookworm scholar aesthetic lounge pants gift for readers.',
  '{}', 4499, 'pending'
),
(
  'Leopard Cheetah Animal Print AOP Joggers — Bold Sassy Lounge Sweatpants',
  'joggers',
  'Classic all-over-print: bold leopard cheetah animal print in warm caramel brown and black spots on creamy tan background, seamless authentic animal print pattern filling entire canvas, confident fashion-forward aesthetic',
  'Bold leopard print AOP joggers — sassy animal print lounge pants for confident women.',
  '{}', 4499, 'pending'
),

-- ─── LAPTOP SLEEVE (5) — bp 429, $34.99 ───────────────────────────────────
(
  'Wildflower Botanical Laptop Sleeve — Cottagecore Student Laptop Case',
  'laptopsleeve',
  'Full-surface print: lush watercolor wildflower illustration — meadow florals, dried botanicals, and trailing greenery — covering the entire laptop sleeve surface in warm sage and blush, edge-to-edge floral art',
  'Beautiful wildflower botanical laptop sleeve — cottagecore gift for students and book lovers.',
  '{}', 3499, 'pending'
),
(
  'Dark Academia Library Books Laptop Case — Scholar College Gift',
  'laptopsleeve',
  'Full-surface print: dark academia aesthetic — stacked leather-bound books, vintage inkwell, and quill on deep forest-green background — rich sepia and gold illustration covering the entire sleeve surface',
  'Dark academia laptop sleeve — perfect gift for students, scholars, and book lovers.',
  '{}', 3499, 'pending'
),
(
  'Retro Vaporwave Neon Grid Laptop Sleeve — Y2K Aesthetic Gamer Case',
  'laptopsleeve',
  'Full-surface print: bold vaporwave retro grid design — neon purple-pink-cyan geometric grid with retrowave cityscape and glitch accents — covering the entire laptop sleeve edge-to-edge, vivid neon colors',
  'Retro vaporwave neon laptop sleeve — the perfect gift for gamers and Y2K aesthetic fans.',
  '{}', 3499, 'pending'
),
(
  'Geometric Marble Art Deco Laptop Sleeve — Minimalist Modern Case',
  'laptopsleeve',
  'Elegant full-surface print: Art Deco geometric marble pattern — swirling white-and-gold Carrara marble with geometric line overlays and gold accents — covering entire sleeve surface, sophisticated minimalist aesthetic',
  'Elegant marble Art Deco laptop sleeve — minimalist modern laptop case for professionals.',
  '{}', 3499, 'pending'
),
(
  'Funny Cat Programmer Code Laptop Sleeve — Developer Nerd Geek Gift',
  'laptopsleeve',
  'Humorous full-surface print: cute cartoon cats typing at computers surrounded by floating code snippets and coffee cups on a dark terminal-green background, bold flat illustration covering entire sleeve surface',
  'Hilarious cat programmer laptop sleeve — the perfect gift for developers, coders, and tech nerds.',
  '{}', 3499, 'pending'
),

-- ─── STICKER (5) — bp 400, $7.99 ──────────────────────────────────────────
(
  'Funny Nurse Life Kiss-Cut Sticker — RN Appreciation Vinyl Laptop Decal',
  'sticker',
  'Clean flat vector sticker design: bold text "Nurses Because Doctors Need Heroes Too" with stethoscope icon, white background, bold navy text, clean die-cut edges suitable for kiss-cut vinyl sticker',
  'Funny nurse sticker — perfect gift for nurses and RNs as a laptop or water bottle decal.',
  '{}', 799, 'pending'
),
(
  'Wildflower Cottagecore Botanical Sticker — Floral Nature Laptop Decal',
  'sticker',
  'Beautiful flat vector botanical sticker: hand-drawn wildflower bouquet — daisies, lavender, and pampas grass — in sage and warm blush on white background, clean die-cut edge, suitable for kiss-cut vinyl',
  'Beautiful wildflower botanical sticker — perfect for laptops, water bottles, and journals.',
  '{}', 799, 'pending'
),
(
  'Funny Cat Sarcasm Quote Sticker — Sarcastic Pet Mom Laptop Decal',
  'sticker',
  'Cute flat vector sticker: cartoon grumpy cat with bold text "I Work Hard So My Cat Can Have a Better Life", white background, bold black text with red accent, clean die-cut edges for kiss-cut vinyl',
  'Hilarious cat mom sticker — perfect for laptops, water bottles, and cat lovers everywhere.',
  '{}', 799, 'pending'
),
(
  'Retro Mushroom Cottagecore Sticker — Dark Forest Fungi Laptop Decal',
  'sticker',
  'Charming flat vector sticker: retro amanita mushroom with polka dots in bold red and white on white background, surrounded by tiny stars and mushroom sprouts, clean die-cut edge for kiss-cut vinyl',
  'Cute retro mushroom sticker — cottagecore and nature aesthetic for laptops and water bottles.',
  '{}', 799, 'pending'
),
(
  'Inspirational Boho Sun Quote Sticker — Motivational Laptop Decal',
  'sticker',
  'Clean flat vector sticker: bold boho sun illustration with rays and text "She Believed She Could So She Did", warm gold and terracotta on white background, clean die-cut edge for kiss-cut vinyl',
  'Inspirational boho sun sticker — motivational decal for laptops, water bottles, and planners.',
  '{}', 799, 'pending'
),

-- ─── POSTER (5) — bp 852, $21.99 ──────────────────────────────────────────
(
  'Dark Floral Botanical Wall Art Poster — Moody Cottagecore Print',
  'poster_v',
  'Moody botanical illustration poster: dark cottagecore florals — black roses, dried botanicals, and trailing vines — in deep burgundy and forest green on charcoal background, full-bleed vertical print',
  'Stunning dark floral botanical poster — moody cottagecore wall art for home decor.',
  '{}', 2199, 'pending'
),
(
  'Retro Dog Breed Illustration Poster — Mid-Century Modern Pet Wall Art',
  'poster_v',
  'Charming mid-century modern illustrated poster: vintage flat-art golden retriever portrait in warm amber and cream, retro sans-serif typography with decorative borders, full-bleed vertical art print',
  'Adorable retro dog breed poster — perfect pet lover wall art and gift for dog owners.',
  '{}', 2199, 'pending'
),
(
  'Mountain Watercolor Hiking Wall Art Poster — Pacific Northwest Adventure Print',
  'poster_v',
  'Painterly watercolor hiking poster: misty Pacific Northwest mountain peaks with pine forest silhouette in cool blue-grey washes, minimalist retro typography "Adventure Awaits", full-bleed vertical print',
  'Beautiful mountain watercolor hiking poster — Pacific Northwest adventure wall art.',
  '{}', 2199, 'pending'
),
(
  'Funny Office Humor Typography Poster — Sarcastic Work Wall Art Print',
  'poster_v',
  'Bold typographic humor poster: centered text "I Survived Another Meeting That Could Have Been an Email" in large serif and sans-serif mix, black and white with red accent, clean minimalist design, full-bleed vertical print',
  'Hilarious office humor poster — sarcastic work wall art for home office and breakroom.',
  '{}', 2199, 'pending'
),
(
  'Moon Phase Mystical Astrology Poster — Celestial Galaxy Wall Art Print',
  'poster_v',
  'Elegant celestial wall art poster: eight moon phases arranged vertically in gold monoline on deep midnight navy, with constellation lines and star clusters, elegant typography "As Above So Below", full-bleed vertical print',
  'Stunning moon phase astrology poster — celestial mystical wall art for bedroom and living room.',
  '{}', 2199, 'pending'
),

-- ─── TRUCKER CAP (5) — bp 1446, $29.99 ────────────────────────────────────
(
  'Funny Dog Dad Snapback Trucker Hat — Retro Dog Lover Gift Cap',
  'truckercap',
  'Compact embroidery-style flat vector: bold text "Dog Dad" with a simple paw print icon above, thick bold condensed font, white background, center 45% canvas only, high contrast black and amber',
  'Funny dog dad snapback trucker cap — perfect gift for dog lovers and pet dads.',
  '{}', 2999, 'pending'
),
(
  'Mountain Hiker Retro Trucker Cap — Outdoor Adventure Snapback Gift',
  'truckercap',
  'Compact retro badge design: bold mountain peak silhouette icon above text "Adventure Awaits", vintage patch aesthetic, bold thick font, white background, contained within center 45% of canvas',
  'Retro mountain hiker trucker cap — perfect outdoor adventure gift for hikers and campers.',
  '{}', 2999, 'pending'
),
(
  'Vintage Farmer Retro Trucker Hat — Country Western Rodeo Snapback Cap',
  'truckercap',
  'Compact vintage badge design: bold text "Farm Life" with wheat stalk icons on either side, distressed retro aesthetic, thick condensed font, white background, center 45% canvas only, earthy tones',
  'Retro farmer trucker cap — country western snapback hat for farmers and rodeo lovers.',
  '{}', 2999, 'pending'
),
(
  'Funny Retirement Trucker Hat — Retired Not My Problem Snapback Gift',
  'truckercap',
  'Bold compact text design: "Retired — Not My Problem" in chunky bold font with a small fishing rod icon, white background, center 45% canvas only, high contrast navy and white with orange accent',
  'Hilarious retirement trucker hat — funny retirement gift for men and women.',
  '{}', 2999, 'pending'
),
(
  'Cat Mom Retro Snapback Trucker Hat — Funny Pet Lover Cap Gift',
  'truckercap',
  'Cute compact design: simple cartoon cat face icon above bold text "Cat Mom", thick bold font, minimal details, white background, center 45% canvas only, black and blush pink accent',
  'Adorable cat mom trucker hat — funny snapback gift for cat lovers and pet moms.',
  '{}', 2999, 'pending'
)

ON CONFLICT DO NOTHING;

-- ── 4. Register audit batches (one row per type — populated by product IDs after creation) ──
INSERT INTO pod_new_type_audit_batches (product_type, queue_ids)
SELECT
  product_type,
  ARRAY_AGG(id ORDER BY id) AS queue_ids
FROM pod_product_queue
WHERE status = 'pending'
  AND product_type IN ('canvas','leggings','pillow','tanktop','croptop','joggers',
                       'laptopsleeve','sticker','poster_v','truckercap')
  AND created_at >= NOW() - INTERVAL '1 minute'
GROUP BY product_type;
