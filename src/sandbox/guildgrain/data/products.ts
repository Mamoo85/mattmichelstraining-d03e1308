import board from "../assets/product-board.jpg";
import box from "../assets/product-box.jpg";
import hero from "../assets/hero.jpg";

export interface PersonalizationOption {
  materials: { id: string; label: string; priceDelta: number; tint?: string }[];
  fonts: { id: string; label: string; family: string }[];
  maxChars: number;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  artisan: string;
  basePrice: number;
  category: "kitchen" | "decor" | "jewelry" | "stationery" | "candles";
  occasion: ("wedding" | "anniversary" | "birthday" | "housewarming" | "everyday")[];
  aesthetic: string[];
  image: string;
  gallery: string[];
  description: string;
  shippingDays: string;
  customizable: boolean;
  personalization?: PersonalizationOption;
  starSeller?: boolean;
  trending?: number;
}

const standardPersonalization: PersonalizationOption = {
  materials: [
    { id: "walnut", label: "Walnut", priceDelta: 0, tint: "#6b4423" },
    { id: "maple", label: "Maple", priceDelta: 4, tint: "#d4a574" },
    { id: "cherry", label: "Cherry", priceDelta: 8, tint: "#8b3a2c" },
  ],
  fonts: [
    { id: "script", label: "Script", family: "'Cormorant Garamond', cursive" },
    { id: "serif", label: "Serif", family: "Georgia, serif" },
    { id: "block", label: "Block", family: "'Arial Black', sans-serif" },
  ],
  maxChars: 18,
};

const leatherPersonalization: PersonalizationOption = {
  materials: [
    { id: "tan", label: "Tan Leather", priceDelta: 0, tint: "#a86b3d" },
    { id: "espresso", label: "Espresso", priceDelta: 6, tint: "#3d2817" },
    { id: "oxblood", label: "Oxblood", priceDelta: 6, tint: "#4a1c1c" },
  ],
  fonts: [
    { id: "serif", label: "Serif", family: "Georgia, serif" },
    { id: "monogram", label: "Monogram", family: "'Cormorant Garamond', serif" },
  ],
  maxChars: 4,
};

export const PRODUCTS: Product[] = [
  { id: "p1", slug: "engraved-walnut-board", title: "Heirloom Engraved Cutting Board", artisan: "Northwood Atelier", basePrice: 68, category: "kitchen", occasion: ["wedding", "anniversary", "housewarming"], aesthetic: ["nonna"], image: board, gallery: [board, hero], description: "Hand-finished hardwood board, deep-engraved with your family name. Pre-seasoned with food-safe oil.", shippingDays: "Ships in 3-5 days", customizable: true, personalization: standardPersonalization, starSeller: true, trending: 1 },
  { id: "p2", slug: "monogrammed-leather-keepsake", title: "Monogrammed Leather Keepsake Box", artisan: "Hollow & Hide", basePrice: 124, category: "decor", occasion: ["wedding", "anniversary"], aesthetic: ["celestial"], image: box, gallery: [box], description: "Full-grain Italian leather, hand-stitched, brass latch. Embossed with your monogram.", shippingDays: "Ships in 5-7 days", customizable: true, personalization: leatherPersonalization, starSeller: true, trending: 2 },
  { id: "p3", slug: "custom-celestial-print", title: "Custom Star Map Print", artisan: "Lunar Press", basePrice: 42, category: "decor", occasion: ["anniversary", "wedding"], aesthetic: ["celestial"], image: box, gallery: [box], description: "Archival print of the night sky on the date you choose. Letterpress detail on cotton paper.", shippingDays: "Ships in 2-4 days", customizable: true, personalization: { materials: [{ id: "white", label: "Cotton White", priceDelta: 0 }, { id: "kraft", label: "Kraft", priceDelta: 3 }], fonts: [{ id: "serif", label: "Serif", family: "Georgia, serif" }], maxChars: 24 }, trending: 3 },
  { id: "p4", slug: "beeswax-candle-trio", title: "Hand-Poured Beeswax Trio", artisan: "Honeycomb Studio", basePrice: 38, category: "candles", occasion: ["housewarming", "everyday"], aesthetic: ["nonna", "retro"], image: hero, gallery: [hero], description: "Three pure beeswax pillars, scented with rosemary, fig, and tobacco leaf.", shippingDays: "Ships in 2-3 days", customizable: false, trending: 4 },
  { id: "p5", slug: "retro-checker-mug", title: "Retro Checker Stoneware Mug", artisan: "Sunbeam Ceramics", basePrice: 28, category: "kitchen", occasion: ["everyday", "housewarming"], aesthetic: ["retro"], image: board, gallery: [board], description: "Mustard checker glaze on hand-thrown stoneware. Microwave and dishwasher safe.", shippingDays: "Ships in 3-5 days", customizable: false, starSeller: true },
  { id: "p6", slug: "linen-tea-towel-set", title: "Linen Tea Towel Set of 3", artisan: "Flax & Bramble", basePrice: 34, category: "kitchen", occasion: ["housewarming", "everyday"], aesthetic: ["nonna"], image: hero, gallery: [hero], description: "Pure Belgian linen, stonewashed. Choose three colorways.", shippingDays: "Ships in 4-6 days", customizable: false },
  { id: "p7", slug: "brass-moon-mobile", title: "Brass Moon Phase Mobile", artisan: "Lunar Press", basePrice: 86, category: "decor", occasion: ["housewarming"], aesthetic: ["celestial"], image: box, gallery: [box], description: "Hand-spun brass discs on linen cord. Made to order.", shippingDays: "Ships in 7-10 days", customizable: false, starSeller: true },
  { id: "p8", slug: "custom-recipe-towel", title: "Handwritten Recipe Tea Towel", artisan: "Flax & Bramble", basePrice: 32, category: "kitchen", occasion: ["birthday", "anniversary"], aesthetic: ["nonna"], image: board, gallery: [board], description: "Upload a handwritten recipe and we'll screen-print it on linen.", shippingDays: "Ships in 5-7 days", customizable: true, personalization: { materials: [{ id: "natural", label: "Natural Linen", priceDelta: 0 }, { id: "oatmeal", label: "Oatmeal", priceDelta: 2 }], fonts: [{ id: "script", label: "Handwritten", family: "'Cormorant Garamond', cursive" }], maxChars: 30 } },
  { id: "p9", slug: "personalised-leather-journal", title: "Personalised Leather Journal", artisan: "Hollow & Hide", basePrice: 58, category: "stationery", occasion: ["birthday", "anniversary", "wedding"], aesthetic: ["celestial", "nonna"], image: box, gallery: [box], description: "100 pages of cotton paper, hand-bound, monogrammed cover.", shippingDays: "Ships in 4-6 days", customizable: true, personalization: leatherPersonalization },
  { id: "p10", slug: "groovy-throw-blanket", title: "Groovy Knit Throw", artisan: "Sunbeam Ceramics", basePrice: 96, category: "decor", occasion: ["housewarming"], aesthetic: ["retro"], image: hero, gallery: [hero], description: "Hand-loomed wool throw with retro chevron pattern.", shippingDays: "Ships in 5-7 days", customizable: false },
  { id: "p11", slug: "mini-spice-jar-set", title: "Hand-Labelled Spice Jar Set", artisan: "Northwood Atelier", basePrice: 52, category: "kitchen", occasion: ["housewarming", "wedding"], aesthetic: ["nonna"], image: board, gallery: [board], description: "Twelve glass jars with hand-calligraphed labels.", shippingDays: "Ships in 3-5 days", customizable: false, trending: 5 },
  { id: "p12", slug: "constellation-necklace", title: "Constellation Charm Necklace", artisan: "Lunar Press", basePrice: 78, category: "jewelry", occasion: ["birthday", "anniversary"], aesthetic: ["celestial"], image: box, gallery: [box], description: "14k gold-fill charm engraved with your birth constellation.", shippingDays: "Ships in 5-7 days", customizable: true, personalization: { materials: [{ id: "gold", label: "Gold Fill", priceDelta: 0 }, { id: "silver", label: "Sterling Silver", priceDelta: -10 }], fonts: [{ id: "serif", label: "Serif", family: "Georgia, serif" }], maxChars: 12 } },
];

export function findProduct(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug);
}
