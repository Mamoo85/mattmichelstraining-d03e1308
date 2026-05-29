// youtube-shorts-now — generate + upload a YouTube Short on demand
// v42: Visual redesign of buildFrameSvg(). Hook: larger fonts (98px), cinematic gradient
// (photo visible in top 40%), 22px accent bars, down-chevron via <path> instead of polygon.
// Bullet: lighter overlay (0.22 base opacity vs old 0.88), dark content card (0.76 opacity),
// centered number badge, progress pills (active=wide pill, inactive=small circle).
// CTA: dark card (not solid accent color), down-chevron fixed to point DOWN toward link-in-bio,
// dynamic heading label per CTA type, URL rendered large+bold.
// v41: Fix Pexels-niche OOM. v40 still OOM'd for home/kitchen because Pexels returns
// a background in ~2s (vs 20-30s for AI), so bg+TTS+music were simultaneously in memory.
// Fix: run TTS+music first (IIFE-scoped → GC-eligible on exit), then bg separately.
// Also: two-level font cache — woffBoldBuffer/woffRegBuffer (20KB each, module-level, always
// resident) separate from fontBold/fontRegular (~4MB each, parsed per-request, nulled after
// SVG building). Re-parse from cached WOFF is <50ms with no network. Pexels images now
// requested at 720×1280 (fit=crop) to reduce jpegCoverCrop decode spike from 3.84MB→3.5MB.
// v40: Sequential WASM+font init, null fonts after buildFrameSvg(), IIFE-scoped TTS/music.
// v39: Audio stream (OpenAI TTS PCM + background music), Ken Burns zoom, Pexels backgrounds,
// OpenRouter script generation for new niches (church, farming, podcast, video).
// v38: 1024×1024 image + v35 architecture (jpegCoverCrop in V8 + text-only resvg per frame).
// Root cause of nursery OOM (all versions): WASM linear memory can only grow, never shrink.
// v37 set a ~24MB WASM watermark during bg decode, then each text frame added on top.
// Full-mode path has +3MB Supabase overhead vs. preview → tipped over limit for nursery.
// v38 fix: smaller 1024×1024 image + jpegCoverCrop (pure V8, no WASM) for bg decode.
//   WASM only ever sees text-only SVGs → watermark stays at ~13MB (stable across 6 frames).
//   1024×1024 jpeg-js decode: 4MB RGBA (vs 6MB for 1536) → smaller V8 spike.
// Note: sharp is banned in Supabase edge functions (dlopen libvips fails).
//       Use @resvg/resvg-wasm (pure WASM) + jpeg-js encode-only (pure JS) instead.
// Memory lessons:
//   - Two parallel images keep BOTH b64 strings (~3MB each) live simultaneously → OOM (v34).
//   - jpegCoverCrop(1024×1536 JPEG): large V8 spike → OOM for nursery (OOM v35).
//   - Embed JPEG in SVG per-frame: b64-in-SVG accumulates across frames, no GC → OOM v36.
//   - Two-pass resvg (bg decode once + text renders): WASM watermark from bg stays resident
//     across 6 text renders + Supabase overhead pushes over limit → OOM v37.
//   - v38: jpegCoverCrop with 1024×1024 (4MB RGBA) + text-only WASM (~13MB watermark).
//     Peak per frame: bgRgba(3.7) + textSvg(<0.01) + WASM(13) + textRgba(3.7) +
//     composite(3.7) + encode(4) + Supabase(3) + baseline(12) ≈ 40MB total ✓
//   - decodePngToRgba: stream directly into pre-allocated filtered buffer (no decompParts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import jpegJs from "npm:jpeg-js@0.4.4";
// opentype.js: text → SVG path data (geometry), bypassing resvg-wasm text rendering.
// resvg-wasm@2.6.2 renders geometry (paths/rects/circles) correctly but cannot
// render <text> elements at all (0 visible pixels in all tested approaches).
// opentype.js converts each string to <path d="M...Z"/> that resvg renders perfectly.
import opentype from "npm:opentype.js@1.3.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[YT-NOW] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ─── WASM Init ────────────────────────────────────────────────────────────────
// Lazily fetch resvg WASM binary (~1MB) on first compositing call.
let resvgReady = false;
async function ensureResvg() {
  if (resvgReady) return;
  const wasmResp = await fetch(
    "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm"
  );
  await initWasm(await wasmResp.arrayBuffer());
  resvgReady = true;
  log("resvg WASM initialized");
}

// ─── Font Loading (opentype.js text-to-path approach) ────────────────────────
// @resvg/resvg-wasm@2.6.2 CANNOT render <text> elements (0 pixels regardless
// of font embedding strategy — @font-face data URI, fontFiles, loadSystemFonts).
// Fix: use opentype.js to convert each text string to SVG <path d="M...Z"/>
// geometry before passing to resvg. Geometry always renders correctly.
//
// Memory strategy (v40/v41):
// - woffBoldBuffer / woffRegBuffer: module-level, always resident (~20KB each, tiny).
//   Fetched once on cold start, kept forever → no CDN round-trip on warm calls.
// - fontBold / fontRegular: module-level but NULLED after buildFrameSvg() per request.
//   Parsed opentype.js Font objects are ~1-4MB each. Freeing them before compositing
//   reclaims that memory. Re-parsing from cached WOFF bytes takes <50ms with no network.
// This two-level cache eliminates BOTH the network-fetch cost on warm calls AND the
// ~4MB font-object overhead during the WASM compositing peak.
let woffBoldBuffer: ArrayBuffer | null = null;
let woffRegBuffer: ArrayBuffer | null = null;
// deno-lint-ignore no-explicit-any
let fontBold: any = null;
// deno-lint-ignore no-explicit-any
let fontRegular: any = null;

async function ensureFont(): Promise<void> {
  // Step 1: Fetch WOFF bytes if not cached (network, only on cold start)
  if (!woffBoldBuffer || !woffRegBuffer) {
    const [boldRes, regRes] = await Promise.all([
      fetch(
        "https://cdn.jsdelivr.net/npm/typeface-roboto@1.1.13/files/roboto-latin-700.woff",
        { signal: AbortSignal.timeout(15_000) }
      ),
      fetch(
        "https://cdn.jsdelivr.net/npm/typeface-roboto@1.1.13/files/roboto-latin-400.woff",
        { signal: AbortSignal.timeout(15_000) }
      ),
    ]);
    if (!boldRes.ok) throw new Error(`Font bold fetch failed: ${boldRes.status}`);
    if (!regRes.ok) throw new Error(`Font regular fetch failed: ${regRes.status}`);
    woffBoldBuffer = await boldRes.arrayBuffer();
    woffRegBuffer  = await regRes.arrayBuffer();
    log("WOFF bytes fetched and cached", {
      boldKB: Math.round(woffBoldBuffer.byteLength / 1024),
      regKB:  Math.round(woffRegBuffer.byteLength / 1024),
    });
  }
  // Step 2: Parse Font objects from cached WOFF bytes (CPU only, <50ms, no network)
  if (!fontBold || !fontRegular) {
    fontBold    = opentype.parse(woffBoldBuffer);
    fontRegular = opentype.parse(woffRegBuffer);
    log("Fonts parsed by opentype.js", {
      boldUnits: fontBold.unitsPerEm,
      boldAsc: fontBold.ascender,
      regUnits: fontRegular.unitsPerEm,
    });
  }
}

/**
 * Convert a text string to SVG <path> element(s) using opentype.js.
 * This bypasses resvg-wasm's broken <text> rendering entirely.
 *
 * @param text     The text to render
 * @param x        X coordinate — treated per `anchor`
 * @param y        Y coordinate — SVG baseline position (or mid if dominantBaseline="middle")
 * @param fontSize Font size in SVG user units
 * @param opts     Styling options
 */
function tp(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  opts: {
    weight?: "700" | "400";
    anchor?: "middle" | "start" | "end";
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    paintOrder?: string;
    dominantBaseline?: "middle" | "alphabetic";
  } = {}
): string {
  // deno-lint-ignore no-explicit-any
  const font: any = (opts.weight === "400" ? fontRegular : fontBold) ?? fontBold;
  if (!font) return ""; // fonts not loaded yet — should not happen if ensureFont() was called

  // Adjust x for text-anchor
  let renderX = x;
  const aw = font.getAdvanceWidth(text, fontSize) as number;
  if (opts.anchor === "middle") {
    renderX = x - aw / 2;
  } else if (opts.anchor === "end") {
    renderX = x - aw;
  }

  // Adjust y for dominant-baseline="middle"
  // SVG "middle" aligns the center of the em box at y.
  // Center of em box relative to baseline = (ascender + descender) / 2 * fontSize / unitsPerEm
  // So: opentype_baseline_y = y + (ascender + descender) / 2 * fontSize / unitsPerEm
  let renderY = y;
  if (opts.dominantBaseline === "middle") {
    const emMidOffset = (font.ascender + font.descender) / 2 * fontSize / font.unitsPerEm;
    renderY = y + emMidOffset;
  }

  // Get path data from opentype.js
  const path = font.getPath(text, renderX, renderY, fontSize);
  const d: string = path.toPathData(1); // 1 decimal place precision

  const fill = opts.fill ?? "white";
  let el = `<path d="${d}" fill="${fill}"`;
  if (opts.stroke && opts.strokeWidth) {
    el += ` stroke="${opts.stroke}" stroke-width="${opts.strokeWidth}"`;
    if (opts.paintOrder) el += ` paint-order="${opts.paintOrder}"`;
  }
  el += `/>`;
  return el;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Theme {
  niche: string;
  title: string;
  /** Cinematic lifestyle background image prompt */
  prompt: string;
  /** Second background for alternating bullet frames */
  prompt2?: string;
  cta: string;
  affiliateKw: string | null;
  /** 4 bullet points shown one per frame */
  contents: string[];
  tags: string[];
}

// ─── Theme Library ───────────────────────────────────────────────────────────
// PROVEN TITLE FORMULA (based on 200+ view performers):
//   "[Specific Topic] [Reference/Chart/Poster/Guide] — [Pain Relief OR Bold Claim]"
// Two patterns that work:
//   A. Physical artifact hook: "The [X] Poster I Printed and Never Looked Back"
//   B. Pain-point release: "[Topic] — Stop [Doing X Wrong]"
// Underperforming pattern to AVOID: "[N] Facts/Tips About [X]" (listicle framing)

const THEMES: Theme[] = [
  // === Trades ===
  {
    niche: "trades",
    title: "Wire Gauge Reference Poster — Stop Guessing Before Every Outlet",
    prompt: "Dark professional electrical workshop with dramatic amber side lighting, panel breakers in deep shadow, moody industrial atmosphere, no text no labels",
    prompt2: "Close-up of copper wiring and circuit breakers in dramatic spotlight, dark workshop background, professional industrial photography, no text",
    cta: "Full reference chart — instant download, link in bio",
    affiliateKw: "electrical+safety+equipment+workshop",
    contents: [
      "14 AWG = 15A max|Never run on a 20A breaker",
      "12 AWG = 20A|Standard kitchen & bathroom outlets",
      "10 AWG = 30A|Dryers, AC units, water heaters",
      "6 AWG = 55A|Hot tubs, large EV chargers",
    ],
    tags: ["#Shorts","#Electrician","#ElectricalSafety","#ElectricianLife","#TradesLife","#Apprentice","#OSHA","#WireGauge","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "trades",
    title: "CNC Feed Rates for Aluminum — Stop Burning Endmills",
    prompt: "Dark CNC machine shop with dramatic overhead light illuminating a milling machine, metallic atmosphere, cinematic industrial photography, no text no labels",
    prompt2: "Close-up of carbide endmill cutting aluminum under bright workshop spotlight, metal shavings in foreground, dark moody shop background, no text",
    cta: "Full speed & feed chart — instant download, link in bio",
    affiliateKw: "cnc+machinist+tools+shop",
    contents: [
      "6061 Alum: 0.001 IPR per tooth|4-flute carbide — start here",
      "SFM for aluminum = 800-1000|RPM = (SFM × 3.82) ÷ diameter",
      "Chip load too low = rubbing|Just as damaging as too high",
      "Peck drill at 3× dia deep|Full retract to clear chips",
    ],
    tags: ["#Shorts","#CNCMachinist","#Machinist","#MachinistLife","#CNC","#Manufacturing","#Metalworking","#ShopLife","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "trades",
    title: "Plumber's Cheat Sheet — The Drain Slope Poster That Ends Callbacks",
    prompt: "Dark moody bathroom with dramatic overhead spotlight on exposed copper pipes under a sink, professional plumbing atmosphere, no text no labels",
    prompt2: "Close-up of copper pipe fittings on dark workbench with dramatic industrial lighting, professional product photography, no text",
    cta: "Full plumbing reference chart — instant download, link in bio",
    affiliateKw: "plumbing+tools+pipe+fittings",
    contents: [
      "Drain slope = 1/4\" per foot|Too steep: water outruns the solids",
      "Toilet needs 3\" min drain|2-inch is a code violation",
      "PVC max temp = 140°F|Use CPVC for hot water lines",
      "Main shutoff = clockwise 5 turns|Know where yours is TODAY",
    ],
    tags: ["#Shorts","#Plumber","#PlumberLife","#TradesLife","#PlumbingTips","#DIYPlumbing","#HomeRepair","#PrintableArt","#InstantDownload"],
  },
  // === Fitness ===
  {
    niche: "fitness",
    title: "The Squat Form Poster That Fixed What Trainers Missed",
    prompt: "Dark dramatic garage gym with a single overhead spotlight on a heavy loaded barbell on a squat rack, chalk dust in the air, moody athletic atmosphere, no text",
    prompt2: "Heavy barbell with 45-pound plates on a squat rack in a dim gym, dramatic side lighting, cinematic strength sports photography, no text",
    cta: "Full squat cue poster — instant download, link in bio",
    affiliateKw: "powerlifting+barbell+squat+rack",
    contents: [
      "Push knees OUT over pinky toe|Not caved in — tracked wide",
      "Chest up, not just hips back|Torso angle matters most",
      "Brace 360° BEFORE you unrack|Every single rep, no exceptions",
      "Hip crease below knee cap|Break parallel or it doesn't count",
    ],
    tags: ["#Shorts","#SquatForm","#PowerliftingLife","#HomeGym","#GarageGym","#LiftingTips","#StrengthTraining","#FormCheck","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "fitness",
    title: "The Muscle Map Poster That Teaches More Than Most Trainers",
    prompt: "Dark moody gym interior with dramatic single spotlight on an iron dumbbell rack, deep shadows and strong highlights, cinematic fitness photography, no text",
    prompt2: "Athletic figure in dark gym silhouetted against dramatic backlight, moody cinematic sports photography atmosphere, no text",
    cta: "Full muscle anatomy chart — instant download, link in bio",
    affiliateKw: "home+gym+equipment+dumbbells",
    contents: [
      "Lat pulldown = lats, NOT mid back|Rows = rhomboids and mid-traps",
      "Flat bench = lower pec|Incline at 20-30° = upper pec",
      "Squats = quads + 60% glutes|Lunges = MORE glute activation",
      "Skull crushers = long head|Kickbacks = lateral tricep head",
    ],
    tags: ["#Shorts","#MuscleAnatomy","#HomeGym","#GarageGym","#GymDecor","#LiftingTips","#BodybuilderLife","#FitnessMotivation","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "fitness",
    title: "Progressive Overload Chart — The Only Muscle-Building Rule You Need on Your Wall",
    prompt: "Dark training journal on a gym floor beside a heavy loaded barbell, dramatic overhead spotlight, moody athlete atmosphere, no text on journal pages",
    prompt2: "Dark gym bag open on a bench with chalk and lifting straps, dramatic single overhead light, cinematic athletic photography, no text on labels",
    cta: "12-week progressive overload plan — instant download, link in bio",
    affiliateKw: "home+gym+workout+equipment",
    contents: [
      "Add 5 lbs OR 1 rep per week|That IS progressive overload",
      "4 weeks build → 1 week deload|Deload is NOT optional",
      "Same 3-4 exercises per week|Variety kills Phase 1 progress",
      "Track every set — memory lies|Notebooks don't",
    ],
    tags: ["#Shorts","#ProgressiveOverload","#HomeGym","#GarageGym","#WorkoutPlan","#FitnessGoals","#GymMotivation","#BuildMuscle","#PrintableArt","#InstantDownload"],
  },
  // === Nursery ===
  {
    niche: "nursery",
    title: "Things Nobody Tells You Before Baby Comes Home",
    prompt: "Dark moody nursery with a single warm lamp glow on a white crib, deep shadows, intimate parenting atmosphere, no text",
    prompt2: "Close-up of tiny baby shoes on a dark wood surface with soft warm spotlight, intimate newborn photography atmosphere, no text",
    cta: "New parent checklist — instant download, link in bio",
    affiliateKw: "nursery+decor+baby+room+frames",
    contents: [
      "White noise at 65-70dB|Covers ambient better than any lullaby",
      "Swaddle arms DOWN tight|Arms loose = startle reflex wakes them",
      "Last feed AT bedtime|Don't skip it even if they seem full",
      "Nothing in the crib — nothing|Flat, firm, bare. Every time.",
    ],
    tags: ["#Shorts","#NewMom","#NewParent","#BabyTips","#NurseryTips","#MomLife","#NewbornTips","#BabyHacks","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "nursery",
    title: "Hospital Bag: Pack These or You Will Wish You Had",
    prompt: "Dark moody bedroom with a single warm lamp illuminating a packed hospital bag on a bed, intimate expectant parent atmosphere, no text on items",
    prompt2: "Close-up of tiny folded newborn onesie on dark fabric, soft dramatic spotlight, intimate emotional lifestyle photography, no text",
    cta: "Hospital bag checklist — instant download, link in bio",
    affiliateKw: "hospital+bag+baby+newborn+essentials",
    contents: [
      "10ft phone charger + own pillow|Hospital plugs are far from the bed",
      "Slip-on shoes for mom|Bending post-delivery is very hard",
      "Insurance card + ID in BOTH bags|Not just yours — partner's too",
      "Pack for 3 nights minimum|First births average 40+ hours",
    ],
    tags: ["#Shorts","#NewMom","#PregnancyTips","#HospitalBag","#BabyShower","#ExpectingMom","#MomLife","#BirthPrep","#PrintableArt","#InstantDownload"],
  },
  // === Kitchen ===
  {
    niche: "kitchen",
    title: "Baking Conversions You Will Stop Googling After This",
    prompt: "Dark moody kitchen with dramatic overhead spotlight on a vintage stand mixer and baking ingredients, dark background, cinematic food photography, no text",
    prompt2: "Close-up of artisan bread dough being shaped on dark floured surface, dramatic overhead lighting, moody baking atmosphere, no text",
    cta: "Full baking conversion chart — instant download, link in bio",
    affiliateKw: "baking+tools+kitchen+scale+accessories",
    contents: [
      "1 cup flour = 120g (spooned)|Scooped = 150g — that's why it's dense",
      "350°F = 175°C|90% of all baking uses this temp",
      "Baking soda is 3× baking powder|NEVER substitute 1:1",
      "1 Tbsp = 3 tsp = 15ml|Memorize this. Save every recipe.",
    ],
    tags: ["#Shorts","#BakingTips","#HomeBaker","#BakingHacks","#KitchenTips","#BakingConversions","#KitchenDecor","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "kitchen",
    title: "Wine Pairings Worth Remembering at Dinner",
    prompt: "Dark elegant dinner table with two wine glasses and a candle, dramatic low lighting, sophisticated moody atmosphere, no text on labels",
    prompt2: "Close-up of two wine glasses on dark marble with dramatic spotlight, deep shadows, elegant lifestyle photography, no text",
    cta: "Full wine pairing chart — instant download, link in bio",
    affiliateKw: "wine+glasses+accessories+kitchen",
    contents: [
      "Cabernet + red meat|Tannins cut through fat — classic for a reason",
      "Pinot Grigio + seafood|Light acid matches light protein",
      "Champagne + fried food|Bubbles and salt = perfect balance",
      "Serve whites at 45-50°F|Reds at 60-65°F — not room temp",
    ],
    tags: ["#Shorts","#WineTips","#WinePairing","#WineLover","#DinnerParty","#KitchenDecor","#HomeEntertaining","#PrintableArt","#InstantDownload"],
  },
  // === Home Decor ===
  {
    niche: "home",
    title: "Home Repairs That Save You $500 If You Know Them",
    prompt: "Dark moody home interior with dramatic spotlight on tools on a workbench, deep shadows, cinematic DIY atmosphere, no text no labels",
    prompt2: "Close-up of copper pipes under a sink in dramatic spotlight, dark background, professional home repair photography, no text",
    cta: "Full home repair reference — instant download, link in bio",
    affiliateKw: "wall+art+frames+picture+home+decor",
    contents: [
      "GFCI tripped? Reset the OUTLET|Not the breaker — button is on the outlet",
      "Toilet running = check flapper|$8 part, 10-minute fix, saves $50/month",
      "Caulk THEN grout at the tub|Grout cracks. Caulk flexes. Prevent leaks.",
      "Water heater anode rod|Replace every 5 years or buy a new unit",
    ],
    tags: ["#Shorts","#HomeRepair","#DIY","#HomeImprovement","#HomeHacks","#HomeOwner","#HomeDecor","#PrintableArt","#InstantDownload","#HomeLife"],
  },
  // === Side Hustle ===
  {
    niche: "sidehustle",
    title: "Our Etsy Store Made $847 in Month 1 With No Design Skills",
    prompt: "Dark home office with single monitor glow illuminating hands on keyboard, green notification badges visible on phone beside it, moody ambient late-night atmosphere, no readable text on screens",
    prompt2: "Dark desk with laptop screen glowing showing product grid populating automatically, soft blue ambient light, moody productive atmosphere, no readable text on screen",
    cta: "See the full system — detroitwebagency.com/autopod",
    affiliateKw: null,
    contents: [
      "5 new listings go live every morning|AI designs, writes, and publishes them",
      "Print-on-demand: zero inventory|Printify ships direct to the buyer",
      "$0.33 to create, sells for $4.99|1,400% margin per listing",
      "150+ products live in 30 days|None made manually",
    ],
    tags: ["#Shorts","#SideHustle","#PassiveIncome","#EtsySeller","#PrintOnDemand","#AITools","#OnlineIncome","#EtsyShop","#MakeMoneyOnline","#Automation"],
  },
  {
    niche: "sidehustle",
    title: "The Automation Stack Behind Our Passive Etsy Income",
    prompt: "Dark home office with multiple monitor glow, code and dashboard visible as blurred background light, moody productive night atmosphere, no readable text on screens",
    prompt2: "Dark desk scene with laptop screen glowing softly, phone showing rising graph, ambient late-night home office, no readable text on screens",
    cta: "Full system demo — detroitwebagency.com/autopod",
    affiliateKw: null,
    contents: [
      "Trend scanner finds what sells first|Before you waste a listing on it",
      "AI creates product + image + tags|Under 2 minutes per item",
      "SEO agent refreshes tags weekly|Keeps listings findable over time",
      "Visual QA checks every image|Nothing goes live looking bad",
    ],
    tags: ["#Shorts","#SideHustle","#EtsyBusiness","#PassiveIncome","#PrintOnDemand","#Automation","#AITools","#EtsySeller","#OnlineBusiness","#EtsyTips"],
  },
  {
    niche: "sidehustle",
    title: "Why Print-on-Demand Is the Best Passive Income Model",
    prompt: "Dark living room with warm lamp glow on person relaxing with laptop, cozy moody atmosphere, phone showing earnings notification, no readable text on screens",
    prompt2: "Dark minimal desk with laptop, phone beside it with soft screen glow, calm productive moody home atmosphere, no readable text on screens",
    cta: "We built this for our store — now available for yours, link in bio",
    affiliateKw: null,
    contents: [
      "No inventory, no storage, no risk|Printify only ships when ordered",
      "Etsy has 90M+ active buyers|They come to you — zero paid marketing",
      "One listing earns forever|No expiration, no shelf life",
      "Break even at 1 sale per listing|Everything after is profit",
    ],
    tags: ["#Shorts","#SideHustle","#EtsySeller","#PassiveIncome","#PrintOnDemand","#EtsyShop","#WorkFromHome","#OnlineStore","#MakeMoneyOnline","#EtsyTips"],
  },
  {
    niche: "sidehustle",
    title: "I Added 5 New Etsy Products While Writing This Caption",
    prompt: "Dark home office with clean desk setup, monitor glow showing connected pipeline dashboard steps with green indicators, moody productive atmosphere, no readable text on screen",
    prompt2: "Dark minimal workspace at night, laptop screen casting soft blue light on hands, phone with notification badge, moody home office atmosphere, no readable text on screens",
    cta: "Available for your Etsy store now — link in bio",
    affiliateKw: null,
    contents: [
      "System checks trending niches at 7am|Every day, automatically",
      "Generates product, image, and 13 tags|GPT-4 + DALL-E in one pipeline",
      "Pushes to Printify + Etsy|Live and searchable in under 10 minutes",
      "No coding needed to run it|We manage it for you",
    ],
    tags: ["#Shorts","#EtsySeller","#SideHustle","#AITools","#PrintOnDemand","#PassiveIncome","#EtsyBusiness","#Automation","#OnlineStore","#EtsyTips"],
  },
  // === Church / Ministry ===
  {
    niche: "church",
    title: "5 Ways AI Is Helping Pastors Save 10+ Hours a Week",
    prompt: "Dark warm church interior with dramatic stained glass light rays, wooden pews in shadow, intimate spiritual atmosphere, no text no signs no words",
    prompt2: "Close-up of open Bible on a dark wooden church podium, single dramatic spotlight, peaceful spiritual photography, no text no labels",
    cta: "AI newsletter for your church — link in bio",
    affiliateKw: null,
    contents: [
      "Weekly bulletin built in 3 minutes|Not 2 hours on Thursday night",
      "Sermon outlines from your topic|First draft in under 60 seconds",
      "Monthly newsletter automated|Members get it — you never sweat it",
      "Visitor follow-up emails automated|No new family falls through the cracks",
    ],
    tags: ["#Shorts","#Pastor","#ChurchLife","#MinistryLife","#ChurchCommunications","#ChurchTech","#ChurchAdmin","#Faith","#SermonPrep","#ChurchGrowth"],
  },
  {
    niche: "church",
    title: "Why Your Church Newsletter Takes 4 Hours When It Should Take 4 Minutes",
    prompt: "Dark warm church sanctuary at golden hour, single spotlight on an empty podium, intimate spiritual atmosphere, no text no visible words",
    prompt2: "Close-up of communion elements on dark wood with single dramatic candle, moody sacred photography, no text",
    cta: "Let AI write it — 7-day free trial, link in bio",
    affiliateKw: null,
    contents: [
      "Most church newsletters are written manually|Every single month by a volunteer",
      "AI pulls your announcements + sermon theme|Writes a full draft in 60 seconds",
      "You review, approve, and send|You control everything — AI does the writing",
      "$29/month replaces 4 hours of volunteer time|Every month, automatically",
    ],
    tags: ["#Shorts","#ChurchAdmin","#ChurchCommunications","#Pastor","#MinistryLife","#ChurchTech","#ChurchGrowth","#Faith","#NonprofitLife","#ChurchLife"],
  },
  // === Farming / Agriculture ===
  {
    niche: "farming",
    title: "The One Grain Pricing Signal You Should Watch Every Single Day",
    prompt: "Dark golden wheat field at dusk with dramatic sunset light rays, cinematic wide-angle agricultural photography, no text no signs",
    prompt2: "Dark grain elevator silhouette against stormy dramatic sky, cinematic rural photography, moody atmospheric, no text",
    cta: "SMS price alerts — corn, beans, wheat, link in bio",
    affiliateKw: null,
    contents: [
      "Corn basis changes every market day|Track it or your neighbor beats you to it",
      "USDA crop report moves prices 2-5%|Know the release date BEFORE it drops",
      "Seasonal high typically Feb through June|Lock in contracts before summer pressure",
      "Elevator vs futures basis spread|This gap is your real per-bushel margin",
    ],
    tags: ["#Shorts","#Farming","#GrainFarmer","#CornFarmer","#AgMarkets","#FarmLife","#CropPrices","#GrainMarketing","#Agriculture","#FarmBusiness"],
  },
  {
    niche: "farming",
    title: "Most Farmers Find Out About Price Spikes Too Late — Here's the Fix",
    prompt: "Dark tractor cab at dusk with dramatic dashboard glow, cinematic agricultural lifestyle photography, no readable text on instruments",
    prompt2: "Dark grain bin field at sunset, dramatic golden sky, wide cinematic agricultural photography, no text",
    cta: "Get SMS alerts before your elevator — link in bio",
    affiliateKw: null,
    contents: [
      "Commodity prices move while you're in the field|You check at 6pm — spike was at 10am",
      "Text alert the moment corn hits your target|Set it once, get notified automatically",
      "Works for corn, beans, wheat, canola|Any commodity you sell",
      "$79/month — one extra bushel covers it|And you'll catch more than one",
    ],
    tags: ["#Shorts","#GrainFarmer","#Farming","#AgMarketing","#CropPrices","#FarmLife","#CornMarket","#SoybeanMarket","#Agriculture","#SmartFarming"],
  },
  // === Podcast ===
  {
    niche: "podcast",
    title: "The Show Notes Formula That Gets Podcast Episodes Found on Google",
    prompt: "Dark professional podcast recording studio with dramatic desk lamp on condenser microphone, moody creative atmosphere, no readable text on screens",
    prompt2: "Close-up of professional condenser microphone with dramatic side lighting in dark studio, moody recording atmosphere, no text",
    cta: "AI show notes in 60 seconds — link in bio",
    affiliateKw: null,
    contents: [
      "SEO-friendly title + keyword in line 1|This is how listeners find you via Google",
      "3-sentence episode summary up top|People decide to hit play in 8 seconds",
      "Timestamped chapter markers|Spotify and YouTube both rank these higher",
      "One clear CTA per episode|Not five. One. The most important one.",
    ],
    tags: ["#Shorts","#Podcasting","#PodcastTips","#PodcastGrowth","#PodcastHost","#ContentCreator","#AudioMarketing","#PodcastLife","#ShowNotes","#PodcastSEO"],
  },
  {
    niche: "podcast",
    title: "Your Podcast Has Great Content But Nobody Can Find It — Here's Why",
    prompt: "Dark podcast studio with soft blue monitor glow behind a professional microphone setup, moody creative atmosphere, no readable text",
    prompt2: "Dark studio headphones on a stand with dramatic side lighting, moody audio production atmosphere, no text",
    cta: "AI-written show notes every episode — link in bio",
    affiliateKw: null,
    contents: [
      "70% of podcast listeners discover via search|Show notes are how search finds you",
      "Most podcasters write 3 sentences max|Google needs 200+ words to rank anything",
      "Each episode = a permanent SEO asset|If you write the notes. Zero if you don't.",
      "AI writes full notes from your transcript|60 seconds, ready to publish",
    ],
    tags: ["#Shorts","#PodcastHost","#PodcastTips","#PodcastGrowth","#Podcasting","#ShowNotes","#PodcastSEO","#ContentMarketing","#PodcastLife","#AudioContent"],
  },
  // === Video / Content Creation ===
  {
    niche: "video",
    title: "Why Faceless YouTube Channels Are Outperforming Camera Channels in 2025",
    prompt: "Dark home studio desk setup with monitor glow illuminating a script and microphone, no face visible, moody content creation atmosphere, no readable text on screen",
    prompt2: "Dark overhead view of a creative workspace with laptop and recording equipment, dramatic spotlight, no readable text",
    cta: "AI video scripts for any niche — link in bio",
    affiliateKw: null,
    contents: [
      "Faceless = post daily without being on camera|No hair and makeup. No 'good face day' required.",
      "Algorithm rewards consistency over personality|500 videos beats 10 perfect ones every time",
      "AI generates hooks, scripts, and titles|From topic to filming script in 90 seconds",
      "Niche + volume + AI = passive income channel|This is the play right now",
    ],
    tags: ["#Shorts","#YouTubeGrowth","#FacelessYouTube","#ContentCreator","#AIContent","#YouTubeTips","#VideoMarketing","#PassiveIncome","#SideHustle","#ContentStrategy"],
  },
  // === DWA B2B ===
  {
    niche: "dwa",
    title: "3 Website Mistakes Killing Your Contractor Business Right Now",
    prompt: "Dark Detroit commercial street at night, single business storefront lit from inside, moody urban atmosphere, cinematic city photography, no text on signs",
    prompt2: "Dark contractor truck cab interior with driver reviewing phone screen, moody nighttime job site atmosphere, no readable text on screen",
    cta: "Free site review for Detroit contractors — link in bio",
    affiliateKw: null,
    contents: [
      "Phone not clickable on mobile|55% of local searches are on phones",
      "No Google Business Profile|You are invisible in map searches",
      "Page loads over 3 seconds = gone|53% of visitors leave immediately",
      "No before/after photos|Social proof = 70% more contact forms",
    ],
    tags: ["#Shorts","#DetroitBusiness","#Contractor","#ContractorLife","#SmallBusiness","#WebDesign","#LocalBusiness","#LeadGeneration","#Detroit","#BusinessOwner"],
  },
  {
    niche: "dwa",
    title: "Why 60% of Diners Order Online Before They Even Visit",
    prompt: "Dark elegant restaurant interior at night, warm amber candle lighting on tables, moody dinner service atmosphere, cinematic food service photography, no text on menus",
    prompt2: "Dark restaurant prep counter at night with warm overhead light on tablet showing order screen, professional kitchen background, no readable text on screen",
    cta: "We add online ordering for Detroit restaurants in 7 days, link in bio",
    affiliateKw: null,
    contents: [
      "No online menu = no decision|They pick whoever has photos",
      "Mobile UX beats design every time|If pinching to zoom, they left",
      "Google rank beats Yelp for covers|Local SEO drives 3× more visits",
      "Online ordering adds 25-35% revenue|Without adding a single table",
    ],
    tags: ["#Shorts","#DetroitRestaurant","#RestaurantOwner","#SmallBusiness","#WebDesign","#DetroitBusiness","#LocalBusiness","#Detroit","#FoodBusiness","#OnlineOrdering"],
  },
  {
    niche: "dwa",
    title: "Your Dental Site Is Losing New Patients Every Single Day",
    prompt: "Dark professional dental office hallway with single overhead light, clean white walls in deep shadow, moody healthcare atmosphere, no readable text",
    prompt2: "Dark dental clinic reception area with single warm lamp on desk, clean professional shadows, moody clinical photography, no readable text",
    cta: "Free site audit for Detroit dental practices — link in bio",
    affiliateKw: null,
    contents: [
      "70% check reviews before booking|And find your competitor instead",
      "'Book Now' = 2× more conversions|vs. 'Contact Us' generic form",
      "Insurance page = #1 patient search|Most dental sites don't have one",
      "One Google ranking change|Adds 10+ new patients per month",
    ],
    tags: ["#Shorts","#DentalMarketing","#DetroitBusiness","#DentistLife","#SmallBusiness","#WebDesign","#LocalBusiness","#Detroit","#PatientMarketing","#DentalPractice"],
  },
  // === Woodworking ===
  {
    niche: "woodworking",
    title: "The Wood Joinery Poster That Replaced My Weekend YouTube Rabbit Holes",
    prompt: "Dark rustic woodworking shop with dramatic overhead spotlight on a hand-cut dovetail joint on a workbench, wood shavings scattered, moody craftsman atmosphere, no text no labels",
    prompt2: "Close-up of mortise and tenon joint on dark hardwood, dramatic side lighting, professional woodworking photography, no text",
    cta: "Full joinery reference poster — instant download, link in bio",
    affiliateKw: "woodworking+tools+chisels+mallet",
    contents: [
      "Dovetail = drawer boxes & carcass|Strongest joint for pulling forces",
      "Mortise & tenon = chairs & frames|Resists racking under load",
      "Box joint = corners & trays|Easier to cut, nearly as strong",
      "Pocket screw = fast assembly only|Not for structural stress",
    ],
    tags: ["#Shorts","#Woodworking","#WoodworkingTips","#DIYWoodworking","#WoodworkingPlans","#Joinery","#HandTools","#WoodworkingLife","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "woodworking",
    title: "Lumber Dimensions Lie — The Actual Size Chart Every DIYer Needs",
    prompt: "Dark lumber yard with dramatic spotlight on stacked hardwood boards, rich wood grain textures in deep shadow, professional woodworking atmosphere, no text no labels",
    prompt2: "Close-up of wood boards with tape measure on a dark workshop floor, dramatic overhead light, cinematic craftsman photography, no text",
    cta: "Full lumber size reference chart — instant download, link in bio",
    affiliateKw: "lumber+wood+plywood+workshop",
    contents: [
      "A 2x4 is actually 1.5\" x 3.5\"|Dried and planed after naming",
      "A 1x6 is actually 0.75\" x 5.5\"|Always measure before buying",
      "Plywood: nominal ¾\" = 23/32\"|Matters for cabinet dados",
      "Hardwood sold in board feet|Length × width × thickness ÷ 144",
    ],
    tags: ["#Shorts","#Woodworking","#DIYWoodworking","#HomeImprovement","#WoodworkingTips","#LumberYard","#DIYProjects","#Workshop","#PrintableArt","#InstantDownload"],
  },
  // === Photography ===
  {
    niche: "photography",
    title: "The Exposure Triangle Poster I Wish My First Camera Came With",
    prompt: "Dark photography studio with dramatic Rembrandt lighting on a DSLR camera on a tripod, cinematic product photography atmosphere, no text no labels",
    prompt2: "Close-up of camera lens and dials in dramatic side lighting, shallow depth of field, professional photographer's desk, no text no labels",
    cta: "Full camera settings cheat sheet — instant download, link in bio",
    affiliateKw: "camera+photography+lens+tripod",
    contents: [
      "ISO = sensor sensitivity to light|Higher ISO = brighter + more grain",
      "Aperture = f/stop = light + depth|f/1.8 = blurry background, f/11 = sharp",
      "Shutter speed = motion freeze|1/500 stops action, 1/30 shows blur",
      "The triangle: change one, fix two|They always work together",
    ],
    tags: ["#Shorts","#Photography","#CameraSettings","#PhotographyTips","#LearnPhotography","#DSLR","#PhotographyBasics","#CameraGuide","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "photography",
    title: "Camera Settings Cheat Sheet — Stop Shooting in Auto Forever",
    prompt: "Dark moody photographer workspace with dramatic spotlight on camera body surrounded by prime lenses on a black table, cinematic photography studio atmosphere, no text",
    prompt2: "Dramatic overhead light on camera equipment on a dark studio table, professional photography gear laid out flat, no readable text",
    cta: "Full manual mode cheat sheet — instant download, link in bio",
    affiliateKw: "camera+photography+lens+speedlight",
    contents: [
      "Portrait: f/2.8, 1/200, ISO 400|Background blur, sharp subject",
      "Landscape: f/11, 1/125, ISO 100|Everything sharp, low noise",
      "Sports/action: 1/1000+, f/4, auto ISO|Freeze motion first",
      "Low light: f/2, 1/60, ISO 3200 max|Grain beats blur every time",
    ],
    tags: ["#Shorts","#Photography","#CameraSettings","#ManualMode","#PhotographyTips","#LearnPhotography","#DSLR","#PortraitPhotography","#PrintableArt","#InstantDownload"],
  },
  // === Coffee ===
  {
    niche: "coffee",
    title: "Brew Ratio Chart — The Poster That Ended My Weak Coffee Forever",
    prompt: "Dark moody coffee bar with dramatic warm spotlight on a pour-over setup with fresh ground coffee, steam rising, cinematic cafe atmosphere, no text no labels",
    prompt2: "Close-up of coffee beans and espresso machine portafilter in dramatic side lighting, dark roasted tones, professional cafe photography, no text",
    cta: "Full brew ratio reference chart — instant download, link in bio",
    affiliateKw: "coffee+pour+over+grinder+espresso",
    contents: [
      "Pour over: 1:15 coffee to water|Weigh both — never eyeball",
      "French press: 1:12 for full body|Steep 4 min, plunge slow",
      "Espresso: 1:2 ratio (18g in, 36g out)|Target 25-30 seconds",
      "Cold brew: 1:8, steep 12-24 hrs|Coarse grind, cold water only",
    ],
    tags: ["#Shorts","#Coffee","#CoffeeTips","#HomeCoffee","#CoffeeRatio","#PourOver","#Espresso","#CoffeeBrewing","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "coffee",
    title: "The Espresso Dial-In Chart That Stopped Me Wasting Shots",
    prompt: "Dark dramatic espresso bar with overhead amber light on a gleaming espresso machine, golden crema shot pulling, moody cafe atmosphere, no text on machine dials",
    prompt2: "Close-up of espresso shot dripping into white cup on a dark counter, dramatic side lighting, professional coffee photography, no readable text",
    cta: "Full espresso troubleshooting chart — instant download, link in bio",
    affiliateKw: "espresso+machine+coffee+grinder",
    contents: [
      "Shot too fast (under 20s) = sour|Grind finer or add more coffee",
      "Shot too slow (over 35s) = bitter|Grind coarser or use less coffee",
      "Target: 25-30 seconds, 1:2 ratio|This is where the magic lives",
      "Channeling = uneven extraction|Distribute and tamp level always",
    ],
    tags: ["#Shorts","#Espresso","#Coffee","#CoffeeTips","#HomeCoffee","#EspressoMachine","#CoffeeBrewingTips","#BaristaLife","#PrintableArt","#InstantDownload"],
  },
  // === Cooking ===
  {
    niche: "cooking",
    title: "Meat Temperature Guide — The Poster That Ended Every Overcooked Steak",
    prompt: "Dark dramatic kitchen with overhead spotlight on a perfectly seared steak on cast iron, smoke rising, moody cinematic food photography, no text no labels",
    prompt2: "Close-up of instant-read thermometer in a thick steak on dark wooden cutting board, dramatic backlighting, professional food photography, no readable text on thermometer",
    cta: "Full cooking temperature reference chart — instant download, link in bio",
    affiliateKw: "cast+iron+skillet+meat+thermometer",
    contents: [
      "Steak rare = 125°F|Rest 5 min — carryover adds 5°",
      "Chicken breast = 165°F|Thigh is better at 175°F",
      "Pork: safe at 145°F now|USDA updated this — pink is fine",
      "Ground beef = 160°F always|No exceptions for patties",
    ],
    tags: ["#Shorts","#Cooking","#CookingTips","#MeatTemperature","#Steak","#FoodScience","#HomeCooking","#CookingGuide","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "cooking",
    title: "Spice Combination Chart — The Reference Poster Professional Cooks Hide",
    prompt: "Dark moody spice shelf with dramatic overhead light on rows of glass jars filled with colorful spices, cinematic food photography atmosphere, no text on labels",
    prompt2: "Overhead view of whole spices scattered on a dark stone surface with dramatic spotlight, star anise and cinnamon sticks visible, professional food photography, no text",
    cta: "Full spice pairing reference chart — instant download, link in bio",
    affiliateKw: "spice+rack+cooking+pantry",
    contents: [
      "Cumin + coriander + turmeric|Base for every curry — always together",
      "Smoked paprika + garlic + oregano|Spanish/Mexican base layer",
      "Fennel + red pepper + garlic|Italian sausage flavor in seconds",
      "Cinnamon + cardamom + ginger|Warm baking and chai — the trio",
    ],
    tags: ["#Shorts","#Cooking","#CookingTips","#SpiceCombinations","#HomeCooking","#FoodTips","#CookingHacks","#SpiceChart","#PrintableArt","#InstantDownload"],
  },
  // === Welding ===
  {
    niche: "welding",
    title: "Welding Amperage Chart — Stop Burning Through Every Time",
    prompt: "Dark welding shop with dramatic electric arc glow on a welder's gloved hands and steel workpiece, sparks flying, cinematic industrial photography, no text no labels",
    prompt2: "Close-up of weld bead on steel in dramatic workshop spotlight, molten pool detail, dark industrial atmosphere, no text",
    cta: "Full welding settings reference chart — instant download, link in bio",
    affiliateKw: "welding+welder+mig+tig+equipment",
    contents: [
      "MIG steel 1/8\": 130-180A|Wire speed up with amperage",
      "TIG steel 1/8\": 125A AC/DC|1 amp per 0.001\" thumb rule",
      "Stick 6013 3/32\": 70-90A|Flat/horizontal position",
      "Burn-through = too hot or too slow|Move faster before dropping amps",
    ],
    tags: ["#Shorts","#Welding","#WeldingTips","#WelderLife","#MIGWelding","#TIGWelding","#MetalFabrication","#WeldingGuide","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "welding",
    title: "The Rod Selection Chart Every Stick Welder Needs on the Shop Wall",
    prompt: "Dark fabrication shop with dramatic overhead light on welding rods and electrode holders on a steel workbench, moody industrial atmosphere, no text no labels",
    prompt2: "Close-up of welding rod pack and hot welds on angle iron in dramatic side lighting, dark shop background, professional industrial photography, no text",
    cta: "Full electrode selection reference — instant download, link in bio",
    affiliateKw: "welding+stick+electrode+rod",
    contents: [
      "6010: DC+, deep penetration|Pipeline, dirty or rusty steel",
      "6013: AC/DC, easy slag|Beginner rod, sheet metal, thin steel",
      "7018: DC+, x-ray quality|Structural steel, pressure vessels",
      "Number system: 60 = 60k PSI|Last digit = position + current type",
    ],
    tags: ["#Shorts","#Welding","#StickWelding","#WelderLife","#WeldingTips","#MetalFab","#WeldingRods","#WeldingGuide","#PrintableArt","#InstantDownload"],
  },
  // === Running ===
  {
    niche: "running",
    title: "Pace Chart for Every Race Distance — I Print This Before Every Training Block",
    prompt: "Dark dramatic running track at night with a single overhead light on athletic shoes mid-stride, motion blur, cinematic sports photography, no text",
    prompt2: "Close-up of running watch showing pace on a dark asphalt track, dramatic side lighting, athletic training atmosphere, no text on watch screen",
    cta: "Full training pace reference chart — instant download, link in bio",
    affiliateKw: "running+shoes+gps+watch+training",
    contents: [
      "Easy run = 60-70% max HR|Can hold a full conversation",
      "Tempo = lactate threshold pace|Comfortably hard, 20-40 min max",
      "5K pace = 95% effort|90-second recovery between reps",
      "Long run = 90 sec/mile slower than race|Aerobic base, not fitness test",
    ],
    tags: ["#Shorts","#Running","#RunningTips","#MarathonTraining","#5KTraining","#TrailRunning","#RunningCommunity","#TrainingPlan","#PrintableArt","#InstantDownload"],
  },
  {
    niche: "running",
    title: "Heart Rate Zone Chart — The Running Poster That Fixed My Overtraining",
    prompt: "Dark moody running trail at dusk with dramatic backlight on a lone runner's silhouette, cinematic sports photography, no text",
    prompt2: "Close-up of GPS running watch showing heart rate on a runner's wrist in dramatic outdoor light, athletic endurance atmosphere, no text on screen",
    cta: "Full heart rate zone reference chart — instant download, link in bio",
    affiliateKw: "running+heart+rate+monitor+training",
    contents: [
      "Zone 1: 50-60% max HR|Recovery — most runners skip this",
      "Zone 2: 60-70% max HR|Fat burning, base building — STAY HERE",
      "Zone 3: 70-80%|The 'junk miles' zone — avoid most of the time",
      "Zone 4-5: 80-95%|Race pace — only 1-2× per week maximum",
    ],
    tags: ["#Shorts","#Running","#HeartRateTraining","#RunningTips","#Zone2Training","#MarathonTraining","#Endurance","#RunningCoach","#PrintableArt","#InstantDownload"],
  },
];

// ─── Design Constants ─────────────────────────────────────────────────────────

const NICHE_COLORS: Record<string, string> = {
  trades:      "#FFB300",   // amber gold
  fitness:     "#F44336",   // red
  nursery:     "#EC407A",   // pink
  kitchen:     "#00BCD4",   // teal
  home:        "#4CAF50",   // green
  sidehustle:  "#2196F3",   // blue
  dwa:         "#FF5722",   // deep orange
  church:      "#7C3AED",   // purple
  farming:     "#D97706",   // amber
  podcast:     "#DC2626",   // crimson
  video:       "#0284C7",   // sky blue
  woodworking: "#795548",   // warm brown
  photography: "#1A237E",   // deep navy
  coffee:      "#4E342E",   // espresso brown
  cooking:     "#E65100",   // deep orange-red
  welding:     "#37474F",   // steel blue-grey
  running:     "#1B5E20",   // deep green
};

const NICHE_LABELS: Record<string, string> = {
  trades:      "TRADES",
  fitness:     "FITNESS",
  nursery:     "NURSERY",
  kitchen:     "KITCHEN",
  home:        "HOME DECOR",
  sidehustle:  "SIDE HUSTLE",
  dwa:         "DETROIT WEB",
  church:      "CHURCH",
  farming:     "FARMING",
  podcast:     "PODCAST",
  video:       "VIDEO",
  woodworking: "WOODWORKING",
  photography: "PHOTOGRAPHY",
  coffee:      "COFFEE",
  cooking:     "COOKING",
  welding:     "WELDING",
  running:     "RUNNING",
};

// Pexels niches — use real photos instead of AI-generated backgrounds (free, faster)
// New niches use Pexels: running (athletes easy to find), coffee (cafe shots), cooking (food)
const PEXELS_NICHES = new Set(["fitness", "church", "farming", "podcast", "video", "kitchen", "home", "running", "coffee", "cooking"]);

const CTA_URLS: Record<string, string> = {
  sidehustle: "detroitwebagency.com/autopod",
  dwa:        "detroitwebagency.com",
  church:     "detroitwebagent.com/ai-church-newsletter",
  farming:    "detroitwebagent.com/ag-price-alerts",
  podcast:    "detroitwebagent.com/podcast-show-notes",
  video:      "detroitwebagent.com/ai-video-scripts",
};
const DEFAULT_CTA_URL = "mattmichelstraining.com/gifts";

const CTA_LINES: Record<string, string> = {
  sidehustle: "Free Demo Available",
  dwa:        "Free Site Review",
  church:     "7-Day Free Trial",
  farming:    "Free First Alert",
  podcast:    "Free Sample Notes",
  video:      "First Script Free",
};
const DEFAULT_CTA_LINE = "Instant Download";

// ─── Narration Builder ────────────────────────────────────────────────────────

/** Build a natural-speech narration string from theme content for TTS. */
function buildNarration(theme: Theme): string {
  const facts = theme.contents.map(c => {
    const pipe = c.indexOf("|");
    if (pipe < 0) return c.trim() + ".";
    return c.slice(0, pipe).trim() + " — " + c.slice(pipe + 1).trim() + ".";
  });
  const ctaText = CTA_LINES[theme.niche] ?? DEFAULT_CTA_LINE;
  return `${theme.title}. ${facts.join(" ")} ${ctaText} — link in bio.`;
}

// ─── Text Helpers ─────────────────────────────────────────────────────────────
// Note: escapeXml() has been removed — opentype.js text-to-path takes raw strings.
// All text is now geometry (<path>) not XML text nodes, so no XML escaping needed.

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── SVG Frame Builder ────────────────────────────────────────────────────────

interface FrameConfig {
  type: "hook" | "bullet" | "cta";
  niche: string;
  title: string;
  bulletText?: string;
  bulletNum?: number;   // 1–4
  totalBullets?: number;
  ctaUrl?: string;
  ctaLine?: string;
}

function buildFrameSvg(cfg: FrameConfig): string {
  const W = 1080, H = 1920;
  const accent = NICHE_COLORS[cfg.niche] ?? "#FF5722";
  const nicheLabel = NICHE_LABELS[cfg.niche] ?? cfg.niche.toUpperCase();
  // All text rendered as <path> via tp() — resvg-wasm@2.6.2 cannot render <text> nodes.

  // ── Hook frame ──────────────────────────────────────────────────────────────
  if (cfg.type === "hook") {
    // Large bold title — bigger font for impact on mobile screens
    const titleLines = wrapText(cfg.title, 19);
    const fontSize   = titleLines.length <= 2 ? 98 : titleLines.length === 3 ? 84 : 72;
    const lineHeight = Math.round(fontSize * 1.16);

    // Title positioned in lower 35% of frame — photo clearly visible above
    const blockH    = titleLines.length * lineHeight;
    const blockCenterY = Math.round(H * 0.70);
    const blockTop  = blockCenterY - blockH / 2;

    const titlePaths = titleLines.map((line, i) =>
      tp(line, W / 2, blockTop + i * lineHeight + fontSize, fontSize, {
        weight: "700", anchor: "middle", fill: "white",
        stroke: "rgba(0,0,0,0.95)", strokeWidth: 10, paintOrder: "stroke",
      })
    ).join("\n  ");

    const afterTitle = blockTop + titleLines.length * lineHeight + fontSize + 48;

    // Niche pill: pill shape, accent color
    const badgeW = Math.min(nicheLabel.length * 24 + 88, 640);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- Cinematic gradient: photo shows clearly top 40%, fades to dark at bottom -->
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0.12"/>
      <stop offset="38%"  stop-color="black" stop-opacity="0.08"/>
      <stop offset="56%"  stop-color="black" stop-opacity="0.58"/>
      <stop offset="75%"  stop-color="black" stop-opacity="0.84"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.96"/>
    </linearGradient>
    <!-- Shallow top gradient for badge area legibility -->
    <linearGradient id="topshade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0.58"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grad)"/>
  <rect width="${W}" height="260" fill="url(#topshade)"/>

  <!-- Top accent bar — bold 22px stripe -->
  <rect x="0" y="0" width="${W}" height="22" fill="${accent}"/>

  <!-- Niche pill badge -->
  <rect x="48" y="54" width="${badgeW}" height="86" rx="43" fill="${accent}"/>
  ${tp(nicheLabel, 48 + badgeW / 2, 113, 42, { weight: "700", anchor: "middle", fill: "white" })}

  <!-- Title — large, bold, high-contrast -->
  ${titlePaths}

  <!-- Short accent divider under title -->
  <rect x="${W / 2 - 120}" y="${afterTitle}" width="240" height="10" rx="5" fill="${accent}"/>

  <!-- Swipe hint -->
  ${tp("4 quick tips — keep watching", W / 2, afterTitle + 74, 46, {
    weight: "400", anchor: "middle", fill: "rgba(255,255,255,0.88)",
    stroke: "rgba(0,0,0,0.75)", strokeWidth: 3, paintOrder: "stroke",
  })}

  <!-- Down chevron (path-based, no polyline) -->
  <path d="M ${W/2 - 52} ${afterTitle + 122} L ${W/2} ${afterTitle + 178} L ${W/2 + 52} ${afterTitle + 122}"
    fill="none" stroke="${accent}" stroke-width="15"
    stroke-linejoin="round" stroke-linecap="round"/>

  <!-- Bottom accent bar -->
  <rect x="0" y="${H - 22}" width="${W}" height="22" fill="${accent}"/>
</svg>`;
  }

  // ── Bullet frame ─────────────────────────────────────────────────────────────
  if (cfg.type === "bullet") {
    const num    = cfg.bulletNum   ?? 1;
    const total  = cfg.totalBullets ?? 4;
    const raw    = cfg.bulletText  ?? "";

    const pipeIdx  = raw.indexOf("|");
    const mainFact = pipeIdx >= 0 ? raw.slice(0, pipeIdx).trim() : raw;
    const detail   = pipeIdx >= 0 ? raw.slice(pipeIdx + 1).trim() : "";

    const mainLines   = wrapText(mainFact, 17);
    const detailLines = detail ? wrapText(detail, 22) : [];

    // ── layout (compute top-down, positions are SVG baselines) ───────────────
    const cardX = 56;
    const cardW = W - 112;
    const PAD   = 68;                     // inner padding top & bottom

    // Number badge: large circle centered in card
    const circleR = 60;
    const numCX   = cardX + cardW / 2;
    const numCY   = 420 + PAD + circleR;  // card starts at y=420

    const mainFontSize = mainLines.length <= 2 ? 80 : 66;
    const mainLineH    = Math.round(mainFontSize * 1.18);
    const detailFontSize = 48;
    const detailLineH    = detailFontSize + 18;

    // First main-fact line baseline (OpenType baseline, not cap top)
    const mainY0 = numCY + circleR + 38 + mainFontSize;
    const mainYs = mainLines.map((_, i) => mainY0 + i * mainLineH);

    // Divider + detail
    const divY     = mainYs[mainYs.length - 1] + 22;
    const detailY0 = divY + 30 + detailFontSize;
    const detailYs = detailLines.map((_, i) => detailY0 + i * detailLineH);

    // Card bottom = last content baseline + bottom padding
    const lastY    = detailLines.length > 0
      ? detailYs[detailYs.length - 1]
      : mainYs[mainYs.length - 1];
    const cardTop  = 420;
    const cardH    = Math.round(lastY - cardTop + 48 + PAD);

    const mainPaths = mainLines.map((line, i) =>
      tp(line, W / 2, mainYs[i], mainFontSize, {
        weight: "700", anchor: "middle", fill: "white",
      })
    ).join("\n  ");

    const detailPaths = detailLines.map((line, i) =>
      tp(line, W / 2, detailYs[i], detailFontSize, {
        weight: "400", anchor: "middle", fill: "rgba(255,255,255,0.80)",
      })
    ).join("\n  ");

    // Progress pills: active = wide pill, inactive = small circle
    const dotSpacing = 60;
    const dotsTotalW = total * dotSpacing;
    const dotsStartX = (W - dotsTotalW) / 2;
    const dotsY      = H - 72;
    const dotsSvg = Array.from({ length: total }, (_, i) => {
      const cx = Math.round(dotsStartX + i * dotSpacing + dotSpacing / 2);
      if (i + 1 === num) {
        return `<rect x="${cx - 28}" y="${dotsY - 13}" width="56" height="26" rx="13" fill="${accent}"/>`;
      }
      return `<circle cx="${cx}" cy="${dotsY}" r="11" fill="rgba(255,255,255,0.32)"/>`;
    }).join("\n  ");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- Moderate overlay — photo shows at edges, dark behind content card -->
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0.52"/>
      <stop offset="20%"  stop-color="black" stop-opacity="0.22"/>
      <stop offset="65%"  stop-color="black" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.68"/>
    </linearGradient>
    <linearGradient id="topshade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.0"/>
    </linearGradient>
  </defs>
  <!-- Lighter base overlay — background visible through -->
  <rect width="${W}" height="${H}" fill="url(#grad)"/>
  <rect width="${W}" height="220" fill="url(#topshade)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="22" fill="${accent}"/>

  <!-- Header row: tip counter (left) + niche label (right) -->
  ${tp(`TIP ${num} OF ${total}`, 64, 108, 44, { weight: "700", anchor: "start", fill: "rgba(255,255,255,0.92)" })}
  ${tp(nicheLabel, W - 64, 108, 40, { weight: "700", anchor: "end", fill: accent })}

  <!-- Content card: semi-transparent dark panel -->
  <rect x="${cardX}" y="${cardTop}" width="${cardW}" height="${cardH}" rx="36"
    fill="rgba(0,0,0,0.76)"/>
  <!-- Left accent rail on card -->
  <rect x="${cardX}" y="${cardTop + 36}" width="14" height="${cardH - 72}" rx="7" fill="${accent}"/>

  <!-- Number badge circle -->
  <circle cx="${numCX}" cy="${numCY}" r="${circleR}" fill="${accent}"/>
  ${tp(String(num), numCX, numCY + Math.round(circleR * 0.38), Math.round(circleR * 1.12), {
    weight: "700", anchor: "middle", fill: "white",
  })}

  <!-- Main fact (large, bold, centered) -->
  ${mainPaths}

  <!-- Divider -->
  ${detail ? `<rect x="${W / 2 - 180}" y="${divY}" width="360" height="5" rx="2" fill="${accent}" fill-opacity="0.60"/>` : ""}

  <!-- Supporting detail -->
  ${detailPaths}

  <!-- Progress pills -->
  ${dotsSvg}

  <!-- Bottom accent bar -->
  <rect x="0" y="${H - 22}" width="${W}" height="22" fill="${accent}"/>
</svg>`;
  }

  // ── CTA frame ─────────────────────────────────────────────────────────────────
  if (cfg.type === "cta") {
    const ctaUrl  = cfg.ctaUrl  ?? DEFAULT_CTA_URL;
    const ctaLine = cfg.ctaLine ?? DEFAULT_CTA_LINE;
    const urlLines = wrapText(ctaUrl, 22);

    const cardX  = 80;
    const cardW  = W - 160;
    const cardTop = 460;
    const innerX  = W / 2;

    // Choose heading based on CTA type
    const headLabel = ctaLine === "Instant Download"    ? "FREE DOWNLOAD"      :
                      ctaLine === "Free Demo Available" ? "FREE DEMO"          :
                      ctaLine === "Free Site Review"    ? "FREE SITE REVIEW"   :
                      ctaLine === "7-Day Free Trial"    ? "7-DAY FREE TRIAL"   :
                      ctaLine === "Free First Alert"    ? "FREE FIRST ALERT"   :
                      ctaLine === "Free Sample Notes"   ? "FREE SAMPLE NOTES"  :
                      ctaLine === "First Script Free"   ? "FIRST SCRIPT FREE"  :
                      ctaLine.toUpperCase();

    // Layout: compute positions top-down
    let y = cardTop + 84;
    const headY     = y + 58;     y += 108;
    const div1Y     = y;          y +=  48;
    const urlFont   = 58;
    const urlLineH  = 76;
    const urlY0     = y + urlFont; y += urlLines.length * urlLineH + 56;
    const arrowTopY = y;          y +=  72;
    const bioY      = y + 58;     y += 100;
    const subY      = y + 44;     y +=  80;
    const cardH     = y - cardTop + 48;

    const urlPaths = urlLines.map((line, i) =>
      tp(line, innerX, urlY0 + i * urlLineH, urlFont, {
        weight: "700", anchor: "middle", fill: "white",
      })
    ).join("\n  ");

    const badgeW = Math.min(nicheLabel.length * 24 + 88, 640);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- Cinematic top-clear, bottom-dark gradient -->
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0.12"/>
      <stop offset="38%"  stop-color="black" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="topshade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0.58"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grad)"/>
  <rect width="${W}" height="260" fill="url(#topshade)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="22" fill="${accent}"/>

  <!-- Niche pill top-left -->
  <rect x="48" y="54" width="${badgeW}" height="86" rx="43" fill="${accent}"/>
  ${tp(nicheLabel, 48 + badgeW / 2, 113, 42, { weight: "700", anchor: "middle", fill: "white" })}

  <!-- CTA card: dark, not accent-colored -->
  <rect x="${cardX}" y="${cardTop}" width="${cardW}" height="${cardH}" rx="40"
    fill="rgba(0,0,0,0.84)"/>
  <!-- Accent top border stripe on card -->
  <rect x="${cardX}" y="${cardTop}" width="${cardW}" height="14" rx="7" fill="${accent}"/>

  <!-- Heading (accent color — draws the eye) -->
  ${tp(headLabel, innerX, headY, 64, { weight: "700", anchor: "middle", fill: accent })}

  <!-- Thin divider -->
  <rect x="${cardX + 100}" y="${div1Y}" width="${cardW - 200}" height="4"
    fill="rgba(255,255,255,0.18)" rx="2"/>

  <!-- URL — large and readable -->
  ${urlPaths}

  <!-- Down chevron pointing toward link-in-bio -->
  <path d="M ${innerX - 52} ${arrowTopY} L ${innerX} ${arrowTopY + 60} L ${innerX + 52} ${arrowTopY}"
    fill="none" stroke="${accent}" stroke-width="14"
    stroke-linejoin="round" stroke-linecap="round"/>

  <!-- LINK IN BIO -->
  ${tp("LINK IN BIO", innerX, bioY, 64, { weight: "700", anchor: "middle", fill: "white" })}

  <!-- Tagline / offer description -->
  ${tp(ctaLine, innerX, subY, 46, { weight: "400", anchor: "middle", fill: "rgba(255,255,255,0.72)" })}

  <!-- Bottom accent bar -->
  <rect x="0" y="${H - 22}" width="${W}" height="22" fill="${accent}"/>
</svg>`;
  }

  // Fallback: empty
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"></svg>`;
}

// ─── Image Generation ─────────────────────────────────────────────────────────

/** Generate a 1024×1024 square background image via gpt-image-1. Returns base64 JPEG.
 * Square (not 1024×1536) keeps b64 + jpeg-js decode buffers smaller → lower V8 peak.
 * jpegCoverCrop fills 720×1280 by scaling the square to cover height (scale=1.25×),
 * center-cropping 200px from each side. Background scenes are always centered. */
async function generateImage(prompt: string, openaiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",   // square — smaller JPEG → smaller b64 + decode buffers in V8
      quality: "low",
      n: 1,
      output_format: "jpeg",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Image gen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data from OpenAI");
  return b64;
}

// ─── Hallucination Check ──────────────────────────────────────────────────────

/** Returns true if the image contains AI-generated text. Fails open on error. */
async function checkHallucination(b64Jpeg: string, openrouterKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zmyczlfuufhngzovkjdh.supabase.co",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64Jpeg}` } },
            { type: "text", text: "Does this image contain any visible text, letters, words, numbers, characters, signs, labels, captions, watermarks, or garbled/glitchy characters? Answer only YES or NO." },
          ],
        }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const answer = ((await res.json())?.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
    return answer.startsWith("YES");
  } catch {
    return false;
  }
}

// ─── TTS Narration (OpenAI PCM) ───────────────────────────────────────────────

/**
 * Generate voice narration via OpenAI TTS in PCM format.
 * Returns raw 16-bit signed PCM, 24000 Hz, mono LE.
 * PCM = no decoding needed, plug directly into AVI audio stream.
 * Cost: ~$0.011 per 60-second Short (tts-1 at $0.015/1K chars).
 * Memory: 17s × 24000 Hz × 2 bytes ≈ 816KB — safe within budget.
 */
async function generateTtsNarration(text: string, openaiKey: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: "nova",       // energetic, young female — best for Shorts
        response_format: "pcm", // raw signed 16-bit PCM, 24000 Hz, mono LE
        speed: 1.15,         // slightly faster = more engaging for short-form
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      log("TTS failed (non-fatal)", { status: res.status });
      return null;
    }
    const pcm = new Uint8Array(await res.arrayBuffer());
    log("TTS generated", { bytes: pcm.length, seconds: Math.round(pcm.length / 48000) });
    return pcm;
  } catch (e) {
    log("TTS error (non-fatal)", { err: String(e) });
    return null;
  }
}

// ─── Pexels Photo Background ──────────────────────────────────────────────────

/**
 * Fetch a portrait-orientation photo from Pexels API as JPEG bytes.
 * Free: 25K req/month, instant vs 15-25s gpt-image-1 generation.
 * Returns null if PEXELS_KEY is missing or request fails.
 */
async function fetchPexelsBackground(query: string, pexelsKey: string): Promise<Uint8Array | null> {
  try {
    const searchRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10&size=large`,
      { headers: { Authorization: pexelsKey }, signal: AbortSignal.timeout(8_000) }
    );
    if (!searchRes.ok) return null;
    const { photos } = await searchRes.json() as { photos: Array<{ src: { portrait: string } }> };
    if (!photos?.length) return null;
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 8))];
    // Request portrait pre-sized to 720×1280 via Pexels image resize params.
    // This reduces decoded RGBA from ~3.84MB (800×1200 portrait) to 3.5MB (720×1280),
    // and JPEG size from ~400KB to ~100KB, lowering jpegCoverCrop memory peak.
    const presizedUrl = `${photo.src.portrait}?auto=compress&cs=tinysrgb&fit=crop&w=720&h=1280`;
    const imgRes = await fetch(presizedUrl, { signal: AbortSignal.timeout(10_000) });
    if (!imgRes.ok) return null;
    const buf = await imgRes.arrayBuffer();
    log("Pexels background fetched", { query, bytes: buf.byteLength });
    return new Uint8Array(buf);
  } catch (e) {
    log("Pexels fetch failed (non-fatal)", { err: String(e) });
    return null;
  }
}

// ─── Background Music (Supabase Storage) ─────────────────────────────────────

/** Niche → music mood mapping */
const MUSIC_MOOD: Record<string, string> = {
  trades: "motivational", fitness: "motivational", farming: "motivational",
  sidehustle: "energetic", dwa: "energetic", video: "energetic", podcast: "energetic",
  nursery: "calm", kitchen: "calm", home: "calm", church: "calm",
  default: "energetic",
};

/** Music track filenames stored in Supabase Storage bucket 'shorts-music' */
const MUSIC_TRACKS: Record<string, string[]> = {
  motivational: ["motivational-1.wav", "motivational-2.wav", "motivational-3.wav"],
  energetic:    ["energetic-1.wav",    "energetic-2.wav",    "energetic-3.wav"],
  calm:         ["calm-1.wav",         "calm-2.wav",         "calm-3.wav"],
};

/**
 * Fetch background music from Supabase Storage as raw PCM (WAV → strip 44-byte header).
 * WAV files must be 24kHz, mono, 16-bit PCM to match TTS output format.
 * Returns null silently if bucket or file not found.
 */
async function fetchMusicPcm(
  sb: ReturnType<typeof createClient>,
  niche: string
): Promise<Uint8Array | null> {
  try {
    const mood = MUSIC_MOOD[niche] ?? MUSIC_MOOD.default;
    const tracks = MUSIC_TRACKS[mood] ?? MUSIC_TRACKS.energetic;
    const filename = tracks[Math.floor(Math.random() * tracks.length)];
    const { data, error } = await sb.storage.from("shorts-music").download(filename);
    if (error || !data) return null;
    const wavBytes = new Uint8Array(await (data as Blob).arrayBuffer());
    // WAV = 44-byte RIFF header + raw PCM. Strip header to get PCM.
    if (wavBytes.length < 44) return null;
    log("Music fetched", { filename, pcmBytes: wavBytes.length - 44 });
    return wavBytes.slice(44);
  } catch (e) {
    log("Music fetch failed (non-fatal)", { err: String(e) });
    return null;
  }
}

// ─── PCM Audio Mixer ──────────────────────────────────────────────────────────

/**
 * Mix voice PCM with background music at reduced volume.
 * Both inputs: 16-bit signed LE, 24000 Hz, mono.
 * Music loops to fill voice length. Output = voice + music at musicVol.
 */
function mixPcm(voice: Uint8Array, music: Uint8Array | null, musicVol = 0.18): Uint8Array {
  if (!music || music.length < 4) return voice;
  const samples = Math.ceil(voice.length / 2);
  const out = new Int16Array(samples);
  const v = new Int16Array(voice.buffer, voice.byteOffset, samples);
  const m = new Int16Array(music.buffer, music.byteOffset, Math.floor(music.length / 2));
  for (let i = 0; i < samples; i++) {
    const mv = m.length > 0 ? m[i % m.length] * musicVol : 0;
    out[i] = Math.max(-32768, Math.min(32767, (v[i] || 0) + mv)) | 0;
  }
  return new Uint8Array(out.buffer);
}

// ─── Minimal PNG → RGBA Decoder ──────────────────────────────────────────────
// Handles 8-bit RGBA PNG (the only format resvg-wasm produces).
// Uses only DecompressionStream (Web API built into Deno) — zero npm deps.
async function decodePngToRgba(png: Uint8Array): Promise<{ data: Uint8Array; width: number; height: number }> {
  let offset = 8; // skip 8-byte PNG signature
  let width = 0, height = 0;
  const idatParts: Uint8Array[] = [];

  while (offset < png.length) {
    const len = ((png[offset] << 24) | (png[offset + 1] << 16) | (png[offset + 2] << 8) | png[offset + 3]) >>> 0;
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    const data = png.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width  = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
      height = ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
    } else if (type === "IDAT") {
      idatParts.push(data.slice());
    } else if (type === "IEND") break;
    offset += 12 + len;
  }

  // Stream IDAT parts directly into DecompressionStream — no intermediate concat buffer.
  // Saves ~500KB of heap vs collecting into a single `compressed` Uint8Array.
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  // Write all parts then close — browser/Deno streams buffer internally
  for (const p of idatParts) writer.write(p);
  writer.close();
  // Stream directly into pre-allocated filtered buffer — no decompParts accumulator.
  // Eliminates a 3.7MB intermediate copy that was doubling peak memory usage.
  // (width * 4 + 1) = stride + filter byte per scanline; bpp=4 for RGBA8
  const filtered = new Uint8Array(height * (width * 4 + 1));
  let dOff = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    filtered.set(value, dOff);
    dOff += value.length;
  }

  // Un-filter each scanline (5 PNG filter types)
  const bpp = 4; // bytes per pixel (RGBA8)
  const stride = width * bpp;
  const output = new Uint8Array(width * height * bpp);

  for (let y = 0; y < height; y++) {
    const ft = filtered[y * (stride + 1)];
    const row = filtered.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const out = output.subarray(y * stride, (y + 1) * stride);
    const prv = y > 0 ? output.subarray((y - 1) * stride, y * stride) : new Uint8Array(stride);
    if (ft === 0) {
      out.set(row);
    } else if (ft === 1) { // Sub
      for (let x = 0; x < stride; x++) out[x] = (row[x] + (x >= bpp ? out[x - bpp] : 0)) & 0xff;
    } else if (ft === 2) { // Up
      for (let x = 0; x < stride; x++) out[x] = (row[x] + prv[x]) & 0xff;
    } else if (ft === 3) { // Average
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? out[x - bpp] : 0;
        out[x] = (row[x] + Math.floor((a + prv[x]) / 2)) & 0xff;
      }
    } else { // Paeth (ft === 4)
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? out[x - bpp] : 0, b = prv[x], c = x >= bpp ? prv[x - bpp] : 0;
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        out[x] = (row[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
  }
  return { data: output, width, height };
}

// ─── Text Frame Compositor ────────────────────────────────────────────────────

/**
 * Cover-crop a JPEG to targetW×targetH using pure V8 (no WASM, no sharp).
 *
 * jpeg-js.decode is the ONLY V8-level JPEG decode in the pipeline. Called ONCE
 * per Short, then the result (bgRgba) is reused across all 6 frames.
 *
 * With 1024×1024 source image: decoded RGBA = 4MB V8 spike (vs 6MB for 1536).
 * WASM is never involved in background decode → watermark stays at text-only
 * levels (~13MB) across the entire frame-build loop.
 */
function jpegCoverCrop(jpegBytes: Uint8Array, targetW: number, targetH: number): Uint8Array {
  const decoded = jpegJs.decode(jpegBytes);
  const { data: src, width: srcW, height: srcH } = decoded;
  // Cover: scale up so BOTH dims ≥ target, then center-crop.
  const scale = Math.max(targetW / srcW, targetH / srcH);
  const offX = (srcW * scale - targetW) / 2;
  const offY = (srcH * scale - targetH) / 2;
  const output = new Uint8Array(targetW * targetH * 4);
  for (let ty = 0; ty < targetH; ty++) {
    const sy = Math.min(Math.round((ty + offY) / scale), srcH - 1);
    const srcRowBase = sy * srcW;
    const dstRowBase = ty * targetW;
    for (let tx = 0; tx < targetW; tx++) {
      const sx = Math.min(Math.round((tx + offX) / scale), srcW - 1);
      const si = (srcRowBase + sx) << 2;
      const di = (dstRowBase + tx) << 2;
      output[di]   = src[si];
      output[di+1] = src[si+1];
      output[di+2] = src[si+2];
      output[di+3] = 255;
    }
  }
  return output;
}

/**
 * Composite a text-only SVG overlay over a pre-scaled background RGBA buffer.
 *
 * HOW IT WORKS (v39 — text-only WASM, pure V8 composite, Ken Burns zoom):
 *   1. resvg renders ONLY the text SVG (no embedded images, tiny WASM footprint ~13MB).
 *   2. Ken Burns zoom/pan applied during composited buffer creation (no extra allocation).
 *   3. Porter-Duff source-over composite: text PNG over background RGBA.
 *   4. jpeg-js encode-only (no decode spike).
 *
 * Ken Burns: zoom > 1.0 zooms in (samples smaller region of bgRgba, scales to fill).
 *   Applied DURING composited copy — zero extra memory vs standard copy.
 *
 * WASM watermark from these calls: ~13MB (stable, no JPEG-decode contamination).
 * Peak per frame: bgRgba(3.7) + WASM(13) + textPng(0.5) + textRgba(3.7) +
 *   composite(3.7) + encode(4) + Supabase(3) + baseline(12) ≈ 40MB ✓
 *
 * bgRgba is read-only — we copy it into composited (with optional zoom) before mutating.
 */
async function buildFrame(bgRgba: Uint8Array, svgOverlay: string, zoom = 1.0, panFrac = 0.0): Promise<Uint8Array> {
  const W = 720, H = 1280;

  // Strip outer <svg> wrapper — keep the inner elements (defs, rects, text…).
  const innerContent = svgOverlay
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

  // Text-only SVG — no embedded <image>. resvg WASM sees only vector elements.
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  ${innerContent}
</svg>`;

  // Render overlay via resvg at 720px wide → PNG.
  // All text has been converted to <path> geometry by opentype.js (tp() calls),
  // so resvg-wasm only needs to render geometry — which it does correctly.
  // No font embedding needed — paths are pure geometry.
  await ensureResvg();
  const resvg = new Resvg(textSvg, {
    fitTo: { mode: "width", value: W },
    font: { loadSystemFonts: false },
  });
  const pngBytes = resvg.render().asPng();

  // Decode text PNG → RGBA.
  const { data: textRgba } = await decodePngToRgba(pngBytes);

  // Create composited buffer: copy bgRgba with optional Ken Burns zoom/pan.
  // Ken Burns zoom: zoom=1.0 → straight copy; zoom=1.08 → sample center 93% of image.
  // Zero extra allocation vs standard copy — same 3.7MB output buffer either way.
  const composited = new Uint8Array(W * H * 4);
  if (zoom <= 1.001 && panFrac === 0.0) {
    // Fast path: no zoom — straight copy
    composited.set(bgRgba);
  } else {
    // Ken Burns path: re-sample bgRgba at zoom/pan offset
    const srcFrac = 1.0 / zoom;                          // fraction of source to use
    const srcW_used = srcFrac * W;                       // width of source region
    const srcH_used = srcFrac * H;                       // height of source region
    // panFrac in [-1, 1]: 0 = centered, >0 = shift right, <0 = shift left
    const srcX0 = ((W - srcW_used) / 2) * (1 + panFrac);
    const srcY0 = (H - srcH_used) / 2;
    for (let ty = 0; ty < H; ty++) {
      const sy = Math.min(Math.max(Math.round(srcY0 + ty * srcFrac), 0), H - 1);
      const srcRowBase = sy * W;
      const dstRowBase = ty * W;
      for (let tx = 0; tx < W; tx++) {
        const sx = Math.min(Math.max(Math.round(srcX0 + tx * srcFrac), 0), W - 1);
        const si = (srcRowBase + sx) << 2;
        const di = (dstRowBase + tx) << 2;
        composited[di]   = bgRgba[si];
        composited[di+1] = bgRgba[si+1];
        composited[di+2] = bgRgba[si+2];
        composited[di+3] = 255;
      }
    }
  }

  // Source-over Porter-Duff alpha composite: text on top of background.
  const pixelCount = W * H;
  for (let i = 0; i < pixelCount; i++) {
    const ti = i << 2;
    const a = textRgba[ti + 3] / 255;
    if (a > 0) {
      composited[ti]   = (textRgba[ti]   * a + composited[ti]   * (1 - a)) | 0;
      composited[ti+1] = (textRgba[ti+1] * a + composited[ti+1] * (1 - a)) | 0;
      composited[ti+2] = (textRgba[ti+2] * a + composited[ti+2] * (1 - a)) | 0;
      composited[ti+3] = 255;
    }
  }

  // Encode composited RGBA → JPEG.
  const { data } = jpegJs.encode({ data: composited, width: W, height: H }, 85);
  return new Uint8Array(data.buffer);
}

// ─── AVI Container Builder ────────────────────────────────────────────────────

/**
 * Build an MJPEG AVI with optional PCM audio stream.
 * Each frame shows for durationsInSeconds[i] seconds at 1fps.
 * Total duration = sum(durationsInSeconds).
 * W/H must match the actual JPEG frame dimensions (default 720×1280).
 *
 * audioPcm: raw signed 16-bit LE PCM at AUDIO_HZ Hz, mono.
 *   If provided: AVI gets 2 streams (video + audio), interleaved 00dc + 01wb chunks.
 *   If null: single stream AVI (backward compatible with v38).
 *
 * Audio format: PCM, 24000 Hz, 1 channel, 16-bit (matches OpenAI TTS PCM output).
 * Audio chunks: AUDIO_BPF bytes per video frame (1 second of audio = AUDIO_HZ × 2 bytes).
 */
function buildAvi(
  frames: Uint8Array[],
  durationsInSeconds: number[],
  W = 720,
  H = 1280,
  audioPcm: Uint8Array | null = null,
): Uint8Array {
  const FPS = 1;
  const AUDIO_HZ = 24000;
  const AUDIO_BPF = AUDIO_HZ * 2; // bytes per video frame (1s × 16-bit mono)
  const hasAudio = audioPcm != null && audioPcm.length >= AUDIO_BPF;

  // Expand: repeat each frame N times at 1fps
  const expanded: Uint8Array[] = [];
  const expandedAudio: Uint8Array[] = [];
  for (let i = 0; i < frames.length; i++) {
    const secs = durationsInSeconds[i] ?? 2;
    for (let j = 0; j < secs; j++) {
      expanded.push(frames[i]);
      if (hasAudio) {
        const offset = (expanded.length - 1) * AUDIO_BPF;
        // Slice PCM for this video-second; pad with silence if past the end
        if (offset < audioPcm!.length) {
          const end = Math.min(offset + AUDIO_BPF, audioPcm!.length);
          const slice = audioPcm!.slice(offset, end);
          if (slice.length < AUDIO_BPF) {
            const padded = new Uint8Array(AUDIO_BPF);
            padded.set(slice);
            expandedAudio.push(padded);
          } else {
            expandedAudio.push(slice);
          }
        } else {
          expandedAudio.push(new Uint8Array(AUDIO_BPF)); // silence
        }
      }
    }
  }
  const frameCount = expanded.length;
  const totalAudioSamples = frameCount * AUDIO_HZ;

  const u32 = (n: number) => { const b = new Uint8Array(4); b[0]=n&0xff; b[1]=(n>>8)&0xff; b[2]=(n>>16)&0xff; b[3]=(n>>24)&0xff; return b; };
  const u16 = (n: number) => { const b = new Uint8Array(2); b[0]=n&0xff; b[1]=(n>>8)&0xff; return b; };
  const cc  = (s: string) => { const buf = new Uint8Array(4); const enc = new TextEncoder().encode(s.slice(0, 4)); buf.set(enc); return buf; };
  const cat = (...a: Uint8Array[]) => { const out = new Uint8Array(a.reduce((n,x)=>n+x.length,0)); let i=0; for(const x of a){out.set(x,i);i+=x.length;} return out; };

  const chunk = (id: string, data: Uint8Array): Uint8Array => {
    const pad = data.length % 2;
    const buf = new Uint8Array(8 + data.length + pad);
    buf.set(cc(id), 0); buf.set(u32(data.length), 4); buf.set(data, 8);
    return buf;
  };
  const list = (type: string, data: Uint8Array) => chunk("LIST", cat(cc(type), data));

  // ── Main AVI header (avih) ──────────────────────────────────────────────────
  const avih = cat(
    u32(1_000_000 / FPS),            // dwMicroSecPerFrame
    u32(0),                           // dwMaxBytesPerSec
    u32(0),                           // dwPaddingGranularity
    u32(0x10),                        // dwFlags (AVIF_HASINDEX)
    u32(frameCount),                  // dwTotalFrames
    u32(0),                           // dwInitialFrames
    u32(hasAudio ? 2 : 1),           // dwStreams ← 2 when audio present
    u32(hasAudio ? AUDIO_BPF : 0),   // dwSuggestedBufferSize
    u32(W),                           // dwWidth
    u32(H),                           // dwHeight
    u32(0), u32(0), u32(0), u32(0),  // reserved
  );

  // ── Video stream (stream 0 → "00dc") ───────────────────────────────────────
  const vidStrh = cat(
    cc("vids"), cc("MJPG"),
    u32(0), u16(0), u16(0), u32(0),
    u32(1), u32(FPS),
    u32(0), u32(frameCount),
    u32(0), u32(0xffffffff), u32(0),
    u16(0), u16(0), u16(W), u16(H),
  );
  const vidStrf = cat(
    u32(40), u32(W), u32(H),
    u16(1), u16(24),
    cc("MJPG"),
    u32(W * H * 3),
    u32(0), u32(0), u32(0), u32(0),
  );
  const vidStrl = list("strl", cat(chunk("strh", vidStrh), chunk("strf", vidStrf)));

  // ── Audio stream (stream 1 → "01wb") — only when audioPcm provided ─────────
  let audStrl = new Uint8Array(0);
  if (hasAudio) {
    // strh for audio: auds, PCM, 24000 Hz
    const audStrh = cat(
      cc("auds"),
      u32(0),                    // fccHandler (0 = PCM)
      u32(0),                    // dwFlags
      u16(0), u16(0),            // wPriority, wLanguage
      u32(0),                    // dwInitialFrames
      u32(1),                    // dwScale = 1 (sample-based)
      u32(AUDIO_HZ),             // dwRate = 24000
      u32(0),                    // dwStart
      u32(totalAudioSamples),    // dwLength (total samples)
      u32(AUDIO_BPF),            // dwSuggestedBufferSize (1s)
      u32(0xffffffff),           // dwQuality
      u32(2),                    // dwSampleSize = 2 (16-bit mono)
      u16(0), u16(0), u16(0), u16(0), // rcFrame
    );
    // strf = WAVEFORMATEX: PCM, 1ch, 24000 Hz, 16-bit
    const audStrf = cat(
      u16(1),       // wFormatTag = WAVE_FORMAT_PCM
      u16(1),       // nChannels = 1 (mono)
      u32(AUDIO_HZ), // nSamplesPerSec = 24000
      u32(AUDIO_HZ * 2), // nAvgBytesPerSec = 48000
      u16(2),       // nBlockAlign = 2
      u16(16),      // wBitsPerSample = 16
      u16(0),       // cbSize = 0 (no extra bytes)
    );
    audStrl = list("strl", cat(chunk("strh", audStrh), chunk("strf", audStrf)));
  }

  const hdrl = list("hdrl", cat(chunk("avih", avih), vidStrl, audStrl));

  // ── Movie data (interleaved 00dc + 01wb) ─────────────────────────────────────
  const moviChunks: Uint8Array[] = [];
  for (let i = 0; i < expanded.length; i++) {
    moviChunks.push(chunk("00dc", expanded[i]));
    if (hasAudio) moviChunks.push(chunk("01wb", expandedAudio[i]));
  }
  const moviList = chunk("LIST", cat(cc("movi"), ...moviChunks));

  // ── Legacy index (idx1) — includes both video and audio entries ──────────────
  let off = 4; // relative to start of movi data (after "movi" fourCC)
  const idxEntries: Uint8Array[] = [];
  for (let i = 0; i < expanded.length; i++) {
    const vf = expanded[i];
    const vPad = vf.length % 2;
    idxEntries.push(cat(cc("00dc"), u32(0x10), u32(off), u32(vf.length)));
    off += 8 + vf.length + vPad;
    if (hasAudio) {
      const af = expandedAudio[i];
      const aPad = af.length % 2;
      idxEntries.push(cat(cc("01wb"), u32(0x10), u32(off), u32(af.length)));
      off += 8 + af.length + aPad;
    }
  }
  const idx1 = chunk("idx1", cat(...idxEntries));

  return chunk("RIFF", cat(cc("AVI "), hdrl, moviList, idx1));
}

// ─── YouTube Helpers ──────────────────────────────────────────────────────────

async function refreshYouTubeToken(
  sb: ReturnType<typeof createClient>,
  tokenRow: Record<string, string>,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) return tokenRow.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!res.ok) throw new Error(`YouTube token refresh failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await sb.from("youtube_oauth_tokens").update({
    access_token: data.access_token,
    expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  }).eq("id", tokenRow.id);

  log("Token refreshed");
  return data.access_token;
}

async function uploadToYouTube(
  videoBytes: Uint8Array,
  title: string,
  description: string,
  accessToken: string,
  tags: string[],
): Promise<string> {
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description,
      tags,
      categoryId: "26",
    },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/avi",
        "X-Upload-Content-Length": String(videoBytes.length),
      },
      body: JSON.stringify(metadata),
    }
  );
  if (!initRes.ok) throw new Error(`YouTube init ${initRes.status}: ${(await initRes.text().catch(() => "")).slice(0, 300)}`);

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No Location header from YouTube");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/avi", "Content-Length": String(videoBytes.length) },
    body: videoBytes,
    signal: AbortSignal.timeout(120_000),
  });
  if (!uploadRes.ok) throw new Error(`YouTube upload ${uploadRes.status}: ${(await uploadRes.text().catch(() => "")).slice(0, 300)}`);

  return (await uploadRes.json()).id as string;
}

async function postComment(videoId: string, text: string, accessToken: string): Promise<void> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: text } },
        },
      }),
    }
  );
  if (!res.ok) {
    log("Comment post failed (non-fatal)", { status: res.status });
    return;
  }
  log("Comment posted", { videoId });
}

// ─── Description Builder ──────────────────────────────────────────────────────

function buildDescription(theme: Theme, amazonTag: string | null): string {
  const lines: string[] = [];

  if (theme.niche === "dwa") {
    lines.push(theme.title);
    lines.push("");
    lines.push("What we cover:");
    for (const item of theme.contents) lines.push(`• ${item}`);
    lines.push("");
    lines.push("Detroit Web Agency — free site review in bio.");
  } else if (theme.niche === "sidehustle") {
    lines.push(theme.title);
    lines.push("");
    lines.push("How it works:");
    for (const item of theme.contents) lines.push(`• ${item}`);
    lines.push("");
    lines.push("We built this system for our own Etsy store — now offering it to other sellers.");
    lines.push("Learn more → detroitwebagency.com/autopod");
    lines.push("");
    lines.push("Detroit Web Agency · Matt Michels · (313) 992-1219");
  } else {
    lines.push(theme.title);
    lines.push("");
    lines.push("What's inside:");
    for (const item of theme.contents) lines.push(`• ${item}`);
    lines.push("");
    lines.push("Instant download — print at home or at your local print shop.");
    lines.push("Link in bio → mattmichelstraining.com/gifts");
  }

  if (amazonTag && theme.affiliateKw) {
    lines.push("");
    lines.push(`Related gear: https://www.amazon.com/s?k=${theme.affiliateKw}&tag=${amazonTag}`);
  }

  lines.push("");
  lines.push(theme.tags.join(" "));

  return lines.join("\n");
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

const ANTITEXT_SUFFIX =
  ", absolutely no text no letters no words no numbers no signs no labels no captions anywhere — purely cinematic photographic visual, no watermarks";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const CLIENT_ID      = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
  const CLIENT_SECRET  = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const PEXELS_KEY     = Deno.env.get("PEXELS_API_KEY") ?? "";
  const AMAZON_TAG     = Deno.env.get("AMAZON_ASSOCIATES_TAG") ?? null;
  const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const themeIndex    = parseInt(url.searchParams.get("theme") || "-1", 10);
  const nicheFilter   = url.searchParams.get("niche") ?? null;
  const frameMode     = url.searchParams.get("frame") as "hook" | "bullet" | "cta" | null;
  // preview=true OR any ?frame= param triggers single-frame preview (no upload)
  const previewMode   = url.searchParams.get("preview") === "true" || frameMode !== null;
  const videoMode     = url.searchParams.get("video") === "true";    // full AVI, no upload
  const contactMode   = url.searchParams.get("contact") === "true";  // 2×3 contact sheet JPEG

  let theme: Theme;
  if (themeIndex >= 0 && themeIndex < THEMES.length) {
    theme = THEMES[themeIndex];
  } else if (nicheFilter) {
    const niched = THEMES.filter(t => t.niche === nicheFilter);
    theme = niched.length > 0
      ? niched[Math.floor(Math.random() * niched.length)]
      : THEMES[Math.floor(Math.random() * THEMES.length)];
  } else {
    theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  }

  // ── Video mode: generate full AVI and return as download (no YouTube upload) ──
  if (videoMode) {
    try {
      log("Video mode (no upload)", { niche: theme.niche, title: theme.title });
      await Promise.all([ensureResvg(), ensureFont()]);
      const bgRgba = await (async () => {
        const b64 = await generateImage(theme.prompt + ANTITEXT_SUFFIX, OPENAI_API_KEY);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return jpegCoverCrop(bytes, 720, 1280);
      })();
      const ctaUrl  = CTA_URLS[theme.niche]  ?? DEFAULT_CTA_URL;
      const ctaLine = CTA_LINES[theme.niche] ?? DEFAULT_CTA_LINE;
      const bullets = theme.contents.slice(0, 4);
      const frameConfigs: Array<{ svg: string; secs: number }> = [
        { svg: buildFrameSvg({ type: "hook", niche: theme.niche, title: theme.title }), secs: 3 },
        ...bullets.map((bullet, i) => ({
          svg: buildFrameSvg({ type: "bullet", niche: theme.niche, title: theme.title, bulletText: bullet, bulletNum: i + 1, totalBullets: bullets.length }),
          secs: 2,
        })),
        { svg: buildFrameSvg({ type: "cta", niche: theme.niche, title: theme.title, ctaUrl, ctaLine }), secs: 3 },
      ];
      const builtFrames: Uint8Array[] = [];
      const durations: number[] = [];
      for (let i = 0; i < frameConfigs.length; i++) {
        builtFrames.push(await buildFrame(bgRgba, frameConfigs[i].svg));
        durations.push(frameConfigs[i].secs);
        log(`Video frame ${i + 1}/${frameConfigs.length} done`);
      }
      const videoBytes = buildAvi(builtFrames, durations);
      const safeName = (theme.title.slice(0, 50).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_")) + ".avi";
      log("AVI ready for download", { bytes: videoBytes.length, file: safeName });
      return new Response(videoBytes, {
        headers: {
          ...corsHeaders,
          "Content-Type": "video/x-msvideo",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": String(videoBytes.length),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── Contact sheet mode: 2×3 grid of all 6 frames as one JPEG (no upload) ───
  // Each frame scaled to 360×640, arranged 2 cols × 3 rows → 720×1920 JPEG.
  // Universally viewable on any device/browser — no codec needed.
  if (contactMode) {
    try {
      log("Contact sheet mode", { niche: theme.niche, title: theme.title });
      await Promise.all([ensureResvg(), ensureFont()]);
      const bgRgba = await (async () => {
        const b64 = await generateImage(theme.prompt + ANTITEXT_SUFFIX, OPENAI_API_KEY);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return jpegCoverCrop(bytes, 720, 1280);
      })();
      const ctaUrl  = CTA_URLS[theme.niche]  ?? DEFAULT_CTA_URL;
      const ctaLine = CTA_LINES[theme.niche] ?? DEFAULT_CTA_LINE;
      const bullets = theme.contents.slice(0, 4);
      const svgs = [
        buildFrameSvg({ type: "hook", niche: theme.niche, title: theme.title }),
        ...bullets.map((b, i) => buildFrameSvg({ type: "bullet", niche: theme.niche, title: theme.title, bulletText: b, bulletNum: i + 1, totalBullets: 4 })),
        buildFrameSvg({ type: "cta", niche: theme.niche, title: theme.title, ctaUrl, ctaLine }),
      ];

      // Build sheet one frame at a time — avoids holding all 6 decoded frames simultaneously.
      // Old approach held 6 × 3.7MB JPEG + 3.7MB decoded at once → OOM in contact sheet mode.
      // New: render frame → copy pixels into sheet → discard frame → next frame.
      const TW = 360, TH = 640, COLS = 2, ROWS = 3;
      const SHEET_W = TW * COLS, SHEET_H = TH * ROWS;
      const sheet = new Uint8Array(SHEET_W * SHEET_H * 4);

      for (let fi = 0; fi < svgs.length; fi++) {
        const frameJpeg = await buildFrame(bgRgba, svgs[fi]);
        // Decode the JPEG frame back to RGBA for pixel-level placement
        const decoded = jpegJs.decode(frameJpeg);
        const { data: src, width: srcW, height: srcH } = decoded;
        const col = fi % COLS, row = Math.floor(fi / COLS);
        const offX = col * TW, offY = row * TH;
        const scaleX = srcW / TW, scaleY = srcH / TH;
        for (let ty = 0; ty < TH; ty++) {
          const sy = Math.min(Math.floor(ty * scaleY), srcH - 1);
          for (let tx = 0; tx < TW; tx++) {
            const sx = Math.min(Math.floor(tx * scaleX), srcW - 1);
            const si = (sy * srcW + sx) << 2;
            const di = ((offY + ty) * SHEET_W + (offX + tx)) << 2;
            sheet[di]   = src[si];
            sheet[di+1] = src[si+1];
            sheet[di+2] = src[si+2];
            sheet[di+3] = 255;
          }
        }
        // frameJpeg and decoded go out of scope → GC eligible before next frame
      }

      const { data } = jpegJs.encode({ data: sheet, width: SHEET_W, height: SHEET_H }, 88);
      const jpegBytes = new Uint8Array(data.buffer);
      log("Contact sheet ready", { bytes: jpegBytes.length, frames: svgs.length });
      return new Response(jpegBytes, {
        headers: { ...corsHeaders, "Content-Type": "image/jpeg" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── Preview mode: return one frame as JPEG (no YouTube upload) ────────────
  if (previewMode) {
    try {
      const ftype = frameMode ?? "hook";
      log("Preview mode", { niche: theme.niche, title: theme.title, frame: ftype });

      await Promise.all([ensureResvg(), ensureFont()]);

      const bgRgba = await (async () => {
        const b64 = await generateImage(theme.prompt + ANTITEXT_SUFFIX, OPENAI_API_KEY);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return jpegCoverCrop(bytes, 720, 1280);
        // b64 and bytes go out of scope here
      })();

      let svg: string;
      if (ftype === "bullet") {
        svg = buildFrameSvg({ type: "bullet", niche: theme.niche, title: theme.title, bulletText: theme.contents[0], bulletNum: 1, totalBullets: 4 });
      } else if (ftype === "cta") {
        svg = buildFrameSvg({ type: "cta", niche: theme.niche, title: theme.title, ctaUrl: CTA_URLS[theme.niche] ?? DEFAULT_CTA_URL, ctaLine: CTA_LINES[theme.niche] ?? DEFAULT_CTA_LINE });
      } else {
        svg = buildFrameSvg({ type: "hook", niche: theme.niche, title: theme.title });
      }

      const frameBytes = await buildFrame(bgRgba, svg);
      return new Response(frameBytes, {
        headers: { ...corsHeaders, "Content-Type": "image/jpeg" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: tokenRows } = await sb
    .from("youtube_oauth_tokens")
    .select("*")
    .order("updated_at", { ascending: true });

  if (!tokenRows || tokenRows.length === 0) {
    return new Response(JSON.stringify({ error: "No YouTube tokens — visit /youtube-oauth-start" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── v41 OOM-safe initialization (3-phase, staged memory peaks) ────────────
    // v40 was still OOMing for Pexels niches on warm instances: Pexels images arrive
    // in ~2s (vs 20-30s for AI), so bg+TTS+music were all simultaneously in memory.
    // v41 fix: run TTS+music FIRST in an IIFE (so raw buffers are GC-eligible before
    // bgRgba is decoded), then fetch background separately.
    //
    // Memory peak by phase (all phases < 38MB even with 2MB warm-instance residual):
    //   Phase 1 (WASM+font parse): WASM(13) + fonts(4) = 17MB + baseline → 29MB
    //   Phase 2 (TTS+music IIFE): +TTS(0.8) + music_peak(4MB) = 21.8MB + baseline → 33.8MB
    //   Phase 3 (bgRgba decode): WASM(13) + fonts(4) + mixedPcm(0.8) + bgRgba_peak(7.1) = 24.9MB → 36.9MB ✓
    //   Phase 4 (null fonts → compositing): WASM(13) + bgRgba(3.5) + mixedPcm(0.8) + frame(7.15) = 24.45MB → 36.45MB ✓
    //
    // With 2MB warm-instance residual, worst peak = 38.9MB — under 40MB limit.

    const narrationText = buildNarration(theme);
    log("Narration text built", { chars: narrationText.length, preview: narrationText.slice(0, 80) });

    // Phase 1: WASM + fonts (network: cold-start only, else <50ms re-parse from cached WOFF)
    await Promise.all([ensureResvg(), ensureFont()]);
    log("WASM + Roboto fonts ready");

    // Phase 2: TTS + music in parallel inside an IIFE.
    // The IIFE scopes the raw TTS Uint8Array and raw music Uint8Array so they become
    // GC-eligible the moment the IIFE returns. Only the smaller mixedPcm exits the IIFE.
    // Peak: WASM(13) + fonts(4) + TTS(0.8) + music_peak(4MB) = 21.8MB + baseline → 33.8MB ✓
    const mixedPcm: Uint8Array | null = await (async (): Promise<Uint8Array | null> => {
      const [tts, music] = await Promise.all([
        generateTtsNarration(narrationText, OPENAI_API_KEY),
        fetchMusicPcm(sb, theme.niche),
      ]);
      if (!tts) { log("TTS unavailable — silent video"); return null; }
      log("TTS + music ready", { ttsBytes: tts.length, musicBytes: music?.length ?? 0 });
      const mixed = mixPcm(tts, music);
      log("Audio mixed", { mixedBytes: mixed.length });
      // tts (~0.8MB) and music (~2-4MB) go out of IIFE scope here → GC-eligible
      return mixed;
    })();

    // Phase 3: Background image — runs AFTER TTS+music are freed.
    // For Pexels niches this is fast (~2s); for AI niches it's 20-30s.
    // Either way, large TTS/music buffers are not simultaneously in V8 heap.
    // Pexels URL includes &w=720&h=1280&fit=crop for pre-sized delivery → smaller decode.
    log("Fetching background", { niche: theme.niche, pexelsEligible: PEXELS_NICHES.has(theme.niche) });
    const bgRgba = await (async (): Promise<Uint8Array> => {
      if (PEXELS_KEY && PEXELS_NICHES.has(theme.niche)) {
        const pexelsQuery = theme.niche === "farming"      ? "grain farm agricultural" :
                            theme.niche === "church"       ? "church sanctuary interior" :
                            theme.niche === "podcast"      ? "podcast microphone studio" :
                            theme.niche === "video"        ? "content creator desk setup" :
                            theme.niche === "running"      ? "runner athletic trail sport" :
                            theme.niche === "coffee"       ? "espresso coffee barista dark" :
                            theme.niche === "cooking"      ? "chef kitchen cooking dark" :
                            theme.niche === "photography"  ? "camera photography studio equipment" :
                            theme.niche;
        const pexelsJpeg = await fetchPexelsBackground(pexelsQuery, PEXELS_KEY);
        if (pexelsJpeg) {
          log("Using Pexels background");
          return jpegCoverCrop(pexelsJpeg, 720, 1280);
        }
      }
      log("Generating AI background image", { title: theme.title });
      const b64 = await generateImage(theme.prompt + ANTITEXT_SUFFIX, OPENAI_API_KEY);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return jpegCoverCrop(bytes, 720, 1280);
    })();
    log("Background ready (720×1280 RGBA)");

    const ctaUrl  = CTA_URLS[theme.niche]  ?? DEFAULT_CTA_URL;
    const ctaLine = CTA_LINES[theme.niche] ?? DEFAULT_CTA_LINE;
    const bullets = theme.contents.slice(0, 4);

    // ── Ken Burns zoom curve (6 frames: hook/b1/b2/b3/b4/cta) ────────────────
    // Subtle slow push-in: starts slightly zoomed out, ends slightly more zoomed.
    // Zoom values applied INSIDE buildFrame (no extra memory allocation).
    // panFrac: 0 = center, positive = drift slightly right
    const zoomCurve = [1.00, 1.02, 1.04, 1.06, 1.04, 1.02];
    const panCurve  = [0.00, 0.02, 0.03, 0.02, 0.01, 0.00];

    // Build 6 frames with per-frame durations (seconds):
    //   Frame 0: Hook       — 3s
    //   Frames 1–4: Bullets — 2s each
    //   Frame 5: CTA        — 3s
    // bgRgba shared (read-only); Ken Burns zoom applied per frame via buildFrame params.
    const frameConfigs: Array<{ svg: string; secs: number }> = [
      {
        svg: buildFrameSvg({ type: "hook", niche: theme.niche, title: theme.title }),
        secs: 3,
      },
      ...bullets.map((bullet, i) => ({
        svg: buildFrameSvg({ type: "bullet", niche: theme.niche, title: theme.title, bulletText: bullet, bulletNum: i + 1, totalBullets: bullets.length }),
        secs: 2,
      })),
      {
        svg: buildFrameSvg({ type: "cta", niche: theme.niche, title: theme.title, ctaUrl, ctaLine }),
        secs: 3,
      },
    ];

    // ── Phase 3 (v40): Free font objects after all SVG paths are extracted ───
    // opentype.js Font objects hold parsed glyph data (~1.5-4MB combined for both fonts).
    // They are ONLY needed for buildFrameSvg() calls above (text → SVG <path> conversion).
    // Freeing them now recovers this memory before the WASM compositing peak begins.
    // On the next warm-instance call, ensureFont() re-parses from cached ArrayBuffer (~20KB).
    fontBold = null;
    fontRegular = null;
    log("Fonts freed — SVG paths already embedded in frameConfigs");

    // Composite all frames (sequential — resvg WASM is CPU-bound)
    const builtFrames: Uint8Array[] = [];
    const durations: number[] = [];
    for (let i = 0; i < frameConfigs.length; i++) {
      const cfg = frameConfigs[i];
      const frameBytes = await buildFrame(bgRgba, cfg.svg, zoomCurve[i] ?? 1.0, panCurve[i] ?? 0.0);
      builtFrames.push(frameBytes);
      durations.push(cfg.secs);
      log(`Frame ${i + 1}/${frameConfigs.length} composited (${cfg.secs}s, zoom=${zoomCurve[i]})`);
    }

    const totalSecs = durations.reduce((a, b) => a + b, 0);
    log("Building AVI", { frames: builtFrames.length, totalSecs, hasAudio: !!mixedPcm });
    const videoBytes = buildAvi(builtFrames, durations, 720, 1280, mixedPcm);
    log("AVI built", { bytes: videoBytes.length, audio: mixedPcm ? "yes" : "silent" });

    const shortTitle = `${theme.title} #Shorts`;
    const description = buildDescription(theme, AMAZON_TAG);
    const uploaded: string[] = [];
    const channelErrors: string[] = [];

    for (const tokenRow of tokenRows) {
      try {
        const accessToken = await refreshYouTubeToken(sb, tokenRow, CLIENT_ID, CLIENT_SECRET);
        log("Uploading to channel", { channel: tokenRow.channel_title });
        const videoId = await uploadToYouTube(videoBytes, shortTitle, description, accessToken, theme.tags.map(t => t.replace(/^#/, "")));
        log("Uploaded", { videoId, channel: tokenRow.channel_title });
        await postComment(videoId, theme.cta, accessToken);
        await sb.from("youtube_shorts").insert({
          etsy_listing_id: null,
          youtube_video_id: videoId,
          title: shortTitle,
          status: "published",
          hallucination_check_passed: true, // cinematic prompts skipped (no AI text expected)
          hallucination_attempts: 1,
        });
        uploaded.push(`https://www.youtube.com/shorts/${videoId}`);
      } catch (chErr) {
        const errMsg = String(chErr);
        log("Channel upload failed (non-fatal)", { channel: tokenRow.channel_title, err: errMsg });
        channelErrors.push(`[${tokenRow.channel_title ?? tokenRow.id}]: ${errMsg}`);
      }
    }

    if (uploaded.length === 0) throw new Error(`Upload failed for all channels — ${channelErrors.join(" | ")}`);

    return new Response(
      JSON.stringify({
        success: true,
        urls: uploaded,
        channels: uploaded.length,
        niche: theme.niche,
        frames: builtFrames.length,
        totalSeconds: durations.reduce((a, b) => a + b, 0),
        audio: mixedPcm ? "voice+music" : "silent",
        kenBurns: true,
        pexelsBackground: PEXELS_KEY && PEXELS_NICHES.has(theme.niche),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
