// email-extras-5.ts — Free email enrichment sources, Tiers 65–89.
// Home service directories, B2B databases, Michigan-specific registries,
// and local business directories. All fail-open (null on any error).
// Imported lazily by email-waterfall.ts.

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function pickEmail(text: string, domain?: string): string | null {
  const all = (text.match(EMAIL_RE) || []).filter(
    (e) =>
      !/\.(png|jpg|svg|gif|webp|woff|ttf|js|css)$/i.test(e) &&
      !e.toLowerCase().startsWith("noreply@") &&
      !e.toLowerCase().startsWith("no-reply@") &&
      !e.toLowerCase().startsWith("postmaster@") &&
      e.length < 80,
  );
  if (!all.length) return null;
  if (domain) {
    const m = all.find((e) => e.toLowerCase().endsWith(`@${domain}`));
    if (m) return m;
  }
  return all[0];
}

async function safeText(
  url: string,
  init?: RequestInit,
  timeoutMs = 6000,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)",
        ...((init?.headers as Record<string, string>) || {}),
      },
    });
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

const enc = (s: string) => encodeURIComponent(s);
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// 65. Angi (formerly Angie's List)
export async function angiEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.angi.com/companylist.htm?searchTerm=${enc(name)}${city ? `&zip=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 66. HomeAdvisor
export async function homeadvisorEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.homeadvisor.com/c.${enc(slug(name))}.${enc(city || "")}.html`,
  );
  return t ? pickEmail(t) : null;
}

// 67. Thumbtack
export async function thumbtackEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.thumbtack.com/k/${enc(slug(name))}/near-me/${city ? enc(slug(city)) : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 68. Porch
export async function porchEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://porch.com/search?q=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 69. Nextdoor Business Pages
export async function nextdoorBizEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://nextdoor.com/pages/search/?query=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 70. BBB profile (Better Business Bureau)
export async function bbbProfileEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.bbb.org/search?find_text=${enc(name)}${city ? `&find_loc=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 71. Chamber of Commerce directory
export async function chamberOfCommerceEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.chamberofcommerce.com/search?what=${enc(name)}${city ? `&where=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 72. ZoomInfo free company search
export async function zoomInfoFreeEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.zoominfo.com/companies-search/companies-${enc(slug(name))}`,
  );
  return t ? pickEmail(t) : null;
}

// 73. US Chamber of Commerce
export async function usChamberEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.uschamber.com/search?keyword=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 74. Dun & Bradstreet
export async function dnbEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.dnb.com/business-directory/company-search.html?term=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 75. CorporationWiki
export async function corporationWikiEmail(
  name: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.corporationwiki.com/search/results?term=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 76. OpenGovUS
export async function opengovusEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.opengovus.com/search?q=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 77. GovWin public RFP listings
export async function govWinEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://iq.govwin.com/neo/marketAnalysis/search?keyword=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 78. SAM.gov public solicitation POC (FBO)
export async function fbo311Email(name: string): Promise<string | null> {
  const t = await safeText(
    `https://sam.gov/api/prod/sgs/v1/search/?index=opp&q=${enc(name)}&size=5`,
  );
  return t ? pickEmail(t) : null;
}

// 79. Michigan LARA license search
export async function michiganLaraEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://aca-prod.accela.com/MILARA/Cap/CapHome.aspx?module=Licenses&search=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 80. Michigan business entity search (COFS)
export async function michiganBusinessEmail(
  name: string,
): Promise<string | null> {
  const t = await safeText(
    `https://cofs.lara.state.mi.us/SearchApi/Search/Search?searchValue=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 81. YellowBook
export async function yellowBookEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.yellowbook.com/s/?q=${enc(name)}${city ? `&l=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 82. LocalEdge
export async function localEdgeEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.localedge.com/search?q=${enc(name)}${city ? `&loc=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 83. Cylex US
export async function cylexEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.cylex.us.com/search?q=${enc(name)}${city ? `&l=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 84. Brownbook
export async function brownbookEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.brownbook.net/search/${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 85. Tupalo
export async function tupaloEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://tupalo.com/en/search?q=${enc(name)}${city ? `&loc=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 86. eZlocal
export async function ezlocalEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.ezlocal.com/search?q=${enc(name)}${city ? `&l=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 87. Cybo
export async function cyboEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.cybo.com/?q=${enc(name)}${city ? `+${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 88. TradeFord B2B marketplace
export async function tradeFordEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.tradeford.com/search.html?q=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 89. ExportersIndia
export async function exportersIndiaEmail(
  name: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.exportersindia.com/search.php?ss=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}
