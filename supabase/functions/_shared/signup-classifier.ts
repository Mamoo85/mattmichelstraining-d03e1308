// signup-classifier — maps a contractor's actual words to the correct DWA
// sign-up URL. Replaces broad keyword defaults (which were silently routing
// every "send me the link" to /contractor-leads regardless of context).
//
// Returns the chosen product, the URL, a confidence score (0–1), and the
// matched signal so the caller can log/diagnose. If confidence < 0.45 the
// caller should treat the result as ambiguous and ASK before sending a link.

export type SignupProduct =
  | "contractor_leads"
  | "techalert"
  | "fielddesk"
  | "missed_call"
  | "dead_lead_reactivation"
  | "web_design";

export const SIGNUP_URLS: Record<SignupProduct, string> = {
  contractor_leads: "https://detroitwebagent.com/contractor-leads",
  techalert: "https://detroitwebagent.com/hire-alert",
  fielddesk: "https://detroitwebagent.com/field-service",
  missed_call: "https://detroitwebagent.com/missed-call-catch",
  dead_lead_reactivation: "https://detroitwebagent.com/dead-lead-intake",
  web_design: "https://detroitwebagent.com/web-design",
};

export interface ClassifyResult {
  product: SignupProduct;
  url: string;
  confidence: number; // 0–1
  matched: string[]; // the exact phrases that triggered the match
  ambiguous: boolean; // true when confidence < 0.45 OR multiple products tied
  tiedWith?: SignupProduct[];
}

// Phrase rules, weighted. More specific phrases win. Order does not matter —
// we sum weights per product and pick the top score.
//
// Weights:
//   1.0 = unambiguous product name ("techalert", "field desk")
//   0.7 = strong intent phrase ("hire someone", "missed calls")
//   0.4 = soft signal ("crm", "dispatch")
//   0.2 = weak signal (single noun that overlaps with multiple products)
const RULES: Array<{
  product: SignupProduct;
  weight: number;
  pattern: RegExp;
  label: string;
}> = [
  // --- TechAlert (hiring intelligence) ---
  { product: "techalert", weight: 1.0, pattern: /\btech\s*alert\b/i, label: "techalert" },
  { product: "techalert", weight: 1.0, pattern: /\bhire\s*alert\b/i, label: "hire alert" },
  { product: "techalert", weight: 0.8, pattern: /\b(?:need|looking|trying)\s+to\s+hire\b/i, label: "looking to hire" },
  { product: "techalert", weight: 0.8, pattern: /\bhiring\s+(?:a\s+)?(?:tech|electrician|plumber|hvac|nurse|cna|lpn|rn|tradesman|journeyman|apprentice)/i, label: "hiring a tradesperson" },
  { product: "techalert", weight: 0.7, pattern: /\b(?:find|finding|need)\s+(?:a\s+)?(?:tech|techs|workers?|employees?|staff|help)\b/i, label: "find workers" },
  { product: "techalert", weight: 0.7, pattern: /\blicens(?:ed|ing)\s+(?:tech|electrician|plumber|hvac|tradesperson)/i, label: "licensed talent" },
  { product: "techalert", weight: 0.6, pattern: /\brecruit(?:ing|ment|er)?\b/i, label: "recruit" },
  { product: "techalert", weight: 0.5, pattern: /\bcandidate(?:s)?\b/i, label: "candidates" },
  { product: "techalert", weight: 0.5, pattern: /\b(?:job|labor)\s+(?:market|board)\b/i, label: "job market" },
  { product: "techalert", weight: 0.4, pattern: /\bmiosha\b/i, label: "MIOSHA" },

  // --- FieldDesk (field service CRM) ---
  { product: "fielddesk", weight: 1.0, pattern: /\bfield\s*desk\b/i, label: "fielddesk" },
  { product: "fielddesk", weight: 0.9, pattern: /\bfield\s+service\s+(?:crm|software|app)\b/i, label: "field service software" },
  { product: "fielddesk", weight: 0.8, pattern: /\bdispatch(?:ing|er|board)?\b/i, label: "dispatch" },
  { product: "fielddesk", weight: 0.8, pattern: /\b(?:tech|technician)\s+(?:app|tracking|gps)\b/i, label: "tech app/gps" },
  { product: "fielddesk", weight: 0.7, pattern: /\beway[\s-]?crm\b/i, label: "eWay-CRM (replacement)" },
  { product: "fielddesk", weight: 0.7, pattern: /\bfieldservio\b/i, label: "FieldServio (replacement)" },
  { product: "fielddesk", weight: 0.7, pattern: /\bjobber\b/i, label: "Jobber (replacement)" },
  { product: "fielddesk", weight: 0.7, pattern: /\bservice\s*titan\b/i, label: "ServiceTitan (replacement)" },
  { product: "fielddesk", weight: 0.6, pattern: /\bschedul(?:e|ing)\s+(?:my|our|the)?\s*(?:techs?|crews?|jobs?)\b/i, label: "schedule techs" },
  { product: "fielddesk", weight: 0.5, pattern: /\bwork\s+orders?\b/i, label: "work orders" },
  { product: "fielddesk", weight: 0.4, pattern: /\bcrm\b/i, label: "crm" },

  // --- Missed Call Catch ---
  { product: "missed_call", weight: 1.0, pattern: /\bmissed[\s-]?call(?:s)?\b/i, label: "missed calls" },
  { product: "missed_call", weight: 1.0, pattern: /\bmissed\s+call\s+(?:catch|text\s*back)\b/i, label: "missed call catch" },
  { product: "missed_call", weight: 0.9, pattern: /\b(?:miss(?:ing|ed)?|losing)\s+(?:a\s+lot\s+of\s+)?calls?\b/i, label: "missing calls" },
  { product: "missed_call", weight: 0.8, pattern: /\b(?:auto|automatic)[\s-]?text(?:ing|back)?\b/i, label: "auto text-back" },
  { product: "missed_call", weight: 0.7, pattern: /\btext\s*back\b/i, label: "text back" },
  { product: "missed_call", weight: 0.6, pattern: /\bcalls?\s+(?:i|we)\s+miss\b/i, label: "calls I miss" },
  { product: "missed_call", weight: 0.6, pattern: /\bvoicemail\s+(?:replacement|response)\b/i, label: "voicemail response" },

  // --- Dead Lead Reactivation ---
  { product: "dead_lead_reactivation", weight: 1.0, pattern: /\bdead\s*lead(?:s)?\b/i, label: "dead leads" },
  { product: "dead_lead_reactivation", weight: 0.9, pattern: /\bold\s+(?:quotes?|estimates?|leads?)\b/i, label: "old quotes" },
  { product: "dead_lead_reactivation", weight: 0.8, pattern: /\breactivat(?:e|ion|ing)\b/i, label: "reactivate" },
  { product: "dead_lead_reactivation", weight: 0.7, pattern: /\bquotes?\s+(?:that\s+)?(?:never\s+closed|didn'?t\s+close|went\s+cold)\b/i, label: "quotes that never closed" },
  { product: "dead_lead_reactivation", weight: 0.6, pattern: /\bfollow[\s-]?up\s+(?:with\s+)?(?:old|past|cold)\s+(?:customers?|clients?|leads?)\b/i, label: "follow up old leads" },

  // --- Contractor Leads (PPL) ---
  { product: "contractor_leads", weight: 1.0, pattern: /\bcontractor\s*leads\b/i, label: "contractor leads" },
  { product: "contractor_leads", weight: 1.0, pattern: /\bpay\s*per\s*lead\b/i, label: "pay per lead" },
  { product: "contractor_leads", weight: 0.9, pattern: /\bexclusive\s+(?:territory|leads?)\b/i, label: "exclusive territory" },
  { product: "contractor_leads", weight: 0.8, pattern: /\b(?:get|getting|need|want|send)\s+(?:me\s+)?(?:more\s+)?(?:jobs?|customers?|leads?|work)\b/i, label: "get me leads" },
  { product: "contractor_leads", weight: 0.7, pattern: /\bhomeowner(?:s)?\s+(?:request|need|asking)/i, label: "homeowner requests" },
  { product: "contractor_leads", weight: 0.7, pattern: /\b(?:roofing|hvac|plumbing|electrical|electrician)\s+leads?\b/i, label: "trade leads" },
  { product: "contractor_leads", weight: 0.6, pattern: /\b(?:slow|dead)\s+(?:season|month|week)\b/i, label: "slow season" },
  { product: "contractor_leads", weight: 0.5, pattern: /\bterritory\s+lock\b/i, label: "territory lock" },

  // --- Web Design ---
  { product: "web_design", weight: 1.0, pattern: /\bweb(?:site)?\s+design\b/i, label: "web design" },
  { product: "web_design", weight: 0.8, pattern: /\bnew\s+website\b/i, label: "new website" },
  { product: "web_design", weight: 0.7, pattern: /\bbuild\s+(?:me\s+)?(?:a\s+)?(?:site|website|web\s+page)\b/i, label: "build me a site" },
  { product: "web_design", weight: 0.6, pattern: /\bredesign\s+(?:my|our|the)\s+(?:site|website)\b/i, label: "redesign site" },
];

// Generic intent phrases — when present, the contractor wants A link, but
// these alone do NOT pick a product. They just confirm "they're asking."
const SIGNUP_INTENT = /\b(sign\s*up|signup|sign me up|link|get started|how do i (start|join|sign|get)|where do i (sign|start|go)|enroll|register|join|set me up|hook me up)\b/i;

export function wantsSignupLink(text: string): boolean {
  return SIGNUP_INTENT.test(text || "");
}

export function classifySignupProduct(text: string): ClassifyResult {
  const input = (text || "").trim();

  if (!input) {
    return {
      product: "contractor_leads",
      url: SIGNUP_URLS.contractor_leads,
      confidence: 0,
      matched: [],
      ambiguous: true,
    };
  }

  const scores = new Map<SignupProduct, number>();
  const matched = new Map<SignupProduct, string[]>();

  for (const rule of RULES) {
    if (rule.pattern.test(input)) {
      scores.set(rule.product, (scores.get(rule.product) || 0) + rule.weight);
      const arr = matched.get(rule.product) || [];
      arr.push(rule.label);
      matched.set(rule.product, arr);
    }
  }

  if (scores.size === 0) {
    // Nothing matched — ambiguous, refuse to default-route a link.
    return {
      product: "contractor_leads",
      url: SIGNUP_URLS.contractor_leads,
      confidence: 0,
      matched: [],
      ambiguous: true,
    };
  }

  // Sort by score desc
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [topProduct, topScore] = ranked[0];
  const runnerUp = ranked[1];

  // Confidence = top score / (top score + runner-up score), capped at 1.
  // Pure score normalized to a familiar 0–1 scale: ≥1.0 raw → ≥0.7 conf.
  let confidence = Math.min(1, topScore / 1.4);
  const tiedWith: SignupProduct[] = [];

  if (runnerUp) {
    const [secondProduct, secondScore] = runnerUp;
    if (Math.abs(topScore - secondScore) < 0.25) {
      tiedWith.push(secondProduct);
      confidence = Math.min(confidence, 0.4); // force "ambiguous" band
    } else {
      // Penalize when runner-up is close-ish
      confidence *= topScore / (topScore + secondScore);
    }
  }

  const ambiguous = confidence < 0.45 || tiedWith.length > 0;

  return {
    product: topProduct,
    url: SIGNUP_URLS[topProduct],
    confidence: Number(confidence.toFixed(2)),
    matched: matched.get(topProduct) || [],
    ambiguous,
    ...(tiedWith.length ? { tiedWith } : {}),
  };
}
