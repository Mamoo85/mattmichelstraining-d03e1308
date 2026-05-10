// Federal courts & corrections — 8 scanners
import { IntelHit, COMMON_FETCH, UA, splitName } from "./types.ts";

// 1. CourtListener Opinions — written rulings naming party
export async function scanCLOpinions(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(`"${name}"`)}&type=o&format=json&order_by=score+desc&page_size=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 10).map((d: any): IntelHit => ({
      source: "CourtListener Opinions",
      source_url: d.absolute_url ? `https://www.courtlistener.com${d.absolute_url}` : "https://www.courtlistener.com",
      category: "Court Records",
      title: `Opinion — ${d.caseName || d.case_name || "Unknown case"}`,
      summary: `Court: ${d.court || "federal"}. Filed: ${d.dateFiled || "n/a"}. ${d.snippet ? String(d.snippet).slice(0, 200) : "Written opinion citing party."}`,
      date: d.dateFiled,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 2. CourtListener RECAP archive — free PACER-cached docs
export async function scanCLRecap(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(`"${name}"`)}&type=r&format=json&order_by=dateFiled+desc&page_size=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 10).map((d: any): IntelHit => ({
      source: "CourtListener RECAP (PACER archive)",
      source_url: d.absolute_url ? `https://www.courtlistener.com${d.absolute_url}` : "https://www.courtlistener.com/recap/",
      category: "Court Records",
      title: `PACER Filing — ${d.caseName || d.case_name || "Unknown"}`,
      summary: `${d.docket_number ? `Docket #${d.docket_number}. ` : ""}Court: ${d.court || "federal"}. Filed: ${d.dateFiled || "n/a"}.`,
      date: d.dateFiled,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 3. U.S. Tax Court DAWSON
export async function scanTaxCourt(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://public-api-green.dawson.ustaxcourt.gov/public-api/cases?searchTerm=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const cases: any[] = Array.isArray(data) ? data : (data.cases || data.results || []);
    return cases.slice(0, 10).map((c: any): IntelHit => ({
      source: "U.S. Tax Court (DAWSON)",
      source_url: c.docketNumber ? `https://dawson.ustaxcourt.gov/case-detail/${c.docketNumber}` : "https://dawson.ustaxcourt.gov",
      category: "Court Records",
      title: `Tax Court — ${c.caseCaption || c.caseTitle || name}`,
      summary: `Docket ${c.docketNumber || "n/a"}. Filed ${c.receivedAt || c.filedDate || "n/a"}. Status: ${c.status || "n/a"}.`,
      date: c.receivedAt || c.filedDate,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 4. BOP Inmate Locator (federal prisons)
export async function scanBOP(name: string): Promise<IntelHit[]> {
  try {
    const { first, last } = splitName(name);
    if (!first || !last) return [];
    const url = `https://www.bop.gov/PublicInfo/execute/inmateloc?todo=query&output=json&inmateNum=&race=&age=&sex=&inmateNameFirst=${encodeURIComponent(first)}&inmateNameMiddle=&inmateNameLast=${encodeURIComponent(last)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const inmates: any[] = data?.InmateLocator || [];
    return inmates.slice(0, 5).map((i: any): IntelHit => ({
      source: "Federal BOP Inmate Locator",
      source_url: "https://www.bop.gov/inmateloc/",
      category: "Criminal Records",
      title: `Federal Inmate — ${i.nameFirst || first} ${i.nameLast || last}`,
      summary: `Reg #${i.inmateNum || "n/a"}. Facility: ${i.faclName || "n/a"}. Release: ${i.projRelDate || i.actRelDate || "n/a"}. Age: ${i.age || "n/a"}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 5. U.S. Marshals 15 Most Wanted
export async function scanUSMarshals(name: string): Promise<IntelHit[]> {
  try {
    const res = await fetch("https://www.usmarshals.gov/api/v1/wanted", { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || data?.data || (Array.isArray(data) ? data : []);
    const ln = name.toLowerCase();
    return items
      .filter((x: any) => (x.name || x.title || "").toLowerCase().includes(ln))
      .slice(0, 3)
      .map((x: any): IntelHit => ({
        source: "U.S. Marshals Most Wanted",
        source_url: x.url || "https://www.usmarshals.gov/wanted",
        category: "Criminal Records",
        title: `USMS Wanted — ${x.name || x.title}`,
        summary: x.description || x.summary || "Active U.S. Marshals fugitive listing.",
        severity: "high",
        alias_match: name,
      }));
  } catch { return []; }
}

// 6. DEA Major Fugitives
export async function scanDEAFugitives(name: string): Promise<IntelHit[]> {
  try {
    const res = await fetch("https://www.dea.gov/fugitives/all/json", { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : (data?.results || []);
    const ln = name.toLowerCase();
    return items
      .filter((x: any) => `${x.title || ""} ${x.name || ""} ${x.aliases || ""}`.toLowerCase().includes(ln))
      .slice(0, 3)
      .map((x: any): IntelHit => ({
        source: "DEA Major Fugitives",
        source_url: x.url || "https://www.dea.gov/fugitives",
        category: "Criminal Records",
        title: `DEA Fugitive — ${x.title || x.name}`,
        summary: x.summary || "Active DEA fugitive.",
        severity: "high",
        alias_match: name,
      }));
  } catch { return []; }
}

// 7. ICE Most Wanted
export async function scanICEWanted(name: string): Promise<IntelHit[]> {
  try {
    const res = await fetch("https://www.ice.gov/most-wanted/json", { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : (data?.results || []);
    const ln = name.toLowerCase();
    return items
      .filter((x: any) => `${x.title || ""} ${x.name || ""}`.toLowerCase().includes(ln))
      .slice(0, 3)
      .map((x: any): IntelHit => ({
        source: "ICE Most Wanted",
        source_url: x.url || "https://www.ice.gov/most-wanted",
        category: "Criminal Records",
        title: `ICE Wanted — ${x.title || x.name}`,
        summary: x.summary || "Active ICE fugitive.",
        severity: "high",
        alias_match: name,
      }));
  } catch { return []; }
}

// 8. PACER Case Locator (full federal cross-court) — auth required
export async function scanPACER(name: string): Promise<IntelHit[]> {
  const user = Deno.env.get("PACER_USERNAME") || "";
  const pass = Deno.env.get("PACER_PASSWORD") || "";
  if (!user || !pass) return [];
  try {
    // PACER PSC auth
    const auth = await fetch("https://pacer.login.uscourts.gov/services/cso-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA },
      body: JSON.stringify({ loginId: user, password: pass }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!auth.ok) return [];
    const authData = await auth.json();
    const token = authData?.nextGenCSO;
    if (!token) return [];
    const res = await fetch("https://pcl.uscourts.gov/pcl-public-api/rest/parties/find", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-NEXT-GEN-CSO": token, ...UA },
      body: JSON.stringify({ lastName: splitName(name).last, firstName: splitName(name).first }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.content || []).slice(0, 15).map((c: any): IntelHit => ({
      source: "PACER Case Locator (federal cross-court)",
      source_url: "https://pcl.uscourts.gov",
      category: "Court Records",
      title: `PACER — ${c.caseTitle || c.caseNumberFull || "Federal case"}`,
      summary: `Court: ${c.courtId || "n/a"}. Type: ${c.caseType || "n/a"}. Filed: ${c.dateFiled || "n/a"}. Party role: ${c.partyRole || "n/a"}.`,
      date: c.dateFiled,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}
