// Federal regulatory & enforcement — 10 scanners
import { IntelHit, COMMON_FETCH, UA } from "./types.ts";

// 9. SEC EDGAR Litigation Releases (full-text)
export async function scanSECLitigation(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${name}"`)}&forms=LITIGATION&hits=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const hits = data?.hits?.hits || [];
    return hits.slice(0, 10).map((h: any): IntelHit => {
      const s = h._source || {};
      return {
        source: "SEC EDGAR Litigation Releases",
        source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${s.ciks?.[0] || ""}`,
        category: "Government Records",
        title: `SEC Action — ${s.display_names?.[0] || name}`,
        summary: `Form: ${s.form || "litigation"}. Filed: ${s.file_date || "n/a"}.`,
        date: s.file_date,
        severity: "high",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 10. CFTC Enforcement Actions (search HTML — best effort via EDGAR-style endpoint not avail)
export async function scanCFTC(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.cftc.gov/search/site/${encodeURIComponent(name)}?type%5B0%5D=press_release&type%5B1%5D=enforcement_action`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="(\/PressRoom\/PressReleases\/[^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "CFTC Enforcement",
      source_url: `https://www.cftc.gov${m[1]}`,
      category: "Government Records",
      title: `CFTC Action — ${m[2].trim()}`,
      summary: `CFTC press release / enforcement action mentioning ${name}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 11. FTC Cases & Proceedings
export async function scanFTC(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.ftc.gov/search/site/${encodeURIComponent(name)}?f%5B0%5D=im_field_document_type%3A18`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "FTC Cases & Proceedings",
      source_url: m[1].startsWith("http") ? m[1] : `https://www.ftc.gov${m[1]}`,
      category: "Government Records",
      title: `FTC Case — ${m[2].trim()}`,
      summary: `FTC enforcement matter mentioning ${name}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 12. CFPB Consumer Complaint Database (Socrata)
export async function scanCFPB(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?searchField=all&search_term=${encodeURIComponent(name)}&size=10&format=json`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const hits = data?.hits?.hits || [];
    return hits.slice(0, 10).map((h: any): IntelHit => {
      const s = h._source || {};
      return {
        source: "CFPB Consumer Complaints",
        source_url: `https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/${s.complaint_id}`,
        category: "Government Records",
        title: `CFPB Complaint — ${s.company || "Unknown"}`,
        summary: `${s.product || ""} / ${s.issue || ""}. State: ${s.state || "n/a"}. Date: ${s.date_received || "n/a"}.`,
        date: s.date_received,
        severity: "medium",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 13. DOJ Press Release search
export async function scanDOJ(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.justice.gov/api/v1/press_release.json?search=${encodeURIComponent(name)}&pagesize=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || [];
    return items.slice(0, 10).map((r: any): IntelHit => ({
      source: "DOJ Press Releases",
      source_url: r.url || `https://www.justice.gov${r.path || ""}`,
      category: "Government Records",
      title: `DOJ — ${r.title || "Press release"}`,
      summary: (r.body || r.summary || "").replace(/<[^>]+>/g, "").slice(0, 240),
      date: r.date,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 14. HHS-OIG LEIE (Excluded Individuals)
export async function scanLEIE(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://oig.hhs.gov/exclusions/api/list?name=${encodeURIComponent(name)}&format=json`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || data?.data || (Array.isArray(data) ? data : []);
    return items.slice(0, 10).map((e: any): IntelHit => ({
      source: "HHS-OIG LEIE (Federal Healthcare Exclusions)",
      source_url: "https://oig.hhs.gov/exclusions/",
      category: "Government Records",
      title: `LEIE Exclusion — ${e.firstname || ""} ${e.lastname || name}`.trim(),
      summary: `Excluded ${e.exclusion_date || e.date || "n/a"}. Type: ${e.excltype || e.type || "n/a"}. Specialty: ${e.specialty || "n/a"}. State: ${e.state || "n/a"}.`,
      date: e.exclusion_date || e.date,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 15. Treasury OFAC SDN consolidated list
export async function scanOFAC(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://sanctionssearch.ofac.treas.gov/Search/?Name=${encodeURIComponent(name)}&output=json`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.Records || data?.results || [];
    return items.slice(0, 5).map((r: any): IntelHit => ({
      source: "Treasury OFAC SDN List",
      source_url: "https://sanctionssearch.ofac.treas.gov/",
      category: "Government Records",
      title: `OFAC Sanction — ${r.Name || name}`,
      summary: `Program: ${r.Programs || "n/a"}. Type: ${r.Type || "n/a"}. List: ${r.List || "SDN"}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 16. NTSB CAROL accident DB
export async function scanNTSB(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://data.ntsb.gov/carol-main-public/api/Query/Main?queryString=${encodeURIComponent(name)}&page=1&pagesize=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || [];
    return items.slice(0, 5).map((r: any): IntelHit => ({
      source: "NTSB CAROL Accident DB",
      source_url: r.cm_ntsbNum ? `https://data.ntsb.gov/carol-main-public/sr-details/${r.cm_ntsbNum}` : "https://data.ntsb.gov/carol-main-public",
      category: "Government Records",
      title: `NTSB Accident — ${r.cm_ntsbNum || "n/a"}`,
      summary: `${r.cm_eventType || ""} on ${r.cm_eventDate || "n/a"}. Location: ${r.cm_City || ""}, ${r.cm_State || ""}.`,
      date: r.cm_eventDate,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// 17. FINRA BrokerCheck
export async function scanFINRA(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://api.brokercheck.finra.org/search/individual?query=${encodeURIComponent(name)}&hl=true&nrows=10&start=0&r=25&sort=score+desc&wt=json`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data?.hits?.hits || [];
    return docs.slice(0, 10).map((h: any): IntelHit => {
      const s = h._source || {};
      const ind = s.ind_source_id || "";
      return {
        source: "FINRA BrokerCheck",
        source_url: ind ? `https://brokercheck.finra.org/individual/summary/${ind}` : "https://brokercheck.finra.org",
        category: "Financial Records",
        title: `BrokerCheck — ${s.ind_firstname || ""} ${s.ind_lastname || ""}`.trim(),
        summary: `CRD #${ind}. Disclosures: ${s.ind_disclosure_count || 0}. Current firm: ${s.ind_current_employments?.[0]?.firm_name || "n/a"}.`,
        severity: (s.ind_disclosure_count || 0) > 0 ? "high" : "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 18. NMLS Consumer Access (mortgage originators)
export async function scanNMLS(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://www.nmlsconsumeraccess.org/EntityDetails.aspx/IndividualSearchResults?searchText=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/EntityDetails\.aspx\/INDIVIDUAL\/(\d+)[^>]*>([^<]+)</g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "NMLS Consumer Access",
      source_url: `https://www.nmlsconsumeraccess.org/EntityDetails.aspx/INDIVIDUAL/${m[1]}`,
      category: "Financial Records",
      title: `NMLS Mortgage Originator — ${m[2].trim()}`,
      summary: `NMLS ID #${m[1]}. View profile for license history & disciplinary actions.`,
      severity: "info",
      alias_match: name,
    }));
  } catch { return []; }
}
