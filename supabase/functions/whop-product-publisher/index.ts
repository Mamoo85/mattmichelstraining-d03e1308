// whop-product-publisher — Whop marketplace autonomous publisher
//
// Runs DAILY (2pm UTC) via cron. Publishes up to 3 products per run.
// 50-product store fills in ~17 days. After that, refreshes oldest products.
// Cross-posts to Gumroad at 80% price (non-blocking, non-fatal).
//
// Every product ships with:
//   - AI-generated cover image (gpt-image-1, 1024x1024)
//   - PDF content uploaded to Supabase Storage (public download link in description)
//   - DWA AI Tools branding throughout
//
// SETUP (one-time, ~10 min):
//   1. Create account at whop.com/sell
//   2. Get API key: whop.com/settings/developer → Generate Key
//   3. Set secret: WHOP_API_KEY
//   4. Set secret: WHOP_COMPANY_ID (from company settings URL)
//   5. Run whop-store-setup once to set banner, logo, and bio

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WHOP_KEY      = Deno.env.get("WHOP_API_KEY") || "";
const WHOP_COMPANY  = Deno.env.get("WHOP_COMPANY_ID") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") || "";
const GUMROAD_TOKEN = Deno.env.get("GUMROAD_ACCESS_TOKEN") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";
const LAUNCH_PRICE_CENTS = 499; // $4.99 launch price — raise once reviews come in

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[WHOP] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 3000): Promise<string> {
  for (const cfg of [
    { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_KEY,
      body: (p: string, t: number) => ({ model: "google/gemini-2.5-flash", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" } },
    { url: "https://api.anthropic.com/v1/messages", key: ANTHROPIC_KEY,
      body: (p: string, t: number) => ({ model: "claude-haiku-4-5-20251001", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } },
    { url: "https://api.openai.com/v1/chat/completions", key: OPENAI_KEY,
      body: (p: string, t: number) => ({ model: "gpt-4o-mini", max_completion_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" } },
  ]) {
    if (!cfg.key) continue;
    try {
      const r = await fetch(cfg.url, { method: "POST", headers: cfg.headers, body: JSON.stringify(cfg.body(prompt, maxTokens)), signal: AbortSignal.timeout(35_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

type ProductType = "prompt_library" | "template_pack" | "script_pack" | "playbook" | "sop_bundle";
type WhopNiche = { niche: string; title: string; price: number; type: ProductType };

// 50 products ranked by expected sales on Whop
// Whop audience: tech entrepreneurs, SMMA owners, AI early adopters, side hustlers, creators
const WHOP_NICHES: WhopNiche[] = [
  // TIER 1 — Highest Demand (AI + outreach + content creation)
  { niche: "cold outreach AI",       title: "Cold Email & DM Domination: 500 AI-Powered Outreach Templates",            price: 1997, type: "script_pack"    },
  { niche: "viral hooks AI",         title: "Hook Master Library: 500 Viral Hooks for TikTok, YouTube & Instagram",     price: 1497, type: "prompt_library"  },
  { niche: "AI copywriting",         title: "Copywriter's AI Command Center: Landing Pages, Ads & Email Sequences",     price: 1997, type: "prompt_library"  },
  { niche: "dropshipping AI",        title: "Dropshipping AI Toolkit: Product Research, Listings & Ad Copy System",     price: 1997, type: "prompt_library"  },
  { niche: "LinkedIn growth",        title: "LinkedIn Domination Pack: 300 Connection Requests, Posts & DM Scripts",    price: 1797, type: "script_pack"    },
  { niche: "newsletter AI",          title: "Newsletter Writer's AI System: Hooks, Issues & Growth Scripts",            price: 1497, type: "prompt_library"  },
  { niche: "e-commerce copy",        title: "E-Commerce Copy Machine: 500 Product Descriptions, Ads & Email Templates", price: 1497, type: "template_pack"  },
  { niche: "YouTube AI",             title: "YouTube Channel Builder AI Pack: Scripts, Titles & Thumbnail Briefs",      price: 1797, type: "prompt_library"  },
  { niche: "SEO content AI",         title: "SEO Content Machine: 200 Blog Post Frameworks & Writing Prompts",          price: 1497, type: "prompt_library"  },
  { niche: "side hustle AI",         title: "AI Side Hustle Blueprint: 50 Business Ideas with Full Launch Playbooks",   price: 2497, type: "playbook"       },
  // TIER 2 — Strong Demand
  { niche: "etsy seller AI",         title: "Etsy Seller AI Toolkit: Listings, SEO & Marketing Scripts",                price: 1497, type: "prompt_library"  },
  { niche: "amazon FBA AI",          title: "Amazon FBA AI Pack: Product Research, Listings & PPC Copy Templates",      price: 1797, type: "template_pack"  },
  { niche: "TikTok shop AI",         title: "TikTok Shop Seller System: Product Hooks, Copy & Viral Caption Pack",      price: 1497, type: "script_pack"    },
  { niche: "SMMA AI tools",          title: "Social Media Agency AI Pack: 90-Day Client Content System for Any Niche",  price: 1997, type: "prompt_library"  },
  { niche: "freelancer AI",          title: "Freelancer Client Acquisition System: DMs, Proposals & Scripts",           price: 1797, type: "template_pack"  },
  { niche: "ChatGPT mastery",        title: "ChatGPT Business Mastery: Advanced Prompt Engineering for Entrepreneurs",  price: 1997, type: "playbook"       },
  { niche: "ghostwriting AI",        title: "AI Ghostwriter's Arsenal: Twitter/X Threads, LinkedIn & Newsletter Templates", price: 1797, type: "prompt_library" },
  { niche: "digital product AI",     title: "Digital Product Creator AI Pack: Research, Creation & Marketing System",   price: 1797, type: "prompt_library"  },
  { niche: "faceless YouTube",       title: "Faceless YouTube Blueprint: AI Scripts, Research & Monetization System",   price: 2497, type: "playbook"       },
  { niche: "personal brand AI",      title: "Personal Brand AI Accelerator: Bio, Strategy & Content Templates",         price: 1497, type: "template_pack"  },
  // TIER 3 — Good Demand
  { niche: "real estate investor AI",title: "Real Estate Investor AI Toolkit: Deal Analysis, Outreach & Marketing",     price: 1997, type: "prompt_library"  },
  { niche: "mortgage broker AI",     title: "Mortgage Broker AI Lead Machine: Scripts, Content & Follow-Up System",     price: 1797, type: "script_pack"    },
  { niche: "insurance agent AI",     title: "Insurance Agent AI Marketing Pack: Prospecting, Social & Email Scripts",    price: 1497, type: "script_pack"    },
  { niche: "financial advisor AI",   title: "Financial Advisor Content System: Newsletter, Social & Prospecting Pack",  price: 1797, type: "prompt_library"  },
  { niche: "podcast creator AI",     title: "Podcast Creator AI Toolkit: Show Notes, Episode Titles & Guest Outreach",  price: 1497, type: "template_pack"  },
  { niche: "online course AI",       title: "Online Course Creator AI Pack: Curriculum Design, Scripts & Sales Copy",   price: 1997, type: "playbook"       },
  { niche: "affiliate marketing AI", title: "Affiliate Marketer AI System: Content, Email & Promotion Playbook",        price: 1797, type: "prompt_library"  },
  { niche: "contractor marketing AI",title: "Contractor AI Marketing Machine: Leads, Estimates & Follow-Up Scripts",    price: 1497, type: "script_pack"    },
  { niche: "restaurant AI",          title: "Restaurant AI Marketing Pack: Menu Copy, Social Media & Review Scripts",   price: 1497, type: "template_pack"  },
  { niche: "PR media AI",            title: "PR & Media Outreach AI Pack: Press Releases, Pitches & Media List Scripts",price: 1797, type: "script_pack"    },
  // TIER 4 — Premium Niche
  { niche: "SaaS B2B sales AI",      title: "SaaS Cold Outreach Engine: 200 Email Sequences for B2B Software Sales",    price: 2497, type: "script_pack"    },
  { niche: "grant writing AI",       title: "Grant Writing AI Toolkit: Templates, Narratives & Application Scripts",    price: 2497, type: "template_pack"  },
  { niche: "legal marketing AI",     title: "Law Firm AI Marketing Pack: Client Outreach, Content & Lead Scripts",      price: 1797, type: "prompt_library"  },
  { niche: "healthcare marketing AI",title: "Healthcare Practice AI Pack: Patient Education & Marketing System",        price: 1797, type: "prompt_library"  },
  { niche: "e-learning AI",          title: "E-Learning Platform Builder Pack: Course Frameworks & Marketing System",   price: 1997, type: "playbook"       },
  { niche: "print on demand AI",     title: "Print-on-Demand AI System: Design Briefs, Listing Copy & Marketing",      price: 1497, type: "template_pack"  },
  { niche: "airbnb host AI",         title: "Airbnb Host AI Toolkit: Listings, Guest Message Scripts & Review System",  price: 1797, type: "template_pack"  },
  { niche: "consulting AI",          title: "Consulting Firm AI Pack: Proposals, Frameworks & Client Delivery Scripts", price: 2497, type: "template_pack"  },
  { niche: "job search AI",          title: "AI Job Search System: Cover Letters, LinkedIn Optimization & Interview Prep", price: 1497, type: "template_pack" },
  { niche: "startup pitch AI",       title: "Startup Investor Pitch AI Pack: Decks, Narratives & Outreach Templates",  price: 2497, type: "playbook"       },
  // TIER 5 — Solid Niche
  { niche: "fitness coach AI",       title: "Fitness Coach AI Business Pack: Programs, Sales Scripts & Content System", price: 1797, type: "prompt_library"  },
  { niche: "wedding business AI",    title: "Wedding & Events AI Pack: Proposals, Marketing & Client Scripts",          price: 1497, type: "template_pack"  },
  { niche: "local SEO AI",           title: "Local Business SEO Domination Pack: Content, Citations & Review System",   price: 1797, type: "prompt_library"  },
  { niche: "app marketing AI",       title: "App Developer Marketing Pack: ASO, Email & User Acquisition Scripts",      price: 1797, type: "prompt_library"  },
  { niche: "recruiting AI",          title: "Recruiting & HR AI Toolkit: Job Posts, Outreach & Interview Scripts",      price: 1797, type: "template_pack"  },
  { niche: "non-profit AI",          title: "Non-Profit Grant & Fundraising AI Pack: Appeals, Grants & Donor Scripts",  price: 1797, type: "template_pack"  },
  { niche: "fashion brand AI",       title: "Fashion & Lifestyle Brand AI Pack: Product Copy, Social & Email System",   price: 1497, type: "prompt_library"  },
  { niche: "crypto community AI",    title: "Web3 Community Builder Pack: Discord Scripts, Announcements & Marketing",  price: 1497, type: "script_pack"    },
  { niche: "ecommerce brand AI",     title: "E-Commerce Brand Building System: Voice, Stories & Marketing Templates",   price: 1797, type: "playbook"       },
  { niche: "AI automation master",   title: "AI Business Automation Master Pack: Systems, Workflows & Full Playbooks",  price: 2997, type: "playbook"       },
];

async function pickNiche(): Promise<{ niche: WhopNiche; existingTitles: string[] }> {
  const { data: existing } = await sb.from("whop_products" as any)
    .select("title, niche, created_at").limit(60)
    .order("created_at", { ascending: true });

  const publishedNiches = new Set((existing || []).map((e: any) => e.niche).filter(Boolean));
  const existingTitles = (existing || []).map((e: any) => e.title);

  const unpublished = WHOP_NICHES.find(n => !publishedNiches.has(n.niche));
  if (unpublished) return { niche: unpublished, existingTitles };

  const oldestNicheStr = (existing || [])[0]?.niche as string | undefined;
  const refreshNiche = WHOP_NICHES.find(n => n.niche === oldestNicheStr) ?? WHOP_NICHES[0];
  return { niche: refreshNiche, existingTitles };
}

// ── Content generators ─────────────────────────────────────────────────────────

async function generatePromptLibrary(niche: WhopNiche): Promise<string> {
  return ai(`Create a premium AI prompt library for Whop marketplace.

Niche: ${niche.niche}
Title: "${niche.title}"

Whop buyers are sophisticated and tech-savvy. Deliver a COMPLETE, ready-to-use prompt library:

## SECTION 1: CORE WORKFLOW PROMPTS (50 prompts)
Daily-use prompts for ${niche.niche}. Format each:
### [Prompt Name]
[Full prompt text with [VARIABLE] fields where buyers customize]

## SECTION 2: ADVANCED POWER PROMPTS (40 prompts)
Multi-step, complex prompts for experienced users. Chain prompts together for bigger results.

## SECTION 3: AUTOMATION CHAINS (20 sequences)
3-to-5-step prompt sequences that automate complete end-to-end workflows in ${niche.niche}

## SECTION 4: PROMPT ENGINEERING GUIDE
10 techniques for customizing and improving any prompt in this library for your specific situation

## SECTION 5: REAL RESULTS EXAMPLES
10 example AI outputs demonstrating what these prompts produce (actual example text, not descriptions)

Write actual prompt text throughout — not descriptions of prompts.`, 5000);
}

async function generateTemplatePack(niche: WhopNiche): Promise<string> {
  return ai(`Create a professional template pack for ${niche.niche} professionals on Whop.

Title: "${niche.title}"

Deliver 10 complete, ready-to-use templates. Each must be fully written with real professional language — not skeleton outlines. Use [PLACEHOLDER] only for variable data (names, dates, dollar amounts, company names).

## TEMPLATE 1: Primary Outreach / Introduction Template
[Complete email or message template — full professional language throughout, ~300 words]

## TEMPLATE 2: Proposal Template
[Complete proposal with: executive summary, scope, deliverables, timeline, investment table, terms, signature block]

## TEMPLATE 3: Service Agreement / Contract
[Complete legal-style contract with parties, services, payment terms, IP clause, termination, liability limitation]

## TEMPLATE 4: 3-Email Follow-Up Sequence
Email 1 (Day 2): [Complete email]
Email 2 (Day 5): [Complete email]
Email 3 (Day 10): [Complete email]

## TEMPLATE 5: Status Report / Deliverables Template
[Complete professional document structure with all sections]

## TEMPLATE 6: Client Onboarding Checklist & Welcome Template
[Complete onboarding document + welcome message]

## TEMPLATE 7: Social Media Content Framework (30-day plan structure)
[Complete calendar structure with 10 sample posts written out]

## TEMPLATE 8: Sales Page / Landing Page Copy Template
[Full copywriting template: headline, subheadline, pain points, features, benefits, testimonials, CTA]

## TEMPLATE 9: Case Study / Testimonial Request Template
[Complete story framework + email to request testimonials]

## TEMPLATE 10: Invoice / Pricing Sheet Template
[Professional invoice with all standard fields + payment instructions]

Adapt every template to the specific language, scenarios, and context of ${niche.niche}.`, 5000);
}

async function generateScriptPack(niche: WhopNiche): Promise<string> {
  return ai(`Create a complete word-for-word script pack for ${niche.niche} on Whop.

Title: "${niche.title}"

Deliver 25 complete, word-for-word scripts. Write every word of every script. Use [NAME], [COMPANY], [PRODUCT] style variables only for personalization — all other words are written out.

## COLD OUTREACH SCRIPTS (8 scripts)

### Script 1: LinkedIn DM — Pain-Point Open
[Full 80-120 word message]

### Script 2: Cold Email — Credibility Lead
Subject: [Subject line]
[Full email body, 150-200 words]

### Script 3: Instagram/Twitter DM — Compliment + Value
[Full message]

### Scripts 4-8: [Label each scenario — vary platform and angle]
[Each complete, 80-150 words]

## FOLLOW-UP SEQUENCES (7 sequences — 3 touches each)

### Sequence 1: No-Response Follow-Up
Touch 1 (Day 2): [Full message — 50-80 words, acknowledge they're busy]
Touch 2 (Day 6): [Full message — add new value or angle]
Touch 3 (Day 12): [Full message — soft close or breakup email]

### Sequences 2-7: [Label each scenario — vary context and goal]
[Each with all 3 complete touches]

## OBJECTION HANDLER SCRIPTS (5 scripts)

### Objection 1: "[Most common objection verbatim]"
Response: [Full 60-100 word word-for-word response]

### Objections 2-5: [Next 4 most common objections in ${niche.niche}]
[Each with full response script]

## CLOSING SCRIPTS (5 scripts)

### Close 1: Soft Close (trial close)
[Full script]

### Close 2: Direct Ask Close
[Full script]

### Close 3: Urgency / Scarcity Close
[Full script]

### Close 4: Risk-Reversal Close
[Full script]

### Close 5: Referral Ask (post-sale)
[Full script]

Use real ${niche.niche} industry language throughout. No generic placeholder conversations.`, 5000);
}

async function generatePlaybook(niche: WhopNiche): Promise<string> {
  return ai(`Create a complete strategic playbook for ${niche.niche} on Whop.

Title: "${niche.title}"

Deliver a comprehensive, immediately actionable 90-day playbook:

# EXECUTIVE SUMMARY
Who this is for, what problem it solves, what measurable outcomes to expect at 30/60/90 days (250 words)

# PHASE 1: FOUNDATION (Days 1-30)

## Framework 1: [Core Foundation System Name]
Purpose: [What this achieves]
Step-by-step process — 12+ specific, immediately actionable steps with exact tools to use:
1. [Specific action — exact platform, tool, or resource to use]
2. [Next step with specific details]
...through step 12+

## Framework 2: [Second Core System Name]
[Same depth: purpose + 12+ specific steps]

## Phase 1 Master Checklist
□ [20 specific action checkboxes — one concrete action per item]

## Phase 1 Recommended Tools & Resources
[10 specific tools/resources with exactly how and when to use each]

# PHASE 2: GROWTH ENGINE (Days 31-60)

## Framework 3: [Growth Acceleration System]
[Purpose + 12+ steps]

## Framework 4: [Optimization System]
[Purpose + 12+ steps]

## Phase 2 Master Checklist
□ [20 specific checkboxes]

# PHASE 3: SCALE & SYSTEMIZE (Days 61-90)

## Framework 5: [Scaling System]
[Purpose + 12+ steps]

## Phase 3 Master Checklist
□ [20 specific checkboxes]

# ADVANCED TACTICS (Top 1% Moves)
10 specific things the best practitioners in ${niche.niche} do that most people miss

# METRICS & KPIs DASHBOARD
15 KPIs to track with: what to measure, what "good" looks like, how to interpret the numbers

# COMPLETE 90-DAY ACTION LIST
All 60 actions across all phases in weekly sequence — ready to drop into a project manager

Write with authority and specificity. Every step actionable without prior knowledge.`, 5000);
}

async function generateSopBundle(niche: WhopNiche): Promise<string> {
  return ai(`Create a complete Standard Operating Procedure bundle for ${niche.niche} on Whop.

Title: "${niche.title}"

Deliver 10 detailed SOPs — written so completely that someone with zero prior ${niche.niche} experience can follow them:

## SOP 1: [Most Critical Daily/Weekly Process]
**Purpose:** [What this achieves and why it matters]
**Frequency:** [When to run this]
**Time Required:** [Realistic estimate]
**Owner:** [Role responsible]
**Prerequisites:** [What must be in place before starting]

### Step-by-Step Process:
1. [Specific action with exact tool/platform — include where to click, what to type]
2. [Next step with full specifics]
...continue to 15-20 numbered steps

### Quality Checklist:
□ [10+ verification checkboxes to confirm each SOP run was successful]

### Common Mistakes & Fixes:
- [Specific mistake]: [Exact fix]
...5 mistake/fix pairs

---

[Repeat this full structure for SOPs 2-10, covering the 9 next most important recurring processes in ${niche.niche}]

Every SOP must be specific to ${niche.niche} with real process language — no generic templates.`, 5000);
}

async function generateContent(niche: WhopNiche): Promise<string> {
  switch (niche.type) {
    case "template_pack": return generateTemplatePack(niche);
    case "script_pack":   return generateScriptPack(niche);
    case "playbook":      return generatePlaybook(niche);
    case "sop_bundle":    return generateSopBundle(niche);
    default:              return generatePromptLibrary(niche);
  }
}

async function generateDescription(niche: WhopNiche): Promise<string> {
  const typeLabel = { prompt_library: "prompt library", template_pack: "template pack", script_pack: "script pack", playbook: "playbook", sop_bundle: "SOP bundle" }[niche.type] ?? "resource pack";
  return ai(`Write a Whop marketplace product description for: "${niche.title}"
Type: ${typeLabel} · Niche: ${niche.niche}

Whop buyers: tech entrepreneurs, agency owners, AI early adopters, side hustlers.
They want immediate ROI, zero fluff, specific results.

Write exactly 4 short paragraphs separated by blank lines. Plain text only — no markdown, no bullet symbols, no asterisks, no dashes, no headers.

Paragraph 1: Who this is for and the exact pain it eliminates. Name the specific frustration.
Paragraph 2: What is inside — use real numbers ("500 templates", "25 word-for-word scripts", "90-day playbook").
Paragraph 3: What they will accomplish in their first week with this.
Paragraph 4: Why this beats free content — one specific, honest reason.

Max 200 words total. Short sentences. No hype words. No exclamation marks.`, 350);
}

// ── Image generation & storage ─────────────────────────────────────────────────

async function generateCoverImage(title: string): Promise<string | null> {
  if (!OPENAI_KEY) return null;
  try {
    const prompt = `Professional digital product cover image for DWA AI Tools. Product: "${title.slice(0, 80)}". Dark deep background (#0d0d14), vivid electric purple accent (#5b1ae8), abstract AI visualization (glowing neural network nodes, flowing data streams, circuit patterns), bold clean minimal composition, small "DWA AI Tools" text in bottom-right corner. No human faces. No large text in the center — leave clear space. Premium 1:1 square format, ultra high contrast, digital marketplace ready.`;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", n: 1 }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) { log("Cover gen failed (non-fatal)", res.status); return null; }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;

    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    try { await sb.storage.createBucket("whop-product-covers", { public: true }); } catch { }

    const slug = title.slice(0, 40).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const filePath = `${Date.now()}-${slug}.png`;
    const { error } = await sb.storage.from("whop-product-covers")
      .upload(filePath, new Blob([bytes], { type: "image/png" }), { contentType: "image/png", upsert: false });

    if (error) { log("Cover upload failed (non-fatal)", error.message); return null; }
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/whop-product-covers/${filePath}`;
    log("Cover image generated", { sizeKb: Math.round(bytes.length / 1024), url: publicUrl.slice(-40) });
    return publicUrl;
  } catch (e) {
    log("Cover image error (non-fatal)", String(e).slice(0, 100));
    return null;
  }
}

async function uploadPdfToStorage(pdfBytes: Uint8Array, title: string): Promise<string> {
  try { await sb.storage.createBucket("whop-product-files", { public: true }); } catch { }
  const slug = title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const filePath = `${Date.now()}-${slug}.pdf`;
  const { error } = await sb.storage.from("whop-product-files")
    .upload(filePath, new Blob([pdfBytes], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`PDF storage upload failed: ${error.message}`);
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/whop-product-files/${filePath}`;
  log("PDF uploaded to storage", { sizeKb: Math.round(pdfBytes.length / 1024) });
  return publicUrl;
}

// ── PDF builder ────────────────────────────────────────────────────────────────

async function buildPDF(title: string, content: string): Promise<Uint8Array> {
  // Standard Helvetica only supports Latin-1; strip emoji/Unicode beyond \xFF
  const sanitize = (s: string) => s.replace(/[^\x00-\xFF]/g, "");
  title   = sanitize(title);
  content = sanitize(content);

  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const W = 612, H = 792, M = 52, CW = W - M * 2;
  const accent = rgb(0.36, 0.12, 0.86);
  const dark   = rgb(0.05, 0.05, 0.08);

  // Cover page
  const cover = pdfDoc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: dark });
  cover.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: accent });
  cover.drawRectangle({ x: 0, y: 0, width: W, height: 5, color: accent });
  cover.drawRectangle({ x: M - 16, y: H / 2 - 60, width: 4, height: 120, color: accent });

  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (boldFont.widthOfTextAtSize(t, 20) > CW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const titleY = H / 2 + lines.length * 13;
  lines.forEach((l, i) => cover.drawText(l, { x: M, y: titleY - i * 28, size: 20, font: boldFont, color: rgb(1, 1, 1) }));
  cover.drawText("DWA AI Tools · whop.com", { x: M, y: M + 14, size: 9, font: regFont, color: rgb(0.5, 0.4, 0.8) });
  cover.drawText(`© ${new Date().getFullYear()} · All rights reserved`, { x: M, y: M, size: 9, font: regFont, color: rgb(0.35, 0.4, 0.5) });

  // Content pages
  const paras = content.split("\n").filter(l => l.trim());
  let page = pdfDoc.addPage([W, H]);
  let y = H - M;
  for (const para of paras) {
    const isH1 = para.startsWith("# ") && !para.startsWith("## ");
    const isH2 = para.startsWith("## ");
    const isH3 = para.startsWith("### ");
    const isBullet = para.trim().startsWith("- ") || para.trim().startsWith("* ");
    const text = para.replace(/^#{1,3}\s*/, "").replace(/^[-*]\s*/, "").replace(/^\[.\]\s*/, "").trim();
    if (!text) continue;
    const font  = (isH1 || isH2 || isH3) ? boldFont : regFont;
    const size  = isH1 ? 14 : isH2 ? 12 : isH3 ? 10 : 9;
    const color = isH1 ? accent : isH2 ? accent : isH3 ? rgb(0.2, 0.2, 0.4) : rgb(0.12, 0.12, 0.2);
    const indent = isBullet ? M + 12 : M;
    const maxW   = CW - (isBullet ? 12 : 0);
    const wwords = text.split(" ");
    const wrapped: string[] = [];
    let wl = "";
    for (const w of wwords) {
      const t = wl ? `${wl} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > maxW) { wrapped.push(wl); wl = w; } else wl = t;
    }
    if (wl) wrapped.push(wl);
    const needed = wrapped.length * 13 + (isH1 ? 12 : isH2 ? 8 : 4);
    if (y - needed < M) { page = pdfDoc.addPage([W, H]); y = H - M; }
    if (isH1) y -= 6;
    if (isBullet && wrapped.length > 0) page.drawText("-", { x: M, y, size, font, color });
    for (const wline of wrapped) { page.drawText(wline, { x: indent, y, size, font, color }); y -= 13; }
    y -= isH1 ? 8 : isH2 ? 5 : 2;
  }
  return pdfDoc.save();
}

// ── Whop publisher ─────────────────────────────────────────────────────────────

async function publishToWhop(
  product: { title: string; description: string; price_cents: number },
  pdfUrl: string,
  coverUrl: string | null
): Promise<{ id: string; url: string }> {
  // Whop description max is 1500 chars; reserve ~200 for the download footer
  const downloadFooter = `\n\nINSTANT DOWNLOAD: Your PDF is delivered immediately after purchase.\nDownload link: ${pdfUrl}`;
  const maxDescBody = 1500 - downloadFooter.length;
  const descWithDownload = product.description.slice(0, maxDescBody) + downloadFooter;

  const r = await fetch("https://api.whop.com/api/v1/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${WHOP_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      company_id: WHOP_COMPANY,
      title: product.title,
      description: descWithDownload,
      visibility: "visible",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const rawText = await r.text();
  if (!r.ok) throw new Error(`Whop create failed (${r.status}): ${rawText.slice(0, 300)}`);
  const d = rawText ? JSON.parse(rawText) : {};
  const productId = d.id;
  log("Whop product created", { productId });

  // Attach cover image
  if (coverUrl && productId) {
    try {
      const patchRes = await fetch(`https://api.whop.com/api/v1/products/${productId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${WHOP_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image: coverUrl }),
        signal: AbortSignal.timeout(10_000),
      });
      if (patchRes.ok) log("Cover image attached to Whop product");
      else log("Cover PATCH returned (non-fatal)", `${patchRes.status}: ${(await patchRes.text()).slice(0, 120)}`);
    } catch (e) {
      log("Cover PATCH failed (non-fatal)", String(e).slice(0, 80));
    }
  }

  // Create pricing plan (initial_price in dollars, company_id required)
  const rp = await fetch("https://api.whop.com/api/v1/plans", {
    method: "POST",
    headers: { Authorization: `Bearer ${WHOP_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: productId,
      company_id: WHOP_COMPANY,
      plan_type: "one_time",
      initial_price: product.price_cents / 100,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const rpText = await rp.text();
  if (!rp.ok) log("Whop plan creation failed", rpText.slice(0, 200));
  else log("Whop plan created", JSON.parse(rpText).id);

  return { id: productId, url: `https://whop.com/marketplace/${productId}` };
}

// ── Gumroad cross-poster ───────────────────────────────────────────────────────

async function crossPostToGumroad(
  title: string,
  description: string,
  gumroadPriceCents: number,
  pdfBytes: Uint8Array,
  coverUrl: string | null
): Promise<string> {
  const createRes = await fetch("https://api.gumroad.com/v2/products", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: GUMROAD_TOKEN, name: title, description: description.slice(0, 2000), price: String(gumroadPriceCents), published: "false" }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const cd = await createRes.json();
  if (!cd.success) throw new Error(`Gumroad create: ${JSON.stringify(cd).slice(0, 150)}`);
  const pid: string = cd.product.id;

  // Upload PDF file
  const fileForm = new FormData();
  fileForm.append("access_token", GUMROAD_TOKEN);
  const fileName = title.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-") + ".pdf";
  fileForm.append("file", new Blob([pdfBytes], { type: "application/pdf" }), fileName);
  await fetch(`https://api.gumroad.com/v2/products/${pid}/files`, { method: "PUT", body: fileForm, signal: AbortSignal.timeout(90_000) });

  // Upload cover image
  if (coverUrl) {
    try {
      const imgRes = await fetch(coverUrl, { signal: AbortSignal.timeout(15_000) });
      if (imgRes.ok) {
        const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
        const coverForm = new FormData();
        coverForm.append("access_token", GUMROAD_TOKEN);
        coverForm.append("file", new Blob([imgBytes], { type: "image/png" }), "cover.png");
        const covRes = await fetch(`https://api.gumroad.com/v2/products/${pid}/cover_files`, {
          method: "PUT", body: coverForm, signal: AbortSignal.timeout(30_000),
        });
        if (covRes.ok) log("Gumroad cover image uploaded");
        else log("Gumroad cover upload (non-fatal)", covRes.status);
      }
    } catch (e) {
      log("Gumroad cover upload failed (non-fatal)", String(e).slice(0, 80));
    }
  }

  // Publish
  const pubRes = await fetch(`https://api.gumroad.com/v2/products/${pid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: GUMROAD_TOKEN, published: "true" }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const pd = await pubRes.json().catch(() => ({}));
  return pd.product?.short_url ?? `https://gumroad.com/l/${pid}`;
}

// ── Publish one product (full pipeline) ───────────────────────────────────────

type PublishResult = { title: string; url: string; gumroad_url?: string; niche: string; price_usd: number; cover_url?: string; pdf_url: string };

async function publishOneProduct(): Promise<PublishResult> {
  const { niche } = await pickNiche();
  log("Generating", { niche: niche.niche, type: niche.type });

  const [content, desc, coverUrl] = await Promise.all([
    generateContent(niche),
    generateDescription(niche),
    generateCoverImage(niche.title),
  ]);

  const product = {
    title: niche.title,
    description: desc || `Premium ${niche.niche} AI ${niche.type.replace(/_/g, " ")} — ready-to-use resources for immediate results.`,
    price_cents: LAUNCH_PRICE_CENTS,
  };

  const pdfBytes = await buildPDF(product.title, content);
  const pdfUrl   = await uploadPdfToStorage(pdfBytes, product.title);
  const result   = await publishToWhop(product, pdfUrl, coverUrl);

  await sb.from("whop_products" as any).insert({
    title: product.title, whop_id: result.id, whop_url: result.url,
    price_cents: product.price_cents, niche: niche.niche, product_type: niche.type, status: "live",
    cover_image_url: coverUrl || null,
    pdf_url: pdfUrl,
  }).then(null, () => {});

  let gumroadUrl = "";
  if (GUMROAD_TOKEN) {
    try {
      const gumroadPrice = Math.round(niche.price * 0.8);
      gumroadUrl = await crossPostToGumroad(product.title, product.description, gumroadPrice, pdfBytes, coverUrl);
      if (gumroadUrl) {
        await sb.from("whop_products" as any).update({ gumroad_url: gumroadUrl }).eq("whop_id", result.id).then(null, () => {});
        log("Gumroad cross-posted", { url: gumroadUrl });
      }
    } catch (e) {
      log("Gumroad cross-post failed (non-fatal)", String(e).slice(0, 100));
    }
  }

  return {
    title: product.title, url: result.url, gumroad_url: gumroadUrl || undefined,
    niche: niche.niche, price_usd: niche.price / 100,
    cover_url: coverUrl || undefined, pdf_url: pdfUrl,
  };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Start");

  if (!WHOP_KEY || !WHOP_COMPANY) {
    return new Response(JSON.stringify({
      skipped: true,
      reason: "WHOP_API_KEY or WHOP_COMPANY_ID not set",
      setup: [
        "1. Create account at whop.com/sell",
        "2. whop.com/settings/developer → Generate API Key",
        "3. Get Company ID from company settings URL",
        "4. Set secrets: WHOP_API_KEY and WHOP_COMPANY_ID",
        "5. Run whop-store-setup once to set banner/logo/bio",
      ],
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const reqUrl    = new URL(req.url);
  const batchSize = Math.min(parseInt(reqUrl.searchParams.get("batch") || "3"), 10);

  const published: PublishResult[] = [];
  const failed: string[] = [];

  try {
    for (let i = 0; i < batchSize; i++) {
      try {
        const result = await publishOneProduct();
        published.push(result);
        log("Published", { title: result.title, url: result.url, hasCover: !!result.cover_url });
      } catch (err) {
        const msg = String(err).slice(0, 200);
        log(`Product ${i + 1} failed`, msg);
        failed.push(msg);
        break;
      }
    }

    if (RESEND_KEY && published.length > 0) {
      const rows = published.map(p => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1e293b;">
            <strong style="color:#e2e8f0;">${p.title}</strong><br/>
            <span style="color:#8b5cf6;font-size:11px;">${p.niche}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#22c55e;white-space:nowrap;">$${p.price_usd.toFixed(2)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e293b;">
            <a href="${p.url}" style="color:#8b5cf6;font-size:12px;">Whop →</a>
            ${p.gumroad_url ? `<br/><a href="${p.gumroad_url}" style="color:#64748b;font-size:12px;">Gumroad →</a>` : ""}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e293b;font-size:11px;color:${p.cover_url ? "#22c55e" : "#f59e0b"};">${p.cover_url ? "✓ Cover" : "⚠ No cover"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e293b;font-size:11px;"><a href="${p.pdf_url}" style="color:#94a3b8;">PDF →</a></td>
        </tr>`).join("");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Whop Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `⚡ ${published.length} Whop product${published.length > 1 ? "s" : ""} live: ${published[0].title.slice(0, 40)}`,
          html: `<div style="font-family:sans-serif;max-width:680px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#8b5cf6;margin:0 0 16px;">⚡ ${published.length} Product${published.length > 1 ? "s" : ""} Published to Whop</h2>
<table style="width:100%;border-collapse:collapse;">
  <thead><tr>
    <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #8b5cf6;color:#8b5cf6;font-size:12px;">Product</th>
    <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #8b5cf6;color:#8b5cf6;font-size:12px;">Price</th>
    <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #8b5cf6;color:#8b5cf6;font-size:12px;">Links</th>
    <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #8b5cf6;color:#8b5cf6;font-size:12px;">Cover</th>
    <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #8b5cf6;color:#8b5cf6;font-size:12px;">PDF</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
${failed.length > 0 ? `<p style="color:#f59e0b;font-size:12px;margin-top:12px;">⚠️ ${failed.length} failed — resumes next run</p>` : ""}
<p style="color:#334155;font-size:11px;margin-top:20px;">Runs daily 2pm UTC · batch size: ${batchSize} · DWA AI Tools</p>
</div>`,
        }),
      }).catch(() => {});
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "whop-product-publisher",
      last_run_at: new Date().toISOString(),
      last_status: published.length > 0 ? "ok" : "idle",
      last_result: JSON.stringify({ published: published.length, failed: failed.length, errors: failed, titles: published.map(p => p.title), covers: published.filter(p => p.cover_url).length }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, published: published.length, failed: failed.length, products: published }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    log("Fatal error", String(err).slice(0, 300));
    await sb.from("agent_heartbeats").upsert({
      agent_name: "whop-product-publisher",
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: String(err).slice(0, 200) }),
    }, { onConflict: "agent_name" });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
