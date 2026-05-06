// email-extras-4.ts — Free email enrichment sources, Tiers 40–64.
// All functions are exported async helpers that accept a business name and/or domain.
// Every function fails open (returns null on any error / non-200 / empty result).
// Imported lazily by email-waterfall.ts to avoid cold-start cost when not needed.

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

async function safeJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 6000,
): Promise<unknown> {
  const t = await safeText(url, init, timeoutMs);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const enc = (s: string) => encodeURIComponent(s);

// 40. IRS BMF via ProPublica Nonprofit Explorer
export async function irsBmfEmail(name: string): Promise<string | null> {
  const j = (await safeJson(
    `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${enc(name)}`,
  )) as { organizations?: Array<{ ein?: string }> } | null;
  const ein = j?.organizations?.[0]?.ein;
  if (!ein) return null;
  const d = await safeJson(
    `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`,
  );
  return pickEmail(JSON.stringify(d || {}));
}

// 41. FCC ULS license search
export async function fccUlsEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://wireless2.fcc.gov/UlsApp/UlsSearch/results.jsp?searchValue=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 42. NPI Registry (healthcare organizations)
export async function npiRegistryEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const url =
    `https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=${enc(name)}${city ? `&city=${enc(city)}` : ""}&limit=5`;
  const j = await safeJson(url);
  return pickEmail(JSON.stringify(j || {}));
}

// 43. NSF Awards
export async function nsfAwardsEmail(name: string): Promise<string | null> {
  const j = await safeJson(
    `https://api.nsf.gov/services/v1/awards.json?awardeeName=${enc(name)}&printFields=piEmail,coPDPI`,
  );
  return pickEmail(JSON.stringify(j || {}));
}

// 44. NIH RePORTER
export async function nihReporterEmail(name: string): Promise<string | null> {
  const body = JSON.stringify({
    criteria: { org_names: [name] },
    include_fields: ["ContactPiName", "OrgName", "ContactEmail"],
    limit: 5,
  });
  const t = await safeText("https://api.reporter.nih.gov/v2/projects/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return t ? pickEmail(t) : null;
}

// 45. Grants.gov
export async function grantsGovEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.grants.gov/grantsws/rest/opportunities/search/?keyword=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 46. EPA FRS (Facility Registry Service) — manufacturing/industrial contacts
export async function epaFrsEmail(name: string, state?: string): Promise<string | null> {
  const st = state?.toUpperCase().slice(0, 2) || "MI";
  const t = await safeText(
    `https://ofmpub.epa.gov/frs_public2/frs_rest_services.get_facilities?facility_name=${enc(name)}&state_abbr=${st}&output=JSON&p_limit=5`,
  );
  return t ? pickEmail(t) : null;
}

// 47. FDA establishment registration
export async function fdaRegistrationEmail(
  name: string,
): Promise<string | null> {
  const j = await safeJson(
    `https://api.fda.gov/drug/drugsfda.json?search=openfda.manufacturer_name:"${enc(name)}"&limit=3`,
  );
  return pickEmail(JSON.stringify(j || {}));
}

// 48. USAspending recipient POC
export async function usaspendingPocEmail(
  name: string,
): Promise<string | null> {
  const body = JSON.stringify({
    filters: { recipient_search_text: [name] },
    limit: 3,
  });
  const t = await safeText(
    "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
  );
  return t ? pickEmail(t) : null;
}

// 49. USPTO PatentsView assignee
export async function usptoAssigneeEmail(
  name: string,
): Promise<string | null> {
  const usptoKey = (globalThis as any).Deno?.env.get("USPTO_API_KEY") || "";
  const q = enc(JSON.stringify({ assignee_organization: name }));
  const t = await safeText(
    `https://api.patentsview.org/assignees/query?q=${q}&f=["assignee_organization","assignee_id"]`,
    usptoKey ? { headers: { "X-Api-Key": usptoKey } } : undefined,
  );
  return t ? pickEmail(t) : null;
}

// 50. Impressum (EU legal disclosure page — always contains email)
export async function impressumEmail(domain: string): Promise<string | null> {
  for (const path of ["/impressum", "/impressum.html", "/imprint", "/legal-notice"]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) {
      const e = pickEmail(t, domain);
      if (e) return e;
    }
  }
  return null;
}

// 51. security.txt (RFC 9116)
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
export async function wellKnownContactEmail(
  domain: string,
): Promise<string | null> {
  const t = await safeText(`https://${domain}/.well-known/contact`);
  return t ? pickEmail(t, domain) : null;
}

// 54. JSON-LD schema.org Organization email
export async function jsonLdOrgEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/`);
  if (!t) return null;
  const blocks = [
    ...t.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1]);
      const arr = Array.isArray(j) ? j : [j];
      for (const o of arr as Array<Record<string, unknown>>) {
        if (o?.email) return String(o.email).replace(/^mailto:/, "");
        const cp = o?.contactPoint as Record<string, unknown> | undefined;
        if (cp?.email) return String(cp.email);
      }
    } catch { /* ignore */ }
  }
  return null;
}

// 55. <meta> og:email / contact tag
export async function metaOgEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/`);
  if (!t) return null;
  const m = t.match(
    /<meta[^>]+(?:property|name)=["'](?:og:email|email|contact)["'][^>]+content=["']([^"']+)["']/i,
  );
  return m?.[1] || null;
}

// 56. RSS feed managingEditor / webMaster
export async function rssFeedEmail(domain: string): Promise<string | null> {
  for (const path of ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml"]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) {
      const m = t.match(
        /<(?:managingEditor|webMaster|author)>([^<]+)<\/(?:managingEditor|webMaster|author)>/i,
      );
      if (m) {
        const e = pickEmail(m[1], domain);
        if (e) return e;
      }
      const e = pickEmail(t, domain);
      if (e) return e;
    }
  }
  return null;
}

// 57. vCard endpoint
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

// 58. /api/about, /api/contact, /wp-json/wp/v2/users
export async function apiAboutEmail(domain: string): Promise<string | null> {
  for (const path of [
    "/api/about",
    "/api/contact",
    "/api/v1/contact",
    "/wp-json/wp/v2/users",
  ]) {
    const t = await safeText(`https://${domain}${path}`);
    if (t) {
      const e = pickEmail(t, domain);
      if (e) return e;
    }
  }
  return null;
}

// 59. robots.txt comment scrape
export async function robotsTxtEmail(domain: string): Promise<string | null> {
  const t = await safeText(`https://${domain}/robots.txt`);
  return t ? pickEmail(t, domain) : null;
}

// 60. Manta business directory
export async function mantaEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.manta.com/search?search=${enc(name)}${city ? `&search_location=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 61. Superpages
export async function superpagesEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.superpages.com/search?search_terms=${enc(name)}${city ? `&geo_location_terms=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 62. MerchantCircle
export async function merchantcircleEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const t = await safeText(
    `https://www.merchantcircle.com/search.html?qs=${enc(name)}${city ? `&l=${enc(city)}` : ""}`,
  );
  return t ? pickEmail(t) : null;
}

// 63. Houzz Pro profile
export async function houzzProEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.houzz.com/professionals/query/${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}

// 64. ThomasNet manufacturers
export async function thomasnetEmail(name: string): Promise<string | null> {
  const t = await safeText(
    `https://www.thomasnet.com/nsearch.html?cov=NA&heading=&searchsource=suppliers&searchterm=${enc(name)}`,
  );
  return t ? pickEmail(t) : null;
}
