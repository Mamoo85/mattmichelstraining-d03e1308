// Navigation/UI phrases that get scraped as names from Manta/PHCC/MIOSHA pages
const JUNK_NAME_PATTERNS = [
  /^\s*(go\s+back|uh\s+oh|search|loading|submit|sign\s+in|log\s+in|log\s+out|sign\s+out|next|previous|prev|view\s+all|see\s+all|learn\s+more|read\s+more|coming\s+soon|not\s+found|error|menu|home|homepage|click\s+here|back|continue|skip|cancel|close|accept|decline|verify|confirm)\b/i,
  // Form field labels ("First Name", "Last Name", "Full Name", "Company Name", etc.)
  /^(first|last|full|middle|user|company|business|trade|email|phone|contact|display|account)\s+name$/i,
  // Page/section fragments that begin with an article ("The Michigan", "Our Issues")
  /^(our|your|their|his|her|my|the|a|an|this|that|these|those)\s+/i,
];

// Vocabulary that should never appear as a token in a real human name.
// Scraped page headings ("Building Trades", "Joint Apprenticeship", "Air Rail",
// "Trades Directory", "Sheet Metal Workers") get blocked here.
const NON_NAME_TOKENS = new Set([
  "trades","trade","directory","apprenticeship","apprentice","workers","worker",
  "union","local","council","association","alliance","federation","society",
  "issues","news","blog","article","articles","resources","resource","contact",
  "about","privacy","terms","policy","sitemap","support","help","faq","faqs",
  "department","division","office","bureau","agency","commission","committee",
  "building","buildings","construction","architectural","architecture","engineering",
  "occupational","industrial","mechanical","electrical","plumbing","roofing",
  "hvac","sheet","metal","metals","pipe","piping","welding","carpentry",
  "health","safety","training","education","journeyman","master",
  "rail","road","roads","highway","transit","transport","transportation",
  "joint","central","national","state","county","city","regional",
  "north","south","east","west","northern","southern","eastern","western",
  "michigan","detroit","wayne","oakland","macomb","ohio","indiana","illinois",
  "page","section","chapter","title","header","footer","menu","navigation",
  "search","results","filter","filters","login","logout","signup",
  "service","services","product","products","solution","solutions","industry",
  "industries","business","businesses","company","companies","corporation",
  "incorporated","inc","llc","ltd","corp","group","team","teams",
  "center","centers","centre","institute","university","college","school",
  "professional","professionals","specialist","specialists","technician","technicians",
  "manager","management","director","directors","officer","officers",
]);

const JUNK_CHARS = /[?:!@#$%/\[\]{}|<>]/;
const URL_PATTERN = /(https?:\/\/|www\.|\.com|\.org|@)/i;

export function isPlausibleHumanName(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 5 || trimmed.length > 60) return false;
  if (JUNK_CHARS.test(trimmed)) return false;
  if (URL_PATTERN.test(trimmed)) return false;
  for (const pat of JUNK_NAME_PATTERNS) {
    if (pat.test(trimmed)) return false;
  }
  const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length < 2 || tokens.length > 5) return false;
  if (tokens.some(t => t.length < 2)) return false;
  for (const t of tokens) {
    // Each token must be alphabetic (allow apostrophes, hyphens, periods for initials)
    if (!/^[A-Za-z][A-Za-z'’\-\.]*$/.test(t)) return false;
    // Reject all-caps tokens longer than 3 chars (likely acronyms / page headers)
    if (t.length > 3 && t === t.toUpperCase()) return false;
  }
  // First token must be capitalized — real first names always are
  if (!/^[A-Z]/.test(tokens[0])) return false;
  // Reject if ANY token is a known non-name vocabulary word
  const lowerTokens = tokens.map(t => t.toLowerCase().replace(/[.'’\-]/g, ""));
  if (lowerTokens.some(t => NON_NAME_TOKENS.has(t))) return false;
  return true;
}

export function hasMinimalSignal(candidate: Partial<Record<string, unknown>>): boolean {
  const fields = ["current_employer", "current_title", "city", "phone", "email", "linkedin_url"];
  return fields.some(f => {
    const v = candidate[f];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
}

/**
 * Black Box sanitization — strips all source attribution from candidate
 * records before returning them to agency clients.
 *
 * NEVER expose: source, npi_*, pdl_*, raw URLs, license numbers, scraping
 * methodology, AI provider names, or anything that reveals data origin.
 *
 * Agencies see only the curated, branded fields below.
 */

export interface SanitizedCandidate {
  verification_id: string;        // opaque hash, not the real ID
  name: string;
  licensed_role: string;
  county: string;
  signal_strength: "exceptional" | "strong" | "moderate";  // color label, not numeric score
  availability_window: string;    // "Active now" | "This week" | "30-day window"
  pitch_summary?: string;         // Opus-generated, scrubbed of source mentions
}

const FORBIDDEN_TERMS = [
  /lara/gi, /miosha/gi, /bpl/gi, /apollo/gi, /pdl/gi, /people\s*data\s*labs/gi,
  /sonar/gi, /perplexity/gi, /nursys/gi, /\bnpi\b/gi, /scrap(e|ing|er)/gi,
  /\bai\b/gi, /claude/gi, /gemini/gi, /opus/gi, /haiku/gi, /openrouter/gi,
  /linkedin/gi, /indeed/gi, /state\s*registry/gi, /license\s*database/gi,
  /firecrawl/gi, /lusha/gi, /clay/gi, /snov/gi, /hunter/gi,
];

export function scrubText(text: string | null | undefined): string {
  if (!text) return "";
  let out = text;
  for (const re of FORBIDDEN_TERMS) out = out.replace(re, "our intelligence engine");
  return out.replace(/\s+/g, " ").trim();
}

function opaqueId(realId: string): string {
  // Deterministic short hash — agencies can reference it, but it doesn't leak the UUID
  let h = 0;
  for (let i = 0; i < realId.length; i++) h = ((h << 5) - h + realId.charCodeAt(i)) | 0;
  return "VID-" + Math.abs(h).toString(36).toUpperCase().padStart(8, "0").slice(0, 8);
}

function scoreToLabel(score: number | null | undefined): SanitizedCandidate["signal_strength"] {
  const s = score ?? 0;
  if (s >= 8) return "exceptional";
  if (s >= 6) return "strong";
  return "moderate";
}

function inferAvailabilityWindow(candidate: any): string {
  const created = candidate.created_at ? new Date(candidate.created_at) : null;
  if (!created) return "30-day window";
  const ageDays = (Date.now() - created.getTime()) / 86_400_000;
  if (ageDays < 2) return "Active now";
  if (ageDays < 7) return "This week";
  return "30-day window";
}

export function sanitizeCandidate(raw: any): SanitizedCandidate {
  return {
    verification_id: opaqueId(raw.id || ""),
    name: raw.name || "Verified Candidate",
    licensed_role: scrubText(raw.role || raw.licensed_role || "Skilled Trade Professional"),
    county: raw.county || raw.location || "Metro Detroit",
    signal_strength: scoreToLabel(raw.score),
    availability_window: inferAvailabilityWindow(raw),
    pitch_summary: raw.pitch_summary ? scrubText(raw.pitch_summary) : undefined,
  };
}

export function sanitizeBatch(rawList: any[]): SanitizedCandidate[] {
  return (rawList || []).map(sanitizeCandidate);
}
