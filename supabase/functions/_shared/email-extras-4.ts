// Fourth wave of free/low-cost email enrichment sources.
// All fail-open: return null on any error. No throws.
//
// Tiers 40-64:
//  40. irsBmfEmail            — IRS tax-exempt org BMF (ProPublica Nonprofit Explorer)
//  41. fccUlsEmail            — FCC ULS license search
//  42. npiRegistryEmail       — NPI Registry (healthcare)
//  43. nsfAwardsEmail         — NSF Awards search
//  44. nihReporterEmail       — NIH RePORTER grants
//  45. grantsGovEmail         — Grants.gov search
//  46. epaFrsEmail            — EPA Facility Registry
//  47. fdaRegistrationEmail   — FDA Drug Establishment
//  48. usaspendingPocEmail    — USAspending.gov recipient POC
//  49. usptoAssigneeEmail     — USPTO PatentsView assignee
//  50. impressumEmail         — /impressum (EU legal disclosure)
//  51. securityTxtEmail       — /.well-known/security.txt
//  52. humansTxtEmail         — /humans.txt
//  53. wellKnownContactEmail  — /.well-known/contact
//  54. jsonLdOrgEmail         — schema.org JSON-LD Organization email
//  55. metaOgEmail            — <meta property="og:email">
//  56. rssFeedEmail           — RSS/Atom feed managingEditor/webMaster
//  57. vcardEmail             — /contact.vcf or /vcard
//  58. apiAboutEmail          — /api/about, /api/contact common JSON
//  59. robotsTxtEmail         — /robots.txt comment scrape
//  60. mantaEmail             — Manta directory
//  61. superpagesEmail        — Superpages
//  62. merchantcircleEmail    — MerchantCircle
//  63. houzzProEmail          — Houzz pro profile
//  64. thomasnetEmail         — ThomasNet manufacturers

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

async function safeJson(url: string, init?: RequestInit, timeoutMs = 6000): Promise<any | null> {
  const t = await safeText(url, init, timeoutMs);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const enc = (s: string) => encodeURIComponent(s);

// 40. IRS BMF via ProPublica Nonprofit Explorer
export async function irsBmfEmail(name: string): Promise<string | null> {
  const j = await safeJson(`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${enc(name)}`);
  const ein = j?.organizations?.[0]?.ein;
  if (!ein) return null;
  const d = await safeJson(`https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`);
  const txt = JSON.stringify(d || {});
  return pickEmail(txt);
}

// 41. FCC ULS license search
export async function fccUlsEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://wireless2.fcc.gov/UlsApp/UlsSearch/results.jsp?searchValue=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 42. NPI Registry
export async function npiRegistryEmail(name: string, city?: string): Promise<string | null> {
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=${enc(name)}${city ? `&city=${enc(city)}` : ""}&limit=5`;
  const j = await safeJson(url);
  return pickEmail(JSON.stringify(j || {}));
}

// 43. NSF Awards
export async function nsfAwardsEmail(name: string): Promise<string | null> {
  const j = await safeJson(`https://api.nsf.gov/services/v1/awards.json?awardeeName=${enc(name)}&printFields=piEmail,coPDPI`);
  return pickEmail(JSON.stringify(j || {}));
}

// 44. NIH RePORTER
export async function nihReporterEmail(name: string): Promise<string | null> {
  const body = JSON.stringify({ criteria: { org_names: [name] }, include_fields: ["ContactPiName", "OrgName", "ContactEmail"], limit: 5 });
  const t = await safeText("https://api.reporter.nih.gov/v2/projects/search", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  return t ? pickEmail(t) : null;
}

// 45. Grants.gov
export async function grantsGovEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.grants.gov/grantsws/rest/opportunities/search/?keyword=${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 46. EPA FRS
export async function epaFrsEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://data.epa.gov/efservice/frs.frs_facility_site/facility_name/CONTAINING/${enc(name)}/JSON`);
  return t ? pickEmail(t) : null;
}

// 47. FDA establishment registration
export async function fdaRegistrationEmail(name: string): Promise<string | null> {
  const j = await safeJson(`https://api.fda.gov/drug/drugsfda.json?search=openfda.manufacturer_name:"${enc(name)}"&limit=3`);
  return pickEmail(JSON.stringify(j || {}));
}

// 48. USAspending recipient POC
export async function usaspendingPocEmail(name: string): Promise<string | null> {
  const body = JSON.stringify({ filters: { recipient_search_text: [name] }, limit: 3 });
  const t = await safeText("https://api.usaspending.gov/api/v2/search/spending_by_award/", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  return t ? pickEmail(t) : null;
}

// 49. USPTO PatentsView assignee
export async function usptoAssigneeEmail(name: string): Promise<string | null> {
  const q = enc(JSON.stringify({ assignee_organization: name }));
  const t = await safeText(`https://api.patentsview.org/assignees/query?q=${q}&f=["assignee_organization","assignee_id"]`);
  return t ? pickEmail(t) : null;
}

// 50. Impressum (EU legal disclosure - always has email)
export async function impressumEmail(domain: string): Promise<string | null> {
  for (const path of ["/impressum", "/impressum.html", "/imprint", "/legal-notice"]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) { const e = pickEmail(t, domain); if (e) return e; }
  }
  return null;
}

// 51. security.txt
export async function securityTxtEmail(domain: string): Promise<string | null> {
  for (const path of ["/.well-known/security.txt", "/security.txt"]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) {
      const m = t.match(/Contact:\s*mailto:([^\s\r\n]+)/i);
      if (m) return m[1];
      const e = pickEmail(t, domain);
      if (e) return e;
    }
  }
  return null;
}

// 52. humans.txt
export async function humansTxtEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/humans.txt`);
  return t ? pickEmail(t, domain) : null;
}

// 53. /.well-known/contact
export async function wellKnownContactEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/.well-known/contact`);
  return t ? pickEmail(t, domain) : null;
}

// 54. JSON-LD schema.org Organization email
export async function jsonLdOrgEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/`);
  if (!t) return null;
  const blocks = [...t.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1]);
      const arr = Array.isArray(j) ? j : [j];
      for (const o of arr) {
        if (o?.email) return String(o.email).replace(/^mailto:/, "");
        if (o?.contactPoint?.email) return String(o.contactPoint.email);
      }
    } catch { /* ignore */ }
  }
  return null;
}

// 55. <meta og:email>
export async function metaOgEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/`);
  if (!t) return null;
  const m = t.match(/<meta[^>]+(?:property|name)=["'](?:og:email|email|contact)["'][^>]+content=["']([^"']+)["']/i);
  return m?.[1] || null;
}

// 56. RSS feed managingEditor/webMaster
export async function rssFeedEmail(domain: string): Promise<string | null> {
  for (const path of ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml"]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) {
      const m = t.match(/<(?:managingEditor|webMaster|author)>([^<]+)<\/(?:managingEditor|webMaster|author)>/i);
      if (m) { const e = pickEmail(m[1], domain); if (e) return e; }
      const e = pickEmail(t, domain);
      if (e) return e;
    }
  }
  return null;
}

// 57. vCard
export async function vcardEmail(domain: string): Promise<string | null> {
  for (const path of ["/contact.vcf", "/vcard", "/vcard.vcf", "/about.vcf"]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) {
      const m = t.match(/EMAIL[^:]*:([^\r\n]+)/i);
      if (m) return m[1].trim();
    }
  }
  return null;
}

// 58. /api/about, /api/contact
export async function apiAboutEmail(domain: string): Promise<string | null> {
  for (const path of ["/api/about", "/api/contact", "/api/v1/contact", "/wp-json/wp/v2/users"]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) { const e = pickEmail(t, domain); if (e) return e; }
  }
  return null;
}

// 59. robots.txt comment scrape
export async function robotsTxtEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/robots.txt`);
  return t ? pickEmail(t, domain) : null;
}

// 60. Manta
export async function mantaEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.manta.com/search?search=${enc(name)}${city ? `&search_location=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 61. Superpages
export async function superpagesEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.superpages.com/search?search_terms=${enc(name)}${city ? `&geo_location_terms=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 62. MerchantCircle
export async function merchantcircleEmail(name: string, city?: string): Promise<string | null> {
  const t = await safeText(`https://www.merchantcircle.com/search.html?qs=${enc(name)}${city ? `&l=${enc(city)}` : ""}`);
  return t ? pickEmail(t) : null;
}

// 63. Houzz pro
export async function houzzProEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.houzz.com/professionals/query/${enc(name)}`);
  return t ? pickEmail(t) : null;
}

// 64. ThomasNet
export async function thomasnetEmail(name: string): Promise<string | null> {
  const t = await safeText(`https://www.thomasnet.com/nsearch.html?cov=NA&heading=&searchsource=suppliers&searchterm=${enc(name)}`);
  return t ? pickEmail(t) : null;
}
