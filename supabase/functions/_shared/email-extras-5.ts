// Fifth wave of free/low-cost email enrichment sources.
// All fail-open: return null on any error. No throws.
//
// Tiers 65-89:
//  65. angiEmail              — Angi (Angie's List) pro page
//  66. homeadvisorEmail       — HomeAdvisor pro
//  67. thumbtackEmail         — Thumbtack pro
//  68. porchEmail             — Porch pro
//  69. nextdoorBizEmail       — Nextdoor business page
//  70. bbbProfileEmail        — BBB business profile (full)
//  71. chamberOfCommerceEmail — Chamber of Commerce directory
//  72. zoomInfoFreeEmail      — ZoomInfo free company search
//  73. usChamberEmail         — US Chamber Smart Brief
//  74. dnbEmail               — Dun & Bradstreet free profile
//  75. corporationWikiEmail   — CorporationWiki
//  76. opengovusEmail         — OpenGovUS contractor records
//  77. govWinEmail            — GovWin IQ public RFPs
//  78. fbo311Email            — Federal beta.SAM.gov solicitation POC
//  79. michiganLaraEmail      — Michigan LARA license search
//  80. michiganBusinessEmail  — michigan.gov business entity search
//  81. yellowBookEmail        — YellowBook
//  82. localEdgeEmail         — LocalEdge directory
//  83. cylexEmail             — Cylex
//  84. brownbookEmail         — Brownbook
//  85. tupaloEmail            — Tupalo
//  86. ezlocalEmail           — eZlocal
//  87. cybolEmail             — Cybo
//  88. tradeFordEmail         — TradeFord B2B
//  89. exportersIndiaEmail    — ExportersIndia (B2B suppliers)

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function pickEmail(text: string, domain?: string): string | null {
  const all = (text.match(EMAIL_RE) || []).filter((e) =>
    !/\.(png|jpg|svg|gif|webp|woff|ttf|js|css)$/i.test(e) &&
    !e.toLowerCase().startsWith("noreply@") &&
    !e.toLowerCase().startsWith("no-reply@") &&
    !e.toLowerCase().startsWith("postmaster@") &&
    e.length < 80
  );
  if (!all.length) return null;
  if (domain) {
    const m = all.find((e) => e.toLowerCase().endsWith(`@${domain}`));
    if (m) return m;
  }
  return all[0];
}

async function safeText(url: string, init?: RequestInit, timeoutMs = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)", ...(init?.headers || {}) },
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    return await res.text();
  } catch { return null; }
}

const enc = (s: string) => encodeURIComponent(s);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// 65. Angi
export async function angiEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.angi.com/companylist.htm?searchTerm=${enc(name)}${city ? `&zip=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 66. HomeAdvisor
export async function homeadvisorEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.homeadvisor.com/c.${enc(slug(name))}.${enc(city || "")}.html`);
  return t ? pickEmail(t) : null;
}

// 67. Thumbtack
export async function thumbtackEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.thumbtack.com/k/${enc(slug(name))}/near-me/${city ? enc(slug(city)) : ""}`);
  return t ? pickEmail(t) : null;
}

// 68. Porch
export async function porchEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://porch.com/search?q=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 69. Nextdoor business
export async function nextdoorBizEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://nextdoor.com/pages/search/?query=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 70. BBB profile
export async function bbbProfileEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.bbb.org/search?find_text=${enc(name)}${city ? `&find_loc=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 71. Chamber of Commerce
export async function chamberOfCommerceEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.chamberofcommerce.com/search?what=${enc(name)}${city ? `&where=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 72. ZoomInfo free
export async function zoomInfoFreeEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.zoominfo.com/companies-search/companies-${enc(slug(name))}`);
  return t ? pickEmail(t) : null;
}

// 73. US Chamber
export async function usChamberEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.uschamber.com/search?keyword=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 74. D&B
export async function dnbEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.dnb.com/business-directory/company-search.html?term=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 75. CorporationWiki
export async function corporationWikiEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.corporationwiki.com/search/results?term=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 76. OpenGovUS
export async function opengovusEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.opengovus.com/search?q=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 77. GovWin (public RFP listings)
export async function govWinEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://iq.govwin.com/neo/marketAnalysis/search?keyword=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 78. SAM.gov public solicitation POC
export async function fbo311Email(name: string): Promise<string | null> {
  const t = await safeText(`https://sam.gov/api/prod/sgs/v1/search/?index=opp&q=${enc(name)}&size=5`);
  return t ? pickEmail(t) : null;
}

// 79. Michigan LARA license
export async function michiganLaraEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://aca-prod.accela.com/MILARA/Cap/CapHome.aspx?module=Licenses&search=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 80. Michigan business entity search
export async function michiganBusinessEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://cofs.lara.state.mi.us/SearchApi/Search/Search?searchValue=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 81. YellowBook
export async function yellowBookEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.yellowbook.com/s/?q=${enc(name)}${city ? `&l=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 82. LocalEdge
export async function localEdgeEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.localedge.com/search?q=${enc(name)}${city ? `&loc=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 83. Cylex
export async function cylexEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.cylex.us.com/search?q=${enc(name)}${city ? `&l=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 84. Brownbook
export async function brownbookEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.brownbook.net/search/${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 85. Tupalo
export async function tupaloEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://tupalo.com/en/search?q=${enc(name)}${city ? `&loc=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 86. eZlocal
export async function ezlocalEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.ezlocal.com/search?q=${enc(name)}${city ? `&l=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 87. Cybo
export async function cybolEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.cybo.com/?q=${enc(name)}${city ? `+${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 88. TradeFord
export async function tradeFordEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.tradeford.com/search.html?q=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 89. ExportersIndia
export async function exportersIndiaEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.exportersindia.com/search.php?ss=${enc(name)}`);
  return t ? pickEmail(t) : null;
}
