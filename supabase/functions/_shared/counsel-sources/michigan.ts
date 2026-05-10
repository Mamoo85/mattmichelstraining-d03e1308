// Michigan state-level — 12 scanners
import { IntelHit, COMMON_FETCH, UA, splitName } from "./types.ts";

// 19. MDOC OTIS — direct scrape
export async function scanMDOC_OTIS(name: string): Promise<IntelHit[]> {
  try {
    const { first, last } = splitName(name);
    if (!last) return [];
    const url = `https://mdocweb.state.mi.us/OTIS2/otis2results.aspx?txtLName=${encodeURIComponent(last)}&txtFName=${encodeURIComponent(first)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const rows = [...html.matchAll(/otis2profile\.aspx\?mdocNumber=(\d+)[^>]*>([^<]+)<[\s\S]*?<td[^>]*>([^<]+)<\/td>/g)].slice(0, 5);
    return rows.map((m): IntelHit => ({
      source: "MDOC OTIS (Michigan Offender Tracking)",
      source_url: `https://mdocweb.state.mi.us/OTIS2/otis2profile.aspx?mdocNumber=${m[1]}`,
      category: "Criminal Records",
      title: `MDOC Offender — ${m[2].trim()}`,
      summary: `MDOC #${m[1]}. Status: ${m[3].trim()}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 20. Michigan PSOR (state sex offender registry)
export async function scanMIPSOR(name: string): Promise<IntelHit[]> {
  try {
    const { first, last } = splitName(name);
    if (!last) return [];
    const url = `https://mspsor.com/Home/SearchResults?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="\/Home\/Detail\/(\d+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "Michigan PSOR",
      source_url: `https://mspsor.com/Home/Detail/${m[1]}`,
      category: "Criminal Records",
      title: `MI Sex Offender Registry — ${m[2].trim()}`,
      summary: `Listed in Michigan Public Sex Offender Registry. ID: ${m[1]}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 21. LARA Professional License Verification
export async function scanLARALicense(name: string): Promise<IntelHit[]> {
  try {
    const { first, last } = splitName(name);
    if (!last) return [];
    const url = `https://aca-prod.accela.com/MILARA/GeneralProperty/LicenseeSearchResults.aspx?LName=${encodeURIComponent(last)}&FName=${encodeURIComponent(first)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<td[^>]*>([^<]*\b(?:LICENSE|LIC)\b[^<]*)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "LARA Professional License Verification",
      source_url: "https://aca-prod.accela.com/MILARA/GeneralProperty/LicenseeSearch.aspx",
      category: "Government Records",
      title: `MI Professional License — ${m[1].trim()}`,
      summary: `License: ${m[2].trim()}. Status: ${m[3].trim()}.`,
      severity: "info",
      alias_match: name,
    }));
  } catch { return []; }
}

// 22. LARA Corporations Online Filing — entity search
export async function scanLARACorp(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://cofs.lara.state.mi.us/SearchApi/Search/EntitySearch?searchValue=${encodeURIComponent(name)}&searchType=2`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : (data?.results || []);
    return items.slice(0, 10).map((e: any): IntelHit => ({
      source: "LARA Michigan Corporations",
      source_url: e.Id ? `https://cofs.lara.state.mi.us/CorpWeb/CorpSearch/CorpSummary.aspx?ID=${e.Id}` : "https://cofs.lara.state.mi.us",
      category: "Business Records",
      title: `MI Entity — ${e.EntityName || e.name || "Unknown"}`,
      summary: `Type: ${e.EntityType || "n/a"}. Status: ${e.EntityStatus || "n/a"}. Filed: ${e.IncorpDate || e.FiledDate || "n/a"}. ID #${e.IdNum || e.Id || "n/a"}.`,
      date: e.IncorpDate || e.FiledDate,
      severity: "info",
      alias_match: name,
    }));
  } catch { return []; }
}

// 23. Michigan SOS UCC filings
export async function scanMI_UCC(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://services2.sos.state.mi.us/UCCSearch/Search.aspx?type=debtor&name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="(FileDetail\.aspx\?[^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "Michigan SOS UCC Filings",
      source_url: `https://services2.sos.state.mi.us/UCCSearch/${m[1]}`,
      category: "Financial Records",
      title: `MI UCC Filing — ${m[2].trim()}`,
      summary: `UCC financing statement naming ${name} as debtor.`,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 24. MI Court of Appeals opinions
export async function scanMICOA(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.courts.michigan.gov/api/CaseSearch/Search?searchText=${encodeURIComponent(name)}&court=COA`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || data?.cases || [];
    return items.slice(0, 5).map((c: any): IntelHit => ({
      source: "Michigan Court of Appeals",
      source_url: c.url || "https://www.courts.michigan.gov/courts/coa/",
      category: "Court Records",
      title: `COA Opinion — ${c.caption || c.title || name}`,
      summary: `Docket ${c.docketNumber || "n/a"}. Filed: ${c.dateFiled || "n/a"}. Disposition: ${c.disposition || "n/a"}.`,
      date: c.dateFiled,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 25. MI Supreme Court opinions
export async function scanMISCT(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.courts.michigan.gov/api/CaseSearch/Search?searchText=${encodeURIComponent(name)}&court=MSC`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || data?.cases || [];
    return items.slice(0, 5).map((c: any): IntelHit => ({
      source: "Michigan Supreme Court",
      source_url: c.url || "https://www.courts.michigan.gov/courts/supreme-court/",
      category: "Court Records",
      title: `MSC Opinion — ${c.caption || name}`,
      summary: `Docket ${c.docketNumber || "n/a"}. Filed: ${c.dateFiled || "n/a"}.`,
      date: c.dateFiled,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 26. Michigan AG press releases
export async function scanMIAG(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.michigan.gov/ag/news?keywords=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="(\/ag\/news\/[^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "Michigan AG Press Releases",
      source_url: `https://www.michigan.gov${m[1]}`,
      category: "News & Public Notices",
      title: `MI AG — ${m[2].trim()}`,
      summary: `Michigan Attorney General notice / enforcement action mentioning ${name}.`,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 27. MI Dept of Insurance disciplinary actions (LARA-DIFS)
export async function scanMIDIFS(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://difs.state.mi.us/locators/LegalAction/SearchResults?text=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/g)].slice(1, 6);
    return matches.map((m): IntelHit => ({
      source: "MI DIFS Insurance Discipline",
      source_url: "https://difs.state.mi.us/locators/LegalAction",
      category: "Government Records",
      title: `DIFS Action — ${m[1].trim()}`,
      summary: `Action: ${m[2].trim()}. Date: ${m[3].trim()}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 28. MIOSHA citations (state OSHA)
export async function scanMIOSHA(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.michigan.gov/leo/bureaus-agencies/miosha/inspections-and-citations?search=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]*MIOSHA[^<]*)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "MIOSHA Citations",
      source_url: m[1].startsWith("http") ? m[1] : `https://www.michigan.gov${m[1]}`,
      category: "Government Records",
      title: `MIOSHA — ${m[2].trim()}`,
      summary: `Michigan OSHA citation / inspection mentioning ${name}.`,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 29. State Bar of Michigan — member directory + discipline
export async function scanMIStateBar(name: string): Promise<IntelHit[]> {
  try {
    const { first, last } = splitName(name);
    if (!last) return [];
    const url = `https://www.michbar.org/memberdirectory/results?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="\/memberdirectory\/detail\?id=(\d+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "State Bar of Michigan",
      source_url: `https://www.michbar.org/memberdirectory/detail?id=${m[1]}`,
      category: "Government Records",
      title: `MI Attorney — ${m[2].trim()}`,
      summary: `Bar #${m[1]}. View profile for status and any discipline by Attorney Discipline Board.`,
      severity: "info",
      alias_match: name,
    }));
  } catch { return []; }
}

// 30. Michigan Treasury tax lien index — best-effort SOS UCC tax-lien tab
export async function scanMITaxLien(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://services2.sos.state.mi.us/UCCSearch/Search.aspx?type=federaltaxlien&name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="(FileDetail\.aspx\?[^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "Michigan Tax Lien Index (SOS)",
      source_url: `https://services2.sos.state.mi.us/UCCSearch/${m[1]}`,
      category: "Financial Records",
      title: `MI Tax Lien — ${m[2].trim()}`,
      summary: `Federal/state tax lien filed against ${name} per MI Secretary of State index.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}
