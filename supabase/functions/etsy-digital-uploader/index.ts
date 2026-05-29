// etsy-digital-uploader v3 — daily 2pm UTC
// Generates 3-variation printable wall art sets via gpt-image-1 (decorative themes)
// OR proper SVG-rendered checklists/planners (text-heavy themes — NO AI text rendering).
// Includes OAuth token refresh, smart theme rotation, SEO-rich metadata, audit mode.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

// Lazy WASM init — fetch binary from CDN on first checklist call (~1MB, ~300ms one-time)
let resvgReady = false;
async function ensureResvg() {
  if (resvgReady) return;
  const wasmResp = await fetch(
    "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm"
  );
  const wasmBuf = await wasmResp.arrayBuffer();
  await initWasm(wasmBuf);
  resvgReady = true;
  log("Resvg WASM initialized");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[ETSY-DIGITAL] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const TAXONOMY_ID = 2078; // Digital Prints
const PRICE_CENTS = 499; // $4.99
const LISTINGS_PER_RUN = 1; // 1 per run — cron fires 3× daily; 3 at once exceeds 150s compute limit
const IMAGES_PER_LISTING = 3;

// 130 niche themes across 13 categories — top-seller inspired, copyright-safe
const THEMES_BY_CATEGORY: Record<string, string[]> = {
  maker: [
    "DANGER forklift operating area warning sign, industrial OSHA-style safety poster, bold black yellow chevron border, white block letter text, high contrast",
    "FIRE EXIT keep clear emergency evacuation route, workplace safety poster, bold red and white high contrast, running figure arrow symbol",
    "PPE REQUIRED safety equipment checklist, hard hat safety glasses gloves icons row, industrial yellow black grid layout, professional bold sans-serif",
    "ELECTRICAL HAZARD authorized personnel only, lightning bolt warning symbol, OSHA yellow and black high-contrast safety sign, bold caps",
    "FIRST AID station location, red cross symbol large, workplace emergency response poster, clean infographic layout, white and red bold",
    "CNC router speeds and feeds quick reference chart, RPM vs feed rate data table grid, technical infographic dark navy blue, white text clean layout",
    "router bit types illustrated visual guide, straight roundover cove rabbet flush-trim bits labeled diagrams, woodworking technical blueprint style",
    "woodworking joinery types illustrated guide, dovetail mortise tenon dado rabbet butt joint technical diagram, clean blueprint aesthetic",
    "sandpaper grit guide for woodworkers printable, 60 to 400 grit scale comparison chart, when to use each grit, workshop dark kraft aesthetic",
    "standard drill bit sizes chart, fractional decimal metric equivalent table, precision dark technical grid format, professional reference card",
    "sacred geometry mandala fine line art, intricate symmetrical star and flower of life pattern, black line art white background, laser cut wall art inspired",
    "Celtic knot geometric interlocking endless pattern, precision fine line art white background, black symmetrical border design, laser engraving aesthetic",
    "hexagonal honeycomb tessellation geometric pattern, repeating precision line art, modern minimal black on white, laser cut panel wall art inspired",
    "art deco geometric sunburst radial symmetrical pattern, fan rays triangles chevrons, black and gold fine line art, laser cut decorative panel",
    "floral mandala intricate symmetrical circle, lotus petal fine line pattern, boho black line art white background, laser cut wall decor inspired",
    "workshop tool pegboard label sticker set, wrench hammer screwdriver pliers saw level icons, clean black silhouette white printable label sheet",
    "garage workshop safety rules poster, protective equipment always required respect tools keep clean, bold industrial typography dark steel and orange",
    "AWG wire gauge ampacity reference chart, American wire gauge to diameter and amps table, professional technical diagram dark background white grid",
    "screw and bolt thread size chart printable, metric imperial comparison, Phillips flathead hex torx head type diagrams, dark technical blueprint",
    "makerspace code of conduct poster, treat tools with respect share the space leave it cleaner, bold chalk blackboard typography white on black",
  ],
  motivational: [
    "progress over perfection, modern minimalist upward arrow accent typography, white and charcoal",
    "she believed she could so she kept going, empowering feminine bold serif quote, gold and white",
    "dream bigger than your fears, flowing script pastel watercolor background, soft lavender cream",
    "your only limit is your own mind, geometric abstract bold sans-serif, black white gold accent",
    "be the energy you want to attract, radiant starburst illustration typography, coral and mustard",
    "consistency beats intensity, clean athletic repeated pattern typography, navy and white",
    "prove them wrong with your success, premium bold block letters, black and gold foil aesthetic",
    "you are capable of amazing things, hand-lettered watercolor floral wreath, blush pink and sage",
    "good things take time keep going, minimalist hourglass illustration, warm cream and terracotta",
    "start where you are use what you have, rustic inspirational farmhouse typography, warm wood tones",
    "make today count tomorrow isn't promised, bold serif motivational, black and white high contrast",
    "she is strong brave and enough, empowering watercolor abstract feminine, blush and gold",
  ],
  wellness: [
    "breathe rest recharge repeat, minimal leaf botanical illustration, calming sage green and cream",
    "your mental health matters, soft abstract soothing pastel shapes, lavender and white",
    "rest is not lazy it is healing, cozy bedroom aesthetic warm tones, blush and ivory",
    "nourish your body and soul, botanical herbs illustration wellness, green and white",
    "be kind to your mind, hand-drawn heart with leaf wreath, pastel mint and gold",
    "healing takes time be patient with yourself, abstract calm watercolor wash, blue and lavender",
    "slow down you are enough, zen minimal circle illustration, neutral beige and charcoal",
    "this space is for peace and growth, room dedication minimalist, soft grey and blush",
    "today I choose peace over everything, meditation lotus minimal, dusty rose and cream",
    "you deserve all the good things, affirmation gentle watercolor floral, soft peach and sage",
  ],
  kitchen: [
    "but first coffee, hand-lettered farmhouse script cream background coffee steam illustration",
    "this kitchen runs on love and chaos, playful family kitchen typography, yellow and white warm",
    "gather here with grateful hearts, dining farmhouse wreath typography, neutral cream and brown",
    "wine a little laugh a lot, elegant wine glass script lettering, burgundy and gold",
    "life is short eat the cake, whimsical cake illustration playful typography, pink and white",
    "cook with love serve with joy, farmhouse herbs illustration typography, sage and cream",
    "in this kitchen we dance, retro typography kitchen scene playful, teal and white",
    "home is wherever my coffee is, cozy mug illustration script font, warm brown and cream",
    "eat drink and be grateful, elegant dining room typography wreath, gold and white",
    "the secret ingredient is always love, handwritten recipe-style typography, warm cream and red",
  ],
  humor: [
    "adulting is hard can I go back to naps, sarcastic bold modern typography, black and white",
    "I run on coffee sarcasm and dry humor, bold adult humor quote, black white orange",
    "nap queen retro crown illustration, sarcastic royalty humor, pastel purple and gold",
    "not today motivation, reversed humor bold font, red and white minimalist",
    "I am not arguing I am passionately explaining, dry wit quote, navy and white",
    "sorry I'm late my blanket held me hostage, cozy lazy humor illustration, cream and lavender",
    "I need a six month vacation twice a year, relatable humor, tropical colors funny bold",
    "my house was clean last week sorry you missed it, funny housekeeping script, black and white",
    "I followed my heart and it led me to the couch, cozy lazy humor, warm orange and cream",
    "save water drink wine, elegant humor wine illustration, purple gold typography",
    "I'm not lazy I'm on energy saving mode, tech humor minimalist, grey and white",
    "decaf is the enemy, coffee lover strong opinion bold, black and orange espresso aesthetic",
  ],
  family: [
    "in this house we do love mess and second chances, family rules bold farmhouse, cream charcoal",
    "mama bear fierce and loving, illustrated bear florals earth tones, warm amber",
    "motherhood fueled by love coffee and sheer determination, modern mom quote, blush and gold",
    "this is us loud imperfect perfectly us, family love playful, colorful warm",
    "home is where my people are, cozy house illustration script, warm neutral tones",
    "family where life begins love never ends, script floral wreath elegant, blush and gold",
    "raising tiny humans is the hardest best job, parenting warmth typography, sage and cream",
    "blessed beyond measure grateful beyond words, farmhouse gratitude, cream and brown",
    "grandmas house where cousins become best friends, warm nostalgic illustration, peach and cream",
    "dad the man the myth the legend, retro bold vintage poster typography, navy and white",
  ],
  bedroom: [
    "today is going to be a great day, sunrise illustration morning affirmation, yellow and white",
    "you woke up today that is enough, gentle morning affirmation watercolor, blue and cream",
    "good morning beautiful, bedroom mirror quote elegant script, gold and white",
    "dream big sleep well start again, night sky illustration typography, navy and gold stars",
    "wake up and be awesome, bold morning motivation retro sunrise, orange and yellow",
    "tomorrow is a fresh start, hopeful evening moon illustration, lavender and gold",
    "your story isn't over yet, bedroom encouragement minimal, black and white serif",
    "make today so amazing yesterday gets jealous, morning motivation bold, coral and white",
    "she dreamed she dared she did, feminine empowerment bedroom script, rose gold and white",
    "rise and shine it is your time, motivational sunrise illustration bold, gold and cream",
  ],
  nursery: [
    "you are my sunshine my only sunshine, nursery classic watercolor sun, yellow and white",
    "dream big little one moon and stars, nursery night sky illustration script, navy and gold",
    "be brave be kind be you, children colorful affirmation bold, rainbow pastels",
    "adventure awaits little explorer, nursery map compass illustration, earth tones cream",
    "little one you are so loved, gender neutral nursery script, sage green and cream",
    "born to be curious wild and free, fun children typography animals, colorful playful",
    "twinkle twinkle little star how I wonder what you are, illustrated star nursery, blue and gold",
    "hello little one we have been waiting for you, newborn welcome illustration, blush and cream",
  ],
  boho: [
    "she is wildflower fierce and free, boho watercolor wildflower illustration, terracotta and sage",
    "bloom where you are planted, botanical floral watercolor circle, blush pink and green",
    "grow through what you go through, botanical leaf vine line art, forest green cream",
    "the mountains are calling and I must go, landscape illustration script, navy and white",
    "find me where the wildflowers grow, boho botanical handwritten, dusty pink and sage",
    "earthy vibes only, botanical minimalist leaves, terracotta and cream",
    "wild free like the flowers and the trees, watercolor botanical florals, natural multicolor",
    "let the waves carry your worries away, coastal illustration quote, ocean blue and sandy",
    "rooted in grace blooming in strength, botanical roots illustration, sage and cream gold",
    "go where the good energy flows, boho typography celestial stars, mustard and terracotta",
  ],
  fitness: [
    "stronger than yesterday keep pushing, athletic bold dumbbell graphic typography, black white",
    "train hard rest harder gym humor, bold athletic typography motivational, orange and black",
    "run like someone just called your name, running humor minimalist sneaker, blue and white",
    "your body hears everything your mind says, fitness motivation clean bold, red and white",
    "lifting weights and lifting spirits, gym positivity minimalist barbell, black and gold",
    "earn your rest work hard play hard, athletic motivational bold poster, navy and white",
    "no excuses just results, gym bold typography minimal, black and white stark",
    "strong is the new everything, empowering fitness feminine, rose gold and white",
  ],
  pets: [
    "dog mom best job ever, bold watercolor paw print design warm, brown and cream",
    "crazy cat lady and proud, retro vintage poster typography, charcoal and orange",
    "dogs leave paw prints on your heart, floral dog quote hand-lettered, sage and cream",
    "life is better with a dog, minimal line art dog silhouette, navy and white",
    "golden retriever energy always, watercolor dog illustration warm tones, golden and cream",
    "cats choose you you don't choose them, sarcastic cat wisdom minimal, black and white",
    "my dog is my therapist, mental health humor paw print, pastel blue and white",
    "house trained human pet owner humor, funny pet parent sign, cream and brown farmhouse",
  ],
  teachers: [
    "teaching is a work of heart, chalkboard watercolor apple illustration, green and cream",
    "coffee teach repeat survive, teacher humor minimalist clean, brown and white",
    "shaping the future one student at a time, inspirational teacher quote modern, navy gold",
    "the best teachers spark curiosity, modern quote poster style, teal and white",
    "world's okayest teacher sarcasm, fun hand-lettered school style, red and white",
    "teacher: powered by coffee and good intentions, humor illustration minimal, brown cream",
    "because of a great teacher, appreciation watercolor book florals, blush and sage",
    "teaching kids to think not what to think, modern education quote bold, navy and white",
  ],
};

// Flatten all themes into a single array
const ALL_THEMES = Object.entries(THEMES_BY_CATEGORY).flatMap(([cat, themes]) =>
  themes.map(t => ({ category: cat, theme: t }))
);

async function refreshTokenIfNeeded(
  sb: ReturnType<typeof createClient>,
  tokenRow: Record<string, string>,
  clientId: string
): Promise<string> {
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - 5 * 60 * 1000;
  if (!needsRefresh) return tokenRow.access_token;

  log("Token expiring — refreshing");
  const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: tokenRow.refresh_token,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Token refresh failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const newToken = data.access_token;
  const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  await sb.from("etsy_oauth_tokens").update({
    access_token: newToken,
    refresh_token: data.refresh_token ?? tokenRow.refresh_token,
    expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  }).eq("id", tokenRow.id);

  log("Token refreshed", { expiresAt: newExpiry });
  return newToken;
}

async function generatePrintableImage(
  theme: string,
  variation: number,
  openaiKey: string,
  attempt = 0
): Promise<string> {
  // For maker themes, use technical/reference style; otherwise use wall art style
  const isMakerTheme = theme.includes("OSHA") || theme.includes("forklift") || theme.includes("FIRE EXIT") ||
    theme.includes("PPE") || theme.includes("ELECTRICAL") || theme.includes("FIRST AID") ||
    theme.includes("CNC") || theme.includes("router bit") || theme.includes("joinery") ||
    theme.includes("sandpaper") || theme.includes("drill bit") || theme.includes("wire gauge") ||
    theme.includes("screw and bolt") || theme.includes("mandala") || theme.includes("Celtic knot") ||
    theme.includes("hexagonal") || theme.includes("art deco") || theme.includes("floral mandala") ||
    theme.includes("pegboard") || theme.includes("workshop") || theme.includes("makerspace") ||
    theme.includes("AWG");

  const variationStyles = isMakerTheme ? [
    "portrait 8x10 print, clean technical layout, high contrast, easy to read at a glance",
    "landscape format, organized data layout with clear headings and sections",
    "square format, bold title at top, organized content below, professional reference card style",
  ] : [
    "portrait orientation 8x10 print, centered bold typography, white background",
    "landscape orientation print, two-tone color block background with contrasting text",
    "square format, decorative border with ornamental corner elements, soft pastel background",
  ];
  const style = variationStyles[variation] ?? variationStyles[0];

  const antiGarbleSuffix = attempt === 0
    ? ", no garbled text no foreign characters — clean readable design"
    : attempt === 1
    ? ", absolutely no text of any kind — purely visual colors shapes and composition only"
    : ", ZERO TEXT — only visual elements colors and shapes — completely text-free design";

  const prompt = isMakerTheme
    ? `Printable technical reference graphic: ${theme}. Style: ${style}.
Requirements: high contrast, print-ready, no brand names, no copyrighted content,
clean professional layout suitable for workshop or garage walls, all text highly legible,
organized and useful as a quick-reference guide. No decorative fluff — functional design.${antiGarbleSuffix}`
    : `Printable digital wall art: ${theme}. Style: ${style}.
Requirements: high contrast, print-ready, no brand names, no copyrighted content,
original design suitable for home printing, clean professional layout.
The text must be large and clearly readable. Background should complement the quote.${antiGarbleSuffix}`;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "low", n: 1 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Image gen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned from OpenAI");
  return b64;
}

// Vision check: returns true if the frame contains garbled, non-English, or unreadable text.
// Fails open (returns false) if the check itself errors — never blocks a listing on infra failure.
async function checkHallucination(b64Jpeg: string, openrouterKey: string): Promise<boolean> {
  if (!openrouterKey) return false; // fail open if no key
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
            { type: "image_url", image_url: { url: `data:image/png;base64,${b64Jpeg}` } },
            { type: "text", text: "Does this image contain garbled, unreadable, non-English, foreign-script, or glitchy/corrupted text that appears to be a failed attempt at rendering English words? Answer only YES or NO. Answer NO if the image contains no text at all, or if all text is clearly readable English." },
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

// ── Checklist / Planner theme detection ────────────────────────────────────────
const CHECKLIST_KEYWORDS = [
  "checklist", "planner", "tracker", "routine", "habit", "schedule",
  "journal", "worksheet", "budget", "meal plan", "reading list", "goal",
  "water intake", "to-do", "todo", "task list", "log book", "diary",
];
function isChecklistTheme(theme: string): boolean {
  const lower = theme.toLowerCase();
  return CHECKLIST_KEYWORDS.some((k) => lower.includes(k));
}

// ── Checklist content generation via GPT-4o-mini ──────────────────────────────
interface ChecklistContent {
  title: string;
  subtitle: string;
  items: string[];
  colorBg: string;
  colorText: string;
  colorAccent: string;
}

async function generateChecklistContent(theme: string, _openaiKey: string): Promise<ChecklistContent> {
  const prompt = `Generate content for a printable checklist/planner digital download.
Theme: "${theme}"
Return ONLY valid JSON, no markdown:
{
  "title": "2-4 word title fitting the theme (e.g. 'Morning Routine', 'Weekly Budget')",
  "subtitle": "3-5 word subtitle (e.g. 'Daily Checklist', 'Monthly Tracker')",
  "items": ["6 to 8 specific actionable items, each max 26 characters, plain text only"],
  "colorBg": "#hex light background fitting the theme mood",
  "colorText": "#hex dark readable text color",
  "colorAccent": "#hex accent and border color"
}`;
  try {
    const raw = await generateText(prompt, 400);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]);
      const hexOk = (v: unknown) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
      return {
        title: String(p.title ?? "Daily Checklist").slice(0, 40),
        subtitle: String(p.subtitle ?? "Track Your Progress").slice(0, 40),
        items: (Array.isArray(p.items) ? p.items : []).slice(0, 8).map((i: unknown) => String(i).slice(0, 26)),
        colorBg: hexOk(p.colorBg) ? p.colorBg : "#f8f5f0",
        colorText: hexOk(p.colorText) ? p.colorText : "#2c3e50",
        colorAccent: hexOk(p.colorAccent) ? p.colorAccent : "#5d8a6e",
      };
    }
  } catch { /* fall through to defaults */ }
  return {
    title: "Daily Checklist",
    subtitle: "Track Your Progress",
    items: ["Morning intention", "Drink water", "Exercise 30 min", "Healthy meal", "Read or learn", "Connect with others"],
    colorBg: "#f8f5f0",
    colorText: "#2c3e50",
    colorAccent: "#5d8a6e",
  };
}

// ── SVG builders — programmatic text = 100% legible, no AI hallucination ──────
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildChecklistSVG(content: ChecklistContent, variation: number): string {
  const { title, subtitle, items, colorBg, colorText, colorAccent } = content;
  const W = 2400, H = 3000;
  const T = escapeXml(title);
  const S = escapeXml(subtitle);
  const esc = items.map(escapeXml);

  if (variation === 0) {
    // Serif border style — warm and elegant
    const rows = esc.map((item, i) => {
      const y = 680 + i * 295;
      return `<rect x="210" y="${y}" width="88" height="88" fill="none" stroke="${colorAccent}" stroke-width="6" rx="14"/>`
        + `<text x="372" y="${y + 66}" font-family="sans-serif" font-size="108" fill="${colorText}">${item}</text>`;
    }).join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${colorBg}"/>
<rect x="54" y="54" width="${W - 108}" height="${H - 108}" fill="none" stroke="${colorAccent}" stroke-width="8" rx="28"/>
<rect x="80" y="80" width="${W - 160}" height="${H - 160}" fill="none" stroke="${colorAccent}" stroke-width="2" rx="20" opacity="0.45"/>
<text x="${W / 2}" y="305" text-anchor="middle" font-family="sans-serif" font-size="195" font-weight="bold" fill="${colorText}">${T}</text>
<line x1="280" y1="360" x2="${W - 280}" y2="360" stroke="${colorAccent}" stroke-width="4"/>
<text x="${W / 2}" y="455" text-anchor="middle" font-family="sans-serif" font-size="95" fill="${colorAccent}">${S}</text>
<line x1="280" y1="505" x2="${W - 280}" y2="505" stroke="${colorAccent}" stroke-width="4"/>
${rows}
</svg>`;
  }

  if (variation === 1) {
    // Color block header — modern and bold
    const rows = esc.map((item, i) => {
      const y = 775 + i * 290;
      return `<rect x="148" y="${y - 5}" width="70" height="70" fill="${colorAccent}" opacity="0.18" rx="8"/>`
        + `<text x="154" y="${y + 50}" font-family="sans-serif" font-size="50" fill="${colorAccent}" font-weight="bold">${i + 1}</text>`
        + `<line x1="248" y1="${y + 66}" x2="${W - 148}" y2="${y + 66}" stroke="${colorAccent}" stroke-width="2" opacity="0.25"/>`
        + `<text x="278" y="${y + 58}" font-family="sans-serif" font-size="105" fill="${colorText}">${item}</text>`;
    }).join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${colorBg}"/>
<rect width="${W}" height="650" fill="${colorAccent}"/>
<text x="${W / 2}" y="360" text-anchor="middle" font-family="sans-serif" font-size="200" font-weight="bold" fill="${colorBg}">${T}</text>
<text x="${W / 2}" y="528" text-anchor="middle" font-family="sans-serif" font-size="100" fill="${colorBg}" opacity="0.82">${S}</text>
${rows}
</svg>`;
  }

  // variation 2 — minimal left-bar accent
  const rows = esc.map((item, i) => {
    const y = 740 + i * 295;
    return `<rect x="148" y="${y - 8}" width="8" height="80" fill="${colorAccent}"/>`
      + `<rect x="218" y="${y + 8}" width="72" height="72" fill="none" stroke="${colorAccent}" stroke-width="5" rx="8"/>`
      + `<text x="360" y="${y + 62}" font-family="sans-serif" font-size="105" fill="${colorText}">${item}</text>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${colorBg}"/>
<rect x="0" y="0" width="22" height="${H}" fill="${colorAccent}"/>
<text x="160" y="348" font-family="sans-serif" font-size="200" font-weight="bold" fill="${colorText}">${T}</text>
<text x="160" y="478" font-family="sans-serif" font-size="95" fill="${colorAccent}">${S}</text>
<line x1="160" y1="545" x2="${W - 118}" y2="545" stroke="${colorAccent}" stroke-width="6"/>
${rows}
<rect x="0" y="${H - 100}" width="${W}" height="100" fill="${colorAccent}" opacity="0.12"/>
</svg>`;
}

/** Chunked base64 to avoid stack overflow on large buffers */
function toB64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(binary);
}

async function generateChecklistImages(theme: string, openaiKey: string): Promise<string[]> {
  const content = await generateChecklistContent(theme, openaiKey);
  log("Checklist content generated", { title: content.title, items: content.items.length });
  await ensureResvg();
  const images: string[] = [];
  for (let v = 0; v < 3; v++) {
    const svg = buildChecklistSVG(content, v);
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }); // load system fonts (Ubuntu has DejaVu/Ubuntu fonts)
    const pngData = resvg.render().asPng();
    images.push(toB64(pngData));
    log(`Checklist SVG image ${v + 1}/3 rendered`);
    if (v < 2) await new Promise((r) => setTimeout(r, 200));
  }
  return images;
}

async function createEtsyListing(
  shopId: string, apiKey: string, accessToken: string,
  title: string, description: string, tags: string[],
  overridePriceCents = 0,
): Promise<string> {
  const effectivePrice = (overridePriceCents > 0 ? overridePriceCents : PRICE_CENTS) / 100;
  // Create as draft — we activate after images/files are uploaded
  const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quantity: 999,
      title: title.slice(0, 140),
      description: description.slice(0, 5000),
      price: effectivePrice,
      who_made: "i_did",
      when_made: "made_to_order",
      taxonomy_id: TAXONOMY_ID,
      type: "download",
      tags: tags.slice(0, 13),
      is_digital: true,
      state: "draft",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Etsy listing create ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return String(data.listing_id);
}

async function activateListing(
  shopId: string, listingId: string, apiKey: string, accessToken: string
): Promise<void> {
  const res = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
    {
      method: "PATCH",
      headers: { "x-api-key": apiKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state: "active" }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Etsy listing activate ${res.status}: ${err.slice(0, 300)}`);
  }
}

async function uploadListingImage(
  shopId: string, listingId: string, apiKey: string, accessToken: string,
  b64Image: string, rank: number
): Promise<void> {
  const imageBytes = Uint8Array.from(atob(b64Image), c => c.charCodeAt(0));
  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: "image/png" }), `listing-${rank}.png`);
  formData.append("rank", String(rank));
  formData.append("overwrite", "true");

  const res = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`,
    {
      method: "POST",
      headers: { "x-api-key": apiKey, Authorization: `Bearer ${accessToken}` },
      body: formData,
      signal: AbortSignal.timeout(90_000),
    }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Etsy listing image upload rank ${rank} ${res.status}: ${err.slice(0, 300)}`);
  }
}

async function uploadDigitalFile(
  shopId: string, listingId: string, apiKey: string, accessToken: string,
  b64Image: string, fileName: string, rank: number
): Promise<void> {
  const imageBytes = Uint8Array.from(atob(b64Image), c => c.charCodeAt(0));
  const formData = new FormData();
  formData.append("name", fileName);
  formData.append("file", new Blob([imageBytes], { type: "image/png" }), fileName);
  formData.append("rank", String(rank));

  const res = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
    {
      method: "POST",
      headers: { "x-api-key": apiKey, Authorization: `Bearer ${accessToken}` },
      body: formData,
      signal: AbortSignal.timeout(90_000),
    }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Etsy file upload rank ${rank} ${res.status}: ${err.slice(0, 300)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ETSY_CLIENT_ID = Deno.env.get("ETSY_CLIENT_ID") ?? "";
  // ETSY_API_KEY and ETSY_CLIENT_ID are the same Etsy keystring — fall back so only one secret is needed
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") || ETSY_CLIENT_ID;
  const ETSY_SHARED_SECRET = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
  // Etsy requires x-api-key to be "keystring:shared_secret"
  const ETSY_HEADER_KEY = ETSY_SHARED_SECRET
    ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}`
    : ETSY_API_KEY;
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Audit mode: ?audit=true&offset=N&limit=50&deactivate=true
  // Checks stored listing images for garbled text using Gemini vision.
  // deactivate=true auto-deactivates garbled listings + marks DB inactive.
  const url = new URL(req.url);
  if (url.searchParams.get("audit") === "true") {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    const auditOffset = parseInt(url.searchParams.get("offset") || "0", 10);
    const auditLimit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 50);
    const autoDeactivate = url.searchParams.get("deactivate") === "true";

    // Load Etsy token only if we may need to deactivate
    let auditAccessToken = "";
    let auditShopId = "";
    let auditHeaderKey = "";
    if (autoDeactivate) {
      const { data: tok } = await sb.from("etsy_oauth_tokens").select("*").order("id", { ascending: false }).limit(1).maybeSingle();
      if (tok) {
        auditAccessToken = await refreshTokenIfNeeded(sb, tok, ETSY_API_KEY);
        auditShopId = tok.shop_id as string;
        auditHeaderKey = ETSY_SHARED_SECRET ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}` : ETSY_API_KEY;
      }
    }

    const { data: listings } = await sb.from("etsy_digital_listings")
      .select("etsy_listing_id, title, status")
      .eq("status", "active")
      .range(auditOffset, auditOffset + auditLimit - 1);

    const results: { listing_id: string; title: string; garbled: boolean; deactivated?: boolean; error?: string }[] = [];
    for (const listing of (listings ?? [])) {
      try {
        const { data: imgData } = await sb.storage.from("etsy-product-images").download(`${listing.etsy_listing_id}/v1.png`);
        if (!imgData) {
          results.push({ listing_id: listing.etsy_listing_id, title: listing.title, garbled: false, error: "no image in storage" });
          continue;
        }
        const bytes = new Uint8Array(await imgData.arrayBuffer());
        const b64 = toB64(bytes);
        const garbled = await checkHallucination(b64, OPENROUTER_API_KEY);
        const row: (typeof results)[0] = { listing_id: listing.etsy_listing_id, title: listing.title?.slice(0, 60), garbled };
        if (garbled && autoDeactivate && auditAccessToken) {
          try {
            await fetch(`https://openapi.etsy.com/v3/application/shops/${auditShopId}/listings/${listing.etsy_listing_id}`, {
              method: "PATCH",
              headers: { "x-api-key": auditHeaderKey, Authorization: `Bearer ${auditAccessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ state: "inactive" }),
              signal: AbortSignal.timeout(10_000),
            });
            await sb.from("etsy_digital_listings").update({ status: "inactive" }).eq("etsy_listing_id", listing.etsy_listing_id);
            row.deactivated = true;
            log("Deactivated garbled listing", { listingId: listing.etsy_listing_id });
          } catch (de) {
            row.deactivated = false;
            row.error = `deactivate failed: ${String(de).slice(0, 80)}`;
          }
        }
        results.push(row);
      } catch (e) {
        results.push({ listing_id: listing.etsy_listing_id, title: listing.title?.slice(0, 60), garbled: false, error: String(e).slice(0, 100) });
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    const garbledCount = results.filter((r) => r.garbled).length;
    const nextOffset = (listings ?? []).length === auditLimit ? auditOffset + auditLimit : null;
    return new Response(JSON.stringify({
      ok: true, checked: results.length, garbled_count: garbledCount,
      nextOffset, callNext: nextOffset !== null ? `?audit=true&offset=${nextOffset}&limit=${auditLimit}` : null,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Load + refresh OAuth token ──────────────────────────────────────────────
  const { data: tokenRow, error: tokenErr } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return new Response(
      JSON.stringify({ error: "No Etsy OAuth tokens — complete OAuth flow at /etsy-oauth-start" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let accessToken: string;
  try {
    accessToken = await refreshTokenIfNeeded(sb, tokenRow, ETSY_API_KEY);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const shopId = tokenRow.shop_id as string;
  if (!shopId) {
    return new Response(JSON.stringify({ error: "shop_id missing from token row" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── recreateChecklist mode — regenerate broken checklist listings with SVG ───
  // Body: {"recreateChecklist": true} or {"recreateChecklist": true, "listingIds": [...]}
  // Reads body only for POST requests
  let bodyData: Record<string, unknown> = {};
  if (req.method === "POST") {
    try { bodyData = await req.json(); } catch { /* no body */ }
  }
  if (bodyData.recreateChecklist === true) {
    const hdrs = { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    // Default to the 10 known broken listings; caller can override with listingIds array
    const DEFAULT_BROKEN_IDS = [
      "4510714889","4510715529","4510718156","4510718137","4510718881",
      "4510719333","4510719835","4510721646","4510722212","4510722804",
    ];
    const allTargetIds = Array.isArray(bodyData.listingIds)
      ? (bodyData.listingIds as string[]).map(String)
      : DEFAULT_BROKEN_IDS;
    // Paginate: each listing takes ~20s, limit 5 per call to stay under 150s timeout
    const rcOffset = Number(bodyData.offset ?? 0);
    const rcLimit = Number(bodyData.limit ?? 5);
    const targetIds = allTargetIds.slice(rcOffset, rcOffset + rcLimit);
    const nextOffset = rcOffset + rcLimit < allTargetIds.length ? rcOffset + rcLimit : null;

    const results = [];
    for (const listingId of targetIds) {
      try {
        // 1. Load listing info from DB
        const { data: row } = await sb.from("etsy_digital_listings")
          .select("niche, title").eq("etsy_listing_id", listingId).maybeSingle();
        const theme = (row?.niche as string) ?? "daily planner checklist printable";
        log("Recreating checklist listing", { listingId, theme: theme.slice(0, 50) });

        // 2. Delete existing digital files from Etsy
        const filesRes = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
          { headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) }
        );
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          for (const f of (filesData.results ?? [])) {
            await fetch(
              `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files/${f.listing_file_id}`,
              { method: "DELETE", headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) }
            );
            await new Promise((r) => setTimeout(r, 300));
          }
          log("Deleted old files", { listingId, count: filesData.results?.length ?? 0 });
        }

        // 3. Generate 3 new SVG-based checklist images
        const newImages = await generateChecklistImages(theme, OPENAI_API_KEY);

        // 4. Upload new listing images (overwrite=true replaces at same rank)
        for (let v = 0; v < newImages.length; v++) {
          await uploadListingImage(shopId, listingId, ETSY_HEADER_KEY, accessToken, newImages[v], v + 1);
          await new Promise((r) => setTimeout(r, 800));
        }
        log("New images uploaded", { listingId });

        // 5. Upload new digital files
        const ts = Date.now();
        for (let v = 0; v < newImages.length; v++) {
          const fileName = `checklist-v${v + 1}-${ts}.png`;
          await uploadDigitalFile(shopId, listingId, ETSY_HEADER_KEY, accessToken, newImages[v], fileName, v + 1);
          await new Promise((r) => setTimeout(r, 800));
        }
        log("New digital files uploaded", { listingId });

        // 6. Re-activate listing
        await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`, {
          method: "PATCH", headers: hdrs, body: JSON.stringify({ state: "active" }),
          signal: AbortSignal.timeout(15_000),
        });

        // 7. Update DB
        await sb.from("etsy_digital_listings").update({ status: "active" }).eq("etsy_listing_id", listingId);

        // 8. Save to storage for audit pipeline
        for (let v = 0; v < newImages.length; v++) {
          const imgBytes = Uint8Array.from(atob(newImages[v]), (c) => c.charCodeAt(0));
          await sb.storage.from("etsy-product-images").upload(`${listingId}/v${v + 1}.png`, imgBytes, { contentType: "image/png", upsert: true });
        }

        results.push({ listingId, status: "recreated", theme: theme.slice(0, 60) });
        log("Listing recreated with SVG checklist", { listingId });
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        results.push({ listingId, status: "error", error: String(e).slice(0, 200) });
        log("Error recreating listing", { listingId, error: String(e).slice(0, 100) });
      }
    }
    const recreated = results.filter((r) => r.status === "recreated").length;
    return new Response(JSON.stringify({
      recreated, total: targetIds.length, processedOffset: rcOffset,
      nextOffset, callNext: nextOffset !== null ? `POST {"recreateChecklist":true,"offset":${nextOffset}}` : null,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── repairAll mode — audit every listing + fix garbled ones in-place ────────
  // POST {"repairAll": true, "offset": 0, "limit": 5}
  // Downloads actual Etsy images (or from storage), vision-checks each one,
  // and regenerates any garbled listing WITHOUT changing its active/inactive state.
  if (bodyData.repairAll === true) {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    const raOffset = Number(bodyData.offset ?? 0);
    const raLimit = Math.min(Number(bodyData.limit ?? 5), 10);

    const { data: listings } = await sb.from("etsy_digital_listings")
      .select("etsy_listing_id, title, niche, status")
      .order("id", { ascending: true })
      .range(raOffset, raOffset + raLimit - 1);

    const results: Array<{
      listingId: string; title: string; checked: boolean;
      garbled: boolean; fixed?: boolean; type?: string; error?: string;
    }> = [];
    let garbledCount = 0;
    let fixedCount = 0;

    for (const listing of (listings ?? [])) {
      const listingId = String(listing.etsy_listing_id);
      const theme = String(listing.niche ?? "");
      try {
        // 1. Fetch image — try Supabase storage first, then Etsy listing API
        let imageBytes: Uint8Array | null = null;
        const { data: storedImg } = await sb.storage
          .from("etsy-product-images").download(`${listingId}/v1.png`);
        if (storedImg) {
          imageBytes = new Uint8Array(await storedImg.arrayBuffer());
          log("Image from storage", { listingId });
        } else {
          // Fetch from Etsy images API
          const etsyImgRes = await fetch(
            `https://openapi.etsy.com/v3/application/listings/${listingId}/images`,
            { headers: { "x-api-key": ETSY_HEADER_KEY }, signal: AbortSignal.timeout(15_000) }
          );
          if (etsyImgRes.ok) {
            const etsyImgData = await etsyImgRes.json();
            const imgUrl = (etsyImgData?.results ?? [])[0]?.url_fullxfull
              ?? (etsyImgData?.results ?? [])[0]?.url_570xN;
            if (imgUrl) {
              const imgFetch = await fetch(imgUrl, { signal: AbortSignal.timeout(30_000) });
              if (imgFetch.ok) {
                imageBytes = new Uint8Array(await imgFetch.arrayBuffer());
                log("Image from Etsy API", { listingId });
              }
            }
          }
        }

        if (!imageBytes) {
          results.push({ listingId, title: String(listing.title ?? "").slice(0, 60), checked: false, garbled: false, error: "no image found anywhere" });
          await new Promise(r => setTimeout(r, 300));
          continue;
        }

        // 2. Vision-check for garbled text
        const b64Check = toB64(imageBytes);
        const garbled = await checkHallucination(b64Check, OPENROUTER_API_KEY);

        if (!garbled) {
          results.push({ listingId, title: String(listing.title ?? "").slice(0, 60), checked: true, garbled: false });
          log("Listing OK", { listingId });
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        garbledCount++;
        log("GARBLED — regenerating in-place", { listingId, theme: theme.slice(0, 50) });

        // 3. Regenerate — SVG for checklists, gpt-image-1 for wall art
        const isChecklist = isChecklistTheme(theme);
        let newImages: string[];
        if (isChecklist) {
          newImages = await generateChecklistImages(theme || "daily planner checklist printable", OPENAI_API_KEY);
        } else {
          newImages = [];
          for (let v = 0; v < IMAGES_PER_LISTING; v++) {
            let b64img: string | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              const cand = await generatePrintableImage(theme, v, OPENAI_API_KEY, attempt);
              const isG = await checkHallucination(cand, OPENROUTER_API_KEY);
              if (!isG) { b64img = cand; break; }
              if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
            }
            if (!b64img) b64img = await generatePrintableImage(theme, v, OPENAI_API_KEY, 2);
            newImages.push(b64img!);
            if (v < IMAGES_PER_LISTING - 1) await new Promise(r => setTimeout(r, 1000));
          }
        }

        // 4. Delete old digital files from Etsy
        const filesRes = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
          { headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) }
        );
        if (filesRes.ok) {
          const fd = await filesRes.json();
          for (const f of (fd.results ?? [])) {
            await fetch(
              `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files/${f.listing_file_id}`,
              { method: "DELETE", headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) }
            ).catch(() => {});
            await new Promise(r => setTimeout(r, 300));
          }
          log("Deleted old files", { listingId, count: fd.results?.length ?? 0 });
        }

        // 5. Upload new listing images (rank 1-3, overwrite=true)
        for (let v = 0; v < newImages.length; v++) {
          await uploadListingImage(shopId, listingId, ETSY_HEADER_KEY, accessToken, newImages[v], v + 1);
          await new Promise(r => setTimeout(r, 800));
        }
        log("New images uploaded", { listingId });

        // 6. Upload new digital download files
        const ts2 = Date.now();
        const prefix = isChecklist ? "checklist" : "printable";
        for (let v = 0; v < newImages.length; v++) {
          await uploadDigitalFile(shopId, listingId, ETSY_HEADER_KEY, accessToken, newImages[v], `${prefix}-v${v + 1}-${ts2}.png`, v + 1);
          await new Promise(r => setTimeout(r, 800));
        }
        log("New digital files uploaded", { listingId });

        // 7. Save updated images to storage (overwrites garbled ones)
        for (let v = 0; v < newImages.length; v++) {
          const ib = Uint8Array.from(atob(newImages[v]), c => c.charCodeAt(0));
          await sb.storage.from("etsy-product-images").upload(`${listingId}/v${v + 1}.png`, ib, { contentType: "image/png", upsert: true });
        }

        // NOTE: Listing state NOT changed — stays active/inactive as-is
        fixedCount++;
        results.push({ listingId, title: String(listing.title ?? "").slice(0, 60), checked: true, garbled: true, fixed: true, type: isChecklist ? "checklist" : "wall_art" });
        log("Fixed garbled listing in-place (state unchanged)", { listingId });
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        results.push({ listingId, title: String(listing.title ?? "").slice(0, 60), checked: false, garbled: false, error: String(e).slice(0, 150) });
        log("repairAll error", { listingId, error: String(e).slice(0, 80) });
      }
    }

    const total = listings?.length ?? 0;
    const nextOffset = total === raLimit ? raOffset + raLimit : null;
    return new Response(JSON.stringify({
      ok: true,
      audited: total, garbled: garbledCount, fixed: fixedCount,
      offset: raOffset, limit: raLimit, nextOffset,
      callNext: nextOffset !== null ? `POST {"repairAll":true,"offset":${nextOffset},"limit":${raLimit}}` : null,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Theme selection — ?theme=... overrides random pick; ?count=N sets quantity ─
  const themeOverride = url.searchParams.get("theme") || "";
  const countOverride = parseInt(url.searchParams.get("count") || "0", 10);
  const categoryFilter = url.searchParams.get("category") || "";
  const priceCentsOverride = parseInt(url.searchParams.get("priceCents") || "0", 10);
  // max 4 per run to stay within 150s timeout (each listing ~30s)
  const runCount = countOverride > 0 ? Math.min(countOverride, 4) : LISTINGS_PER_RUN;

  let picks: Array<{ category: string; theme: string }>;

  if (themeOverride) {
    picks = Array.from({ length: runCount }, () => ({ category: "custom", theme: themeOverride }));
  } else {
    const since = new Date(Date.now() - 60 * 86400_000).toISOString();
    const { data: recentRows } = await sb
      .from("etsy_digital_listings")
      .select("niche")
      .gte("created_at", since);

    const recentNiches = new Set((recentRows ?? []).map((r: { niche: string }) => r.niche));
    // If ?category= is specified, restrict pool to that category
    const basePool = categoryFilter
      ? ALL_THEMES.filter(t => t.category === categoryFilter)
      : ALL_THEMES;
    const available = basePool.filter(t => !recentNiches.has(t.theme));
    const pool = available.length >= runCount ? available : (basePool.length > 0 ? basePool : ALL_THEMES);

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    picks = shuffled.slice(0, runCount);
  }

  const created: string[] = [];
  const errors: Array<{ theme: string; error: string }> = [];

  for (const { category, theme } of picks) {
    try {
      log("Starting listing", { category, theme: theme.slice(0, 60) });

      // ── 1. AI-generated SEO metadata ──────────────────────────────────────
      const isMaker = category === "maker";
      const isChecklist = isChecklistTheme(theme);
      const metaPrompt = isMaker
        ? `Write Etsy listing metadata for a printable maker/workshop digital download. Theme: "${theme}".
Return JSON only, no markdown:
{
  "title": "(max 130 chars, keyword-rich, include 'printable', 'instant download', and relevant terms like 'safety poster' or 'reference chart' or 'laser cut art')",
  "description": "(3-4 sentences: what the file is, instant download, print at home, great for workshops/garages/makerspaces/classrooms, no waiting for shipping)",
  "tags": ["13 tags", "each max 20 chars", "no tag over 20 chars", "use terms like: workshop, maker, printable, instant download, safety poster, CNC, laser cut, woodworking, garage decor"]
}`
        : isChecklist
        ? `Write Etsy listing metadata for a printable checklist/planner digital download. Theme: "${theme}".
Return JSON only, no markdown:
{
  "title": "(max 130 chars, include 'printable', 'checklist', 'planner' or 'tracker', 'instant download', '3 designs')",
  "description": "(3-4 sentences: what the checklist is for, 3 design variations included, print at home on letter or A4, instant download, great for personal organization)",
  "tags": ["13 tags", "each max 20 chars", "no tag over 20 chars", "use: printable planner, checklist, habit tracker, daily planner, instant download, printable, organizer, to do list, planner printable"]
}`
        : `Write Etsy listing metadata for a digital printable wall art 3-pack. Theme: "${theme}". Category: ${category}.
Return JSON only, no markdown:
{
  "title": "(max 130 chars, keyword-rich, include 'printable', 'wall art', 'instant download', 'digital print')",
  "description": "(3-4 sentences: describe the design, mention 3 variations included, instant download, print at home on 8x10 or 8.5x11, great gift idea, no waiting for shipping)",
  "tags": ["13 tags", "each max 20 chars", "no tag over 20 chars", "short keywords only"]
}`;

      const metaRaw = await generateText(metaPrompt, 500);
      let title = isMaker
        ? `${theme.slice(0, 80)} | Printable Instant Download`
        : isChecklist
        ? `${theme.slice(0, 80)} Printable 3-Pack | Instant Download`
        : `${theme.slice(0, 80)} Printable Wall Art | Instant Download Digital Print`;
      let description = isMaker
        ? `Instant digital download — print-ready file included! Perfect for workshops, garages, makerspaces, and classrooms. Print at home or at a local print shop. No waiting for shipping — download immediately after purchase.`
        : isChecklist
        ? `Instant digital download — 3 print-ready checklist designs included! Perfect for staying organized and on track. Print at home on standard letter or A4 paper. No waiting for shipping — download immediately after purchase!`
        : `Instant digital download — 3 print-ready variations included! Perfect for ${category} fans. Print at home on 8x10 or 8.5x11 paper for an instant wall art upgrade. No waiting for shipping — download immediately after purchase. Makes a great gift!`;
      let tags: string[] = isChecklist
        ? ["printable planner", "checklist printable", "habit tracker", "daily planner", "instant download", "printable organizer", "to do list", "planner printable", "digital planner", "printable checklist", "productivity", "digital download", "organizer print"]
        : [category, "printable wall art", "instant download", "digital print", "wall decor", "funny quote", "home decor", "gift idea", "printable art", "quote print", "digital download", "wall art print", "funny gift"];

      try {
        const match = metaRaw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.title) title = String(parsed.title).slice(0, 130);
          if (parsed.description) description = String(parsed.description).slice(0, 1000);
          if (Array.isArray(parsed.tags)) tags = parsed.tags.slice(0, 13).map((t: unknown) => String(t).slice(0, 20));
        }
      } catch { /* keep defaults */ }

      // ── 2. Generate 3 image variations ────────────────────────────────────
      log("Generating 3 images", { theme: theme.slice(0, 40), isChecklist: isChecklistTheme(theme) });
      const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
      let images: string[];

      if (isChecklistTheme(theme)) {
        // SVG path: programmatic text rendering — 100% legible, no hallucination possible
        images = await generateChecklistImages(theme, OPENAI_API_KEY);
      } else {
        // gpt-image-1 path for decorative wall art
        images = [];
        for (let v = 0; v < IMAGES_PER_LISTING; v++) {
          let b64: string | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const candidate = await generatePrintableImage(theme, v, OPENAI_API_KEY, attempt);
            const isGarbled = await checkHallucination(candidate, OPENROUTER_API_KEY);
            if (!isGarbled) {
              b64 = candidate;
              if (attempt > 0) log(`Image ${v + 1}/3 passed hallucination check on attempt ${attempt + 1}`);
              break;
            }
            log(`Image ${v + 1}/3 attempt ${attempt + 1} had garbled text — retrying`);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
          }
          if (!b64) {
            // Fail-open only for DECORATIVE art (garbled short text on wall art is acceptable)
            // Fail-CLOSED for checklist themes (handled above via SVG — never reaches here)
            log(`Image ${v + 1}/3 still garbled after 3 attempts — using last attempt (fail-open, decorative)`);
            b64 = await generatePrintableImage(theme, v, OPENAI_API_KEY, 2);
          }
          images.push(b64);
          log(`Image ${v + 1}/3 ready`);
          if (v < IMAGES_PER_LISTING - 1) await new Promise((r) => setTimeout(r, 1500));
        }
      }

      // ── 3. Create Etsy listing ─────────────────────────────────────────────
      const listingId = await createEtsyListing(shopId, ETSY_HEADER_KEY, accessToken, title, description, tags, priceCentsOverride);

      // Save images to Supabase Storage for YouTube Shorts pipeline
      for (let v = 0; v < images.length; v++) {
        const imgBytes = Uint8Array.from(atob(images[v]), c => c.charCodeAt(0));
        await sb.storage
          .from("etsy-product-images")
          .upload(`${listingId}/v${v + 1}.png`, imgBytes, {
            contentType: "image/png",
            upsert: true,
          });
      }
      log("Images saved to storage", { listingId });
      log("Listing created", { listingId, title: title.slice(0, 50) });

      // ── 3b. Upload listing images (thumbnail buyers see in search results) ─
      for (let v = 0; v < images.length; v++) {
        await uploadListingImage(shopId, listingId, ETSY_HEADER_KEY, accessToken, images[v], v + 1);
        log(`Listing image ${v + 1}/3 uploaded`, { listingId });
        await new Promise(r => setTimeout(r, 1000));
      }

      // ── 4. Upload all 3 PNG files as digital downloads ─────────────────────
      const ts = Date.now();
      for (let v = 0; v < images.length; v++) {
        const fileName = `printable-${category}-v${v + 1}-${ts}.png`;
        await uploadDigitalFile(shopId, listingId, ETSY_HEADER_KEY, accessToken, images[v], fileName, v + 1);
        log(`File ${v + 1}/3 uploaded`, { listingId });
        if (v < images.length - 1) await new Promise(r => setTimeout(r, 1000));
      }

      // ── 4c. Activate listing (created as draft; activate after images+files) ─
      await activateListing(shopId, listingId, ETSY_HEADER_KEY, accessToken);
      log("Listing activated", { listingId });

      // ── 5. Record in DB ───────────────────────────────────────────────────
      await sb.from("etsy_digital_listings").insert({
        title: title.slice(0, 200),
        niche: theme.slice(0, 100),
        etsy_listing_id: listingId,
        price_cents: priceCentsOverride > 0 ? priceCentsOverride : PRICE_CENTS,
        status: "active",
      });

      created.push(title.slice(0, 70));
      log("Listing complete", { listingId });

      // Pause between listings to avoid rate limits
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      const msg = String(err);
      log("Error on theme", { theme: theme.slice(0, 50), error: msg });
      errors.push({ theme: theme.slice(0, 60), error: msg });
    }
  }

  log("Run complete", { created: created.length, errors: errors.length });
  return new Response(
    JSON.stringify({ created: created.length, titles: created, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
