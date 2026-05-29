-- ============================================================================
-- MODULE 1: Global POD Fulfillment Architecture
-- Migration: 20260521130000_global_routing.sql
--
-- Creates:
--   • product_fulfillment_type ENUM
--   • public.products column additions (fulfillment_type, is_digital_download,
--     localized_metadata, shipping_cost_override)
--   • printify_global_routing_matrix (domestic/international routing table)
--   • pod_order_audit (margin-guardrail event log)
--   • Extends pod_product_queue product_type constraint to cover all 12 types
--   • Seeds 10 trending products into public.products with native DE/ES/FR metadata
--   • Seeds 6 printify_global_routing_matrix rows for DE/CA/GB/AU routing
-- ============================================================================

-- ── 1. ENUM ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE product_fulfillment_type AS ENUM ('physical_pod', 'digital_asset');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Columns on public.products ────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fulfillment_type      product_fulfillment_type NOT NULL DEFAULT 'physical_pod',
  ADD COLUMN IF NOT EXISTS is_digital_download   boolean                  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS localized_metadata    jsonb,
  ADD COLUMN IF NOT EXISTS shipping_cost_override numeric;

-- ── 3. printify_global_routing_matrix ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS printify_global_routing_matrix (
  id                      bigserial   PRIMARY KEY,
  base_product_id         int         NOT NULL,           -- Printify blueprint ID (238=blanket, 1715=tumbler)
  target_country_code     varchar(2)  NOT NULL,           -- ISO-3166-1 alpha-2
  print_provider_id       int         NOT NULL,           -- Printify provider node for that region
  blueprint_variant_id    varchar     NOT NULL,           -- Provider-specific variant SKU or ID string
  localized_base_cost_usd numeric     NOT NULL,           -- Landed production cost in USD
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_product_id, target_country_code)
);

ALTER TABLE printify_global_routing_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON printify_global_routing_matrix
  FOR ALL USING (auth.role() = 'service_role');

-- ── 4. pod_order_audit — margin guardrail + dispatch event log ────────────────
CREATE TABLE IF NOT EXISTS pod_order_audit (
  id              bigserial   PRIMARY KEY,
  order_id        text        NOT NULL,
  event_type      text        NOT NULL,    -- 'margin_below_30pct' | 'dispatched' | 'no_route'
  product_id      int,
  country_code    varchar(2),
  retail_cents    int,
  base_cost_usd   numeric,
  margin_pct      numeric,
  provider_id     int,
  variant_id      text,
  payload         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pod_order_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_order_audit
  FOR ALL USING (auth.role() = 'service_role');

-- ── 5. Extend pod_product_queue product_type check to cover all live types ───
-- The original constraint only allowed tshirt/hoodie/mug/tote. The edge
-- function routes all 12 types; keep the DB and application layer in sync.
ALTER TABLE pod_product_queue
  DROP CONSTRAINT IF EXISTS pod_product_queue_product_type_check;

ALTER TABLE pod_product_queue
  ADD CONSTRAINT pod_product_queue_product_type_check
  CHECK (product_type IN (
    'tshirt','hoodie','mug','sock','hat','mousepad',
    'onesie','tumbler','blanket','sweatshirt','longsleeve','travelmug','digital'
  ));

-- ── 6. Seed: 10 trending products into public.products ───────────────────────
-- Blankets: blueprint 238, $64.99 — 5 high-velocity trending niches
-- Tumblers: blueprint 1715/353, $39.99 — 5 high-velocity trending niches
-- localized_metadata stores native buyer-intent phrases (not literal translation)

INSERT INTO public.products
  (name, product_type, price, description, category, is_live,
   fulfillment_type, is_digital_download, sort_order, metadata, localized_metadata)
VALUES

-- ──────────────────────────────────────────────────────────────────────────────
-- BLANKET 1: Legacy Wildflower Meadow Family Name Blanket (Art Nouveau Linocut)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Legacy Wildflower Meadow Family Name Sherpa Blanket — Art Nouveau Linocut',
  'blanket', 64.99,
  'A heirloom-quality personalized family blanket featuring bold Art Nouveau linocut wildflower lines — rich graphic stems and petals etched in a hand-carved illustration style, far beyond basic watercolor blooms. Custom family name woven into the composition. Premium sherpa throw.',
  'pod', false, 'physical_pod', false, 10,
  '{"blueprint_id":238,"niche":"wildflower_family_blanket","style":"art_nouveau_linocut"}'::jsonb,
  '{
    "de": {
      "title": "Personalisierte Familiendecke Jugendstil Wiesenblumen Linolschnitt Sherpa Überwurf",
      "description": "Hochwertige Sherpa-Familiendecke mit handgravierten Jugendstil-Linolschnitt-Wiesenblumen. Individueller Familienname eingearbeitet. Ideal als Hochzeitsgeschenk, Jahrestagsgeschenk oder Erbstück für die Familie. Weicher Sherpa-Doppelflor.",
      "tags": ["Jugendstil Decke", "Familiendecke personalisiert", "Sherpa Überwurf", "Wiesenblumen Geschenk", "Linolschnitt Muster", "Namensdecke Familie", "Wohnzimmerdecke", "Geburtstagsgeschenk Frau", "Heimtextilien Handwerk", "Blumendecke Vintage", "Hochzeitsgeschenk", "Erbstück Decke", "Kuscheldecke personalisiert"]
    },
    "es": {
      "title": "Manta Familiar Personalizada Flores Silvestres Art Nouveau Linograbado Sherpa",
      "description": "Manta sherpa de alta calidad con grabado de flores silvestres en estilo Art Nouveau. Nombre de familia personalizado integrado en la composición. Perfecta como regalo de boda, aniversario o tesoro familiar. Tejido sherpa premium doble cara.",
      "tags": ["manta personalizada familia", "flores silvestres Art Nouveau", "manta sherpa regalo", "linograbado floral", "manta nombre familia", "decoración hogar personalizada", "regalo boda original", "manta sofá premium", "regalo aniversario mujer", "manta vintage flores", "regalo navidad familia", "manta artesanal", "cojín manta personalizada"]
    },
    "fr": {
      "title": "Plaid Familial Personnalisé Fleurs Sauvages Art Nouveau Linogravure Sherpa",
      "description": "Plaid sherpa haut de gamme avec linogravure Art Nouveau de fleurs sauvages. Prénom famille intégré dans la composition. Idéal comme cadeau de mariage, anniversaire ou héritage familial. Tissu sherpa double face premium.",
      "tags": ["plaid personnalisé famille", "fleurs sauvages Art Nouveau", "plaid sherpa cadeau", "linogravure florale", "plaid prénom famille", "décoration maison personnalisée", "cadeau mariage original", "plaid canapé premium", "cadeau anniversaire femme", "plaid vintage fleurs", "cadeau Noël famille", "plaid artisanal", "couverture personnalisée"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- BLANKET 2: Dark Cottagecore Mycological Forest Blanket (Bioluminescent fungi)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Dark Cottagecore Mycological Forest Sherpa Blanket — Bioluminescent Fungi Moss',
  'blanket', 64.99,
  'Deep forest cottagecore aesthetic featuring bioluminescent fungi clusters, phosphorescent moss frameworks, and mycelium network tracery on a deep forest floor background. Not flat mushrooms — full bioluminescent ecosystem art on a premium sherpa throw.',
  'pod', false, 'physical_pod', false, 11,
  '{"blueprint_id":238,"niche":"dark_cottagecore_mushroom","style":"bioluminescent"}'::jsonb,
  '{
    "de": {
      "title": "Dark Cottagecore Pilzwald Sherpa Decke Bioleuchtendes Myzel Waldgeist",
      "description": "Mystische Sherpa-Decke mit leuchtenden Waldpilzen, Moos-Netzwerken und biolumineszenten Myzel-Strukturen. Perfekt für Dark-Cottagecore- und Witchcore-Ästhetik. Gemütliche Geschenkidee für Natur- und Pilzliebhaber.",
      "tags": ["Dark Cottagecore Decke", "Pilzwald Sherpa", "Witchcore Geschenk", "biolumineszente Pilze", "Myzel Muster", "Waldgeist Decke", "Natur Ästhetik", "mystische Kuscheldecke", "Pilzliebhaber Geschenk", "Cottagecore Wohnen", "Gothic Nature Decke", "Waldmoos Design", "Herbst Kuscheldecke"]
    },
    "es": {
      "title": "Manta Sherpa Dark Cottagecore Bosque Hongos Bioluminiscentes Micelio",
      "description": "Manta sherpa mística con hongos bioluminiscentes, redes de micelio y musgo fosforescente. Estética Dark Cottagecore y Witchcore. Ideal para amantes de la naturaleza oscura y los hongos. Regalo original y acogedor.",
      "tags": ["Dark Cottagecore manta", "hongos bioluminiscentes", "manta sherpa bosque", "witchcore regalo", "micelio diseño", "manta naturaleza oscura", "regalo amante hongos", "decoración cottagecore", "manta mística", "bosque oscuro estética", "manta otoño", "diseño natural manta", "regalo original mujer"]
    },
    "fr": {
      "title": "Plaid Sherpa Dark Cottagecore Forêt Champignons Bioluminescents Mycélium",
      "description": "Plaid sherpa mystique avec champignons bioluminescents, réseaux de mycélium et mousses phosphorescentes. Esthétique Dark Cottagecore et Witchcore. Idéal pour les amoureux de la nature sombre et des champignons.",
      "tags": ["Dark Cottagecore plaid", "champignons bioluminescents", "plaid sherpa forêt", "witchcore cadeau", "mycélium design", "plaid nature sombre", "cadeau amateur champignons", "décoration cottagecore", "plaid mystique", "forêt sombre esthétique", "plaid automne", "design naturel plaid", "cadeau original femme"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- BLANKET 3: Vintage Academic Bibliophile Library Blanket (Sepia oil volumes)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Vintage Academic Bibliophile Library Sherpa Blanket — Sepia Oil-Painted Volumes',
  'blanket', 64.99,
  'Old-world library aesthetic rendered in deep sepia oil-painting style — antique leather-bound volumes stacked beneath trailing ivy, brass bookplates, and warm candlelight tones. The book lover''s ultimate throw.',
  'pod', false, 'physical_pod', false, 12,
  '{"blueprint_id":238,"niche":"bibliophile_library","style":"sepia_oil_painted"}'::jsonb,
  '{
    "de": {
      "title": "Bücherwurm Sherpa Decke Vintage Bibliothek Sepia Ölgemälde Akademiker",
      "description": "Warme Sherpa-Decke für leidenschaftliche Leser — antike Lederbände, Efeu-Ranken und Sepiatöne wie aus einem alten Ölgemälde. Das perfekte Geschenk für Bücherwürmer, Akademiker und Literaturliebhaber.",
      "tags": ["Bücherwurm Decke", "Bibliothek Sherpa", "Leser Geschenk", "Vintage Bücher Design", "Akademiker Decke", "Sepia Ästhetik", "Literaturliebhaber Geschenk", "Leseecke Deko", "Buchliebhaber Geschenk", "antike Bibliothek", "Ölgemälde Muster", "Weihnachtsgeschenk Leser", "gemütliche Lesedecke"]
    },
    "es": {
      "title": "Manta Sherpa Bibliófilo Biblioteca Vintage Pintura Óleo Sepia Académico",
      "description": "Manta sherpa cálida para apasionados lectores — volúmenes de cuero antiguos, enredaderas de hiedra y tonos sépia al óleo. El regalo perfecto para bibliófilos, académicos y amantes de la literatura.",
      "tags": ["manta bibliófilo", "biblioteca vintage sherpa", "regalo lector", "diseño libros vintage", "manta académico", "estética sepia", "regalo amante literatura", "rincón lectura deco", "regalo amante libros", "biblioteca antigua", "patrón óleo", "regalo navidad lector", "manta lectura acogedora"]
    },
    "fr": {
      "title": "Plaid Sherpa Bibliophile Bibliothèque Vintage Peinture Huile Sépia Académique",
      "description": "Plaid sherpa chaleureux pour les lecteurs passionnés — volumes reliés en cuir ancien, lierre grimpant et tons sépia à l''huile. Le cadeau parfait pour bibliophiles, académiciens et amoureux de la littérature.",
      "tags": ["plaid bibliophile", "bibliothèque vintage sherpa", "cadeau lecteur", "design livres vintage", "plaid académique", "esthétique sépia", "cadeau amateur littérature", "coin lecture déco", "cadeau amateur livres", "bibliothèque ancienne", "motif huile", "cadeau Noël lecteur", "plaid lecture cosy"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- BLANKET 4: Retro Vaporwave Cyberpunk Gridwork Gaming Blanket (Isometric neon)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Retro Vaporwave Cyberpunk Gridwork Gaming Sherpa Blanket — Isometric Neon Wireframes',
  'blanket', 64.99,
  'Not your basic 2D gamepad pattern — isometric neon vector wireframes, floating geometry, purple-pink-cyan grid horizons, and cyberpunk cityscape elements rendered in a vaporwave palette. The gamer aesthetic elevated.',
  'pod', false, 'physical_pod', false, 13,
  '{"blueprint_id":238,"niche":"vaporwave_gaming","style":"isometric_neon_wireframe"}'::jsonb,
  '{
    "de": {
      "title": "Vaporwave Cyberpunk Gaming Sherpa Decke Isometrisch Neon Gitter Retrowave",
      "description": "Stylische Gaming-Decke im Vaporwave-Ästhetik: isometrische Neon-Drahtgitter, Cyberpunk-Stadtsilhouetten und retrowave Farbpalette. Das perfekte Geschenk für Gamer, Anime-Fans und Retro-Technik-Liebhaber.",
      "tags": ["Vaporwave Decke", "Gaming Sherpa", "Cyberpunk Geschenk", "Neon Gitter Design", "Retrowave Ästhetik", "Gamer Geschenk", "Anime Deko Decke", "isometrisch Muster", "80er Neon Decke", "Synthwave Geschenk", "Gaming Zimmer Deko", "RGB Ästhetik Decke", "Technik Liebhaber Geschenk"]
    },
    "es": {
      "title": "Manta Gaming Sherpa Vaporwave Cyberpunk Rejilla Isométrica Neón Retrowave",
      "description": "Manta gaming con estética Vaporwave: wireframes isométricos neón, siluetas cyberpunk y paleta retrowave. El regalo perfecto para gamers, fans del anime y amantes de la tecnología retro.",
      "tags": ["manta vaporwave", "gaming sherpa", "regalo cyberpunk", "diseño rejilla neón", "estética retrowave", "regalo gamer", "decoración anime manta", "patrón isométrico", "manta neón 80s", "regalo synthwave", "decoración cuarto gaming", "estética RGB manta", "regalo tecnología retro"]
    },
    "fr": {
      "title": "Plaid Gaming Sherpa Vaporwave Cyberpunk Grille Isométrique Néon Retrowave",
      "description": "Plaid gaming avec esthétique Vaporwave: wireframes isométriques néon, silhouettes cyberpunk et palette retrowave. Le cadeau parfait pour gamers, fans d''anime et amateurs de technologie rétro.",
      "tags": ["plaid vaporwave", "gaming sherpa", "cadeau cyberpunk", "design grille néon", "esthétique retrowave", "cadeau gamer", "décoration anime plaid", "motif isométrique", "plaid néon 80s", "cadeau synthwave", "décoration chambre gaming", "esthétique RGB plaid", "cadeau technologie rétro"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- BLANKET 5: Celestial Fantasy Constellation Chart Blanket (Medieval astrology)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Celestial Fantasy Constellation Chart Sherpa Blanket — Medieval Astrological Sea Dragons',
  'blanket', 64.99,
  'Medieval-style astrological mapping grid with ornate constellation lines, navigational compass roses, hand-lettered star names, and detailed sea dragon illustrations filling the chart margins — the universe as a 14th-century cartographer would chart it.',
  'pod', false, 'physical_pod', false, 14,
  '{"blueprint_id":238,"niche":"celestial_constellation","style":"medieval_astrological_map"}'::jsonb,
  '{
    "de": {
      "title": "Sternbild Karte Sherpa Decke Mittelalterliche Astrologie Himmel Seekarten Drachen",
      "description": "Majestätische Sherpa-Decke mit mittelalterlicher Sternkarte — Konstellationslinien, Kompassrosen, handgeschriebene Sternnamen und detaillierte Seedrachen. Perfekt für Astronomiebegeisterte, Fantasy-Fans und Mystik-Liebhaber.",
      "tags": ["Sternbild Decke", "Himmelskarte Sherpa", "mittelalterliche Astrologie", "Seekarte Muster", "Galaxie Decke", "Astronomie Geschenk", "Fantasy Karte Decke", "Sternzeichen Geschenk", "mystische Decke", "Konstellationen Design", "Weltraum Ästhetik", "Horoskop Liebhaber", "Sterngucker Geschenk"]
    },
    "es": {
      "title": "Manta Sherpa Carta Constelación Medieval Astrología Celeste Dragones de Mar",
      "description": "Majestuosa manta sherpa con carta estelar medieval — líneas de constelaciones, rosas de los vientos, nombres de estrellas manuscritos y dragones marinos detallados. Perfecta para amantes de la astronomía, fantasía y mística.",
      "tags": ["manta constelación", "carta celeste sherpa", "astrología medieval", "patrón carta náutica", "manta galaxia", "regalo astronomía", "manta carta fantasía", "regalo signo zodiacal", "manta mística", "diseño constelaciones", "estética espacial", "amante horóscopo", "regalo astrónomo"]
    },
    "fr": {
      "title": "Plaid Sherpa Carte Constellation Médiévale Astrologie Céleste Dragons des Mers",
      "description": "Majestueux plaid sherpa avec carte stellaire médiévale — lignes de constellations, roses des vents, noms d''étoiles manuscrits et dragons des mers détaillés. Parfait pour les amateurs d''astronomie, de fantaisie et de mystique.",
      "tags": ["plaid constellation", "carte céleste sherpa", "astrologie médiévale", "motif carte nautique", "plaid galaxie", "cadeau astronomie", "plaid carte fantaisie", "cadeau signe zodiacal", "plaid mystique", "design constellations", "esthétique spatiale", "amateur horoscope", "cadeau astronome"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- TUMBLER 6: Retro Outdoor Adventure Sticker Collage Tumbler (Hiking patches)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Retro Outdoor Adventure Sticker Collage Tumbler — Hiking Patches Burnt Amber',
  'tumbler', 39.99,
  'Overlapping vintage hiking and national park patches in a cohesive burnt-amber and forest-green palette. Retro merit badge lettering, mountain silhouettes, and trail icons collaged into a seamless wrap. 40oz insulated stainless steel.',
  'pod', false, 'physical_pod', false, 20,
  '{"blueprint_id":1715,"niche":"outdoor_adventure_tumbler","style":"retro_sticker_collage"}'::jsonb,
  '{
    "de": {
      "title": "Retro Outdoor Abenteuer Thermobecher Wanderaufkleber Collage Vintage Nationalpark",
      "description": "Stilvoller Thermobecher mit Vintage-Wanderabzeichen-Collage in erdigen Brauntönen. Retro-Nationalpark-Patches, Bergsilhouetten und Trail-Icons. 40oz doppelwandiger Edelstahl. Perfektes Wandergeschenk.",
      "tags": ["Outdoor Thermobecher", "Wanderaufkleber Collage", "Nationalpark Geschenk", "Retro Becher Wandern", "Bergsteiger Geschenk", "Abenteuer Thermobecher", "Camping Geschenk Mann", "Vintage Trinkbecher", "Trail Wanderer Becher", "Naturliebhaber Geschenk", "Edelstahl Outdoor Becher", "Wandern Deko", "Retro Badge Tasse"]
    },
    "es": {
      "title": "Vaso Térmico Retro Aventura Outdoor Collage Parches Senderismo Ámbar Vintage",
      "description": "Elegante vaso térmico con collage de parches vintage de senderismo en tonos ámbar terrosos. Parches retro de parques nacionales, siluetas de montañas e iconos de senderos. 40oz acero inoxidable de doble pared. Perfecto regalo para senderistas.",
      "tags": ["vaso térmico outdoor", "collage parches senderismo", "regalo parque nacional", "vaso retro senderismo", "regalo montañista", "vaso aventura térmica", "regalo camping hombre", "vaso vintage bebidas", "vaso senderista trail", "regalo amante naturaleza", "vaso acero inoxidable outdoor", "decoración senderismo", "taza retro insignia"]
    },
    "fr": {
      "title": "Tumbler Rétro Aventure Outdoor Collage Patchs Randonnée Ambre Vintage",
      "description": "Élégant tumbler avec collage de patchs vintage de randonnée aux tons ambre terreux. Patchs rétro de parcs nationaux, silhouettes de montagnes et icônes de sentiers. 40oz acier inoxydable double paroi. Cadeau parfait pour randonneurs.",
      "tags": ["tumbler outdoor rétro", "collage patchs randonnée", "cadeau parc national", "tumbler rétro randonnée", "cadeau alpiniste", "tumbler aventure thermique", "cadeau camping homme", "gobelet vintage boissons", "tumbler randonneur trail", "cadeau amoureux nature", "tumbler acier inoxydable", "décoration randonnée", "tasse rétro insigne"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- TUMBLER 7: Desert Rodeo Tooled Leather Pattern Tumbler (Southwest filigree)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Desert Rodeo Tooled Leather Pattern Tumbler — Geometric Southwestern Filigree Matte Sand',
  'tumbler', 39.99,
  'Geometric southwestern filigree textures inspired by hand-tooled leather saddle work, on a matte sand base. Aztec diamond motifs, cactus flower medallions, and turquoise accent geometry. 40oz insulated stainless steel.',
  'pod', false, 'physical_pod', false, 21,
  '{"blueprint_id":1715,"niche":"desert_rodeo_tumbler","style":"tooled_leather_southwest"}'::jsonb,
  '{
    "de": {
      "title": "Wüsten Rodeo Thermobecher Handgeschnitztes Leder Muster Südwest Filigran Sand",
      "description": "Thermobecher mit geometrischen Südwest-Filigran-Mustern inspiriert von handgeschnitztem Lederwerk. Aztekische Diamantmotive, Kakteenblüten-Medaillons und Türkis-Akzente auf sandfarbenem Untergrund. 40oz Edelstahl.",
      "tags": ["Wüsten Thermobecher", "Südwest Leder Muster", "Rodeo Geschenk", "Western Thermobecher", "Azteken Muster Becher", "Cowboy Geschenk", "Sand Ästhetik Becher", "Turquoise Western Deko", "Kaktus Muster Tasse", "Texas Geschenk", "Lederoptik Thermobecher", "Boho Western Becher", "Ranch Geschenk Frau"]
    },
    "es": {
      "title": "Vaso Térmico Rodeo Desierto Cuero Tallado Filigrana Geométrica Suroeste Arena",
      "description": "Vaso térmico con texturas geométricas de filigrana suroeste inspiradas en cuero tallado a mano. Motivos aztecas en diamante, medallones de flor de cactus y geometría turquesa sobre fondo arena. 40oz acero inoxidable.",
      "tags": ["vaso térmico desierto", "patrón cuero suroeste", "regalo rodeo", "vaso western térmico", "patrón azteca vaso", "regalo vaquero", "vaso estética arena", "decoración turquesa western", "taza patrón cactus", "regalo Texas", "vaso look cuero", "vaso boho western", "regalo rancho mujer"]
    },
    "fr": {
      "title": "Tumbler Rodéo Désert Cuir Gravé Filigrane Géométrique Sud-Ouest Sable",
      "description": "Tumbler avec textures géométriques filigranées du Sud-Ouest inspirées du cuir gravé main. Motifs aztèques en losange, médaillons de fleur de cactus et géométrie turquoise sur fond sable. 40oz acier inoxydable.",
      "tags": ["tumbler désert", "motif cuir sud-ouest", "cadeau rodéo", "tumbler western thermique", "motif aztèque gobelet", "cadeau cowboy", "gobelet esthétique sable", "décoration turquoise western", "tasse motif cactus", "cadeau Texas", "tumbler look cuir", "gobelet boho western", "cadeau ranch femme"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- TUMBLER 8: Sarcastic Grumpy Raven Mid-Century Vector Tumbler (Corporate humor)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Sarcastic Grumpy Raven Mid-Century Vector Tumbler — Minimalist Flat-Art Corporate Humor',
  'tumbler', 39.99,
  'Minimalist mid-century modern flat vector art featuring a perpetually unimpressed raven in corporate office humor scenarios — deadpan expressions, passive-aggressive motivational posters, and Monday-morning energy. Perfect for the office sarcasm connoisseur.',
  'pod', false, 'physical_pod', false, 22,
  '{"blueprint_id":1715,"niche":"sarcastic_raven_tumbler","style":"mid_century_vector_flat"}'::jsonb,
  '{
    "de": {
      "title": "Sarkastischer Rabe Thermobecher Mid-Century Vektor Bürohumor Minimalismus",
      "description": "Minimalistischer Flat-Art-Thermobecher mit einem dauerhaft unbeeindruckten Raben und Bürohumor-Szenarien. Mid-Century-Modern-Ästhetik, passive-aggressive Motivationssprüche und Montag-Energie. Für Bürosarkasmus-Kenner.",
      "tags": ["Sarkasmus Thermobecher", "Rabe Bürohumor", "Mid-Century Becher", "Introvert Geschenk", "sarkastischer Kaffeebecher", "Büro Geschenk lustig", "minimalistische Thermosflasche", "Mondayvibes Becher", "Flat Art Tasse", "ironisches Geschenk", "Kollegen Geschenk witzig", "Rabe Kunstbecher", "Anti-Motivations Tasse"]
    },
    "es": {
      "title": "Vaso Térmico Cuervo Gruñón Sarcástico Mid-Century Vector Arte Plano Humor Oficina",
      "description": "Vaso térmico minimalista con un cuervo perpetuamente no impresionado y humor de oficina. Estética Mid-Century Modern, mensajes motivacionales pasivo-agresivos y energía de lunes por la mañana. Para el conocedor del sarcasmo de oficina.",
      "tags": ["vaso sarcástico", "cuervo humor oficina", "vaso mid-century", "regalo introvertido", "taza sarcástica café", "regalo oficina gracioso", "botella térmica minimalista", "vaso Monday vibes", "taza flat art", "regalo irónico", "regalo compañero gracioso", "vaso arte cuervo", "taza antimotivación"]
    },
    "fr": {
      "title": "Tumbler Corbeau Grognon Sarcastique Mid-Century Vecteur Art Plat Humour Bureau",
      "description": "Tumbler minimaliste avec un corbeau perpétuellement non impressionné et humour de bureau. Esthétique Mid-Century Modern, messages motivationnels passifs-agressifs et énergie du lundi matin. Pour le connaisseur du sarcasme de bureau.",
      "tags": ["tumbler sarcastique", "corbeau humour bureau", "tumbler mid-century", "cadeau introverti", "tasse sarcastique café", "cadeau bureau drôle", "thermos minimaliste", "tumbler Monday vibes", "tasse flat art", "cadeau ironique", "cadeau collègue drôle", "tumbler art corbeau", "tasse anti-motivation"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- TUMBLER 9: Gothic Tarot Constellation Monoline Tumbler (Obsidian gold geometry)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Gothic Tarot Constellation Monoline Tumbler — Obsidian Black Fine-Line Gold Geometry',
  'tumbler', 39.99,
  'Obsidian-black backdrop with delicate fine-line gold monoline geometry — tarot card symbolic motifs, constellation star maps, and sacred geometry patterns rendered in hairline gold strokes. Maximalist detail, minimalist palette. 40oz insulated stainless steel.',
  'pod', false, 'physical_pod', false, 23,
  '{"blueprint_id":1715,"niche":"gothic_tarot_tumbler","style":"monoline_gold_obsidian"}'::jsonb,
  '{
    "de": {
      "title": "Gothic Tarot Sternbild Monoline Thermobecher Obsidian Schwarz Gold Geometrie",
      "description": "Dunkel-ästhetischer Thermobecher: obsidianschwarzer Hintergrund mit zarten Gold-Monoline-Tarot-Symbolen, Sternkarten und heiliger Geometrie. Für Gothic-, Mystik- und Esoterik-Liebhaber. 40oz isolierter Edelstahl.",
      "tags": ["Gothic Thermobecher", "Tarot Sternbild Becher", "Monoline Gold Tasse", "Okkult Geschenk", "heilige Geometrie Becher", "Hexe Geschenk", "Dark Aesthetic Thermobecher", "Astronomie Gothic Tasse", "mystische Thermosflasche", "Esoterik Geschenk", "Tarot Liebhaber Becher", "Obsidian Ästhetik", "Witchcraft Geschenk"]
    },
    "es": {
      "title": "Vaso Térmico Gótico Tarot Constelación Monoline Obsidiana Negro Geometría Dorada",
      "description": "Vaso térmico de estética oscura: fondo negro obsidiana con delicados símbolos de tarot en monoline dorado, mapas estelares y geometría sagrada. Para amantes del gótico, la mística y la esoterismo. 40oz acero inoxidable.",
      "tags": ["vaso gótico térmico", "tarot constelación vaso", "taza monoline dorada", "regalo ocultista", "vaso geometría sagrada", "regalo bruja", "vaso dark aesthetic", "taza astronomía gótica", "botella mística", "regalo esotérico", "vaso amante tarot", "estética obsidiana", "regalo brujería"]
    },
    "fr": {
      "title": "Tumbler Gothique Tarot Constellation Monoline Obsidienne Noir Géométrie Dorée",
      "description": "Tumbler à l''esthétique sombre: fond noir obsidien avec de délicats symboles de tarot en monoline doré, cartes stellaires et géométrie sacrée. Pour les amateurs de gothique, de mystique et d''ésotérisme. 40oz acier inoxydable.",
      "tags": ["tumbler gothique", "tarot constellation tumbler", "tasse monoline dorée", "cadeau occultiste", "tumbler géométrie sacrée", "cadeau sorcière", "tumbler dark aesthetic", "tasse astronomie gothique", "thermos mystique", "cadeau ésotérique", "tumbler amateur tarot", "esthétique obsidienne", "cadeau sorcellerie"]
    }
  }'::jsonb
),

-- ──────────────────────────────────────────────────────────────────────────────
-- TUMBLER 10: Aeronautical Jet Engine Blueprint Schematic Tumbler (Chalk draft)
-- ──────────────────────────────────────────────────────────────────────────────
(
  'Aeronautical Jet Engine Blueprint Schematic Tumbler — Chalk-White Technical Draft Lines',
  'tumbler', 39.99,
  'Technical engineering drawing of a cross-section jet engine schematic rendered in chalk-white draft lines on a dark engineering-blueprint background. Dimension annotations, cutaway views, and component labels. For the aerospace engineer and aviation enthusiast.',
  'pod', false, 'physical_pod', false, 24,
  '{"blueprint_id":1715,"niche":"aeronautical_blueprint_tumbler","style":"chalk_white_schematic"}'::jsonb,
  '{
    "de": {
      "title": "Luftfahrt Strahltriebwerk Blueprint Thermobecher Kreide Technische Zeichnung Ingenieur",
      "description": "Technischer Thermobecher mit Strahltriebwerk-Schnittzeichnung in Kreidelinienstil auf dunkelblauem Blaupausen-Hintergrund. Maßangaben, Schnittansichten und Komponentenbeschriftungen. Perfekt für Luft- und Raumfahrtingenieure und Luftfahrtbegeisterte.",
      "tags": ["Ingenieur Thermobecher", "Strahltriebwerk Blueprint", "Luftfahrt Geschenk", "Pilot Thermobecher", "technische Zeichnung Becher", "Maschinenbau Geschenk", "Blaupause Ästhetik Tasse", "Raumfahrt Liebhaber", "Aviation Thermobecher", "Ingenieursgeschenk Mann", "CAD Zeichnung Becher", "Luftfahrttechnik Tasse", "Techniker Geschenk"]
    },
    "es": {
      "title": "Vaso Térmico Aeronáutico Motor Jet Plano Técnico Líneas Tiza Ingeniería",
      "description": "Vaso térmico técnico con sección transversal de motor jet en estilo líneas de tiza sobre fondo azul plano técnico. Anotaciones de dimensiones, vistas en corte y etiquetas de componentes. Perfecto para ingenieros aeroespaciales y entusiastas de la aviación.",
      "tags": ["vaso térmico ingeniero", "motor jet plano técnico", "regalo aviación", "vaso piloto térmico", "taza dibujo técnico", "regalo ingeniería mecánica", "taza estética plano azul", "amante aeroespacial", "vaso aviación térmica", "regalo ingeniero hombre", "taza dibujo CAD", "taza ingeniería aeronáutica", "regalo técnico"]
    },
    "fr": {
      "title": "Tumbler Aéronautique Moteur Jet Plan Technique Lignes Craie Ingénierie",
      "description": "Tumbler technique avec coupe transversale de moteur jet en style lignes craie sur fond bleu plan technique. Annotations de dimensions, vues en coupe et étiquettes de composants. Parfait pour les ingénieurs aérospatiaux et passionnés d''aviation.",
      "tags": ["tumbler ingénieur", "moteur jet plan technique", "cadeau aviation", "tumbler pilote thermique", "tasse dessin technique", "cadeau ingénierie mécanique", "tasse esthétique plan bleu", "passionné aérospatial", "tumbler aviation thermique", "cadeau ingénieur homme", "tasse dessin CAO", "tasse ingénierie aéronautique", "cadeau technicien"]
    }
  }'::jsonb
)

ON CONFLICT DO NOTHING;

-- ── 7. Seed printify_global_routing_matrix ────────────────────────────────────
-- Maps (blueprint_id, country_code) → regional print provider + variant + cost
-- Provider IDs are Printify's regional node IDs (verify in Printify dashboard)
-- Costs are per-unit landed production costs in USD (used for 30% margin calc)

INSERT INTO printify_global_routing_matrix
  (base_product_id, target_country_code, print_provider_id, blueprint_variant_id, localized_base_cost_usd)
VALUES
  -- Sherpa Blanket (blueprint 238): EU/CA/UK regional routes
  (238, 'DE', 4,  'blanket-238-de-60x80-sherpa', 28.50),  -- EU Gelato node; sherpa 60×80
  (238, 'CA', 3,  'blanket-238-ca-60x80-sherpa', 31.00),  -- SPOD CA warehouse
  (238, 'GB', 5,  'blanket-238-gb-60x80-sherpa', 27.75),  -- Prodigi UK facility
  -- 40oz Tumbler (blueprint 1715): EU/CA/AU regional routes
  (1715, 'DE', 4,  'tumbler-1715-de-40oz-steel',  14.50), -- EU Gelato node; 40oz SS
  (1715, 'CA', 3,  'tumbler-1715-ca-40oz-steel',  15.25), -- SPOD CA warehouse
  (1715, 'AU', 26, 'tumbler-1715-au-40oz-steel',  16.00)  -- Monster Digital AU
ON CONFLICT (base_product_id, target_country_code) DO NOTHING;
