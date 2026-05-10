// Michigan county courts & registers of deeds — 10 scanners
import { IntelHit, COMMON_FETCH, UA } from "./types.ts";

// Generic helper for "search-by-name" pages where we extract anchor links containing case numbers.
async function scrapeAnchors(url: string, sourceName: string, category: IntelHit["category"], severity: IntelHit["severity"], titlePrefix: string, name: string, hrefBase: string, urlPattern: RegExp): Promise<IntelHit[]> {
  try {
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(urlPattern)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: sourceName,
      source_url: hrefBase + m[1],
      category,
      title: `${titlePrefix} — ${(m[2] || "").trim() || "case"}`,
      summary: `Court record naming ${name}. Case ID: ${m[1]}.`,
      severity,
      alias_match: name,
    }));
  } catch { return []; }
}

// 31. 36th District Court Detroit
export async function scan36thDistrict(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://36thdistrictcourt.org/case-search?name=${encodeURIComponent(name)}`,
    "36th District Court Detroit",
    "Court Records",
    "high",
    "Detroit District Court",
    name,
    "https://36thdistrictcourt.org",
    /href="(\/case[^"]+)"[^>]*>([^<]+)</g
  );
}

// 32. Wayne 3rd Circuit Court
export async function scanWayne3rd(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://cmspublic.3rdcc.org/CaseSearch.aspx?name=${encodeURIComponent(name)}`,
    "Wayne County 3rd Circuit Court",
    "Court Records",
    "high",
    "Wayne Circuit",
    name,
    "https://cmspublic.3rdcc.org/",
    /href="(CaseDetail\.aspx\?[^"]+)"[^>]*>([^<]+)</g
  );
}

// 33. Oakland 6th Circuit
export async function scanOakland6th(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://courtexplorer.oakgov.com/CaseSearch?name=${encodeURIComponent(name)}`,
    "Oakland County 6th Circuit",
    "Court Records",
    "high",
    "Oakland Circuit",
    name,
    "https://courtexplorer.oakgov.com/",
    /href="(CaseDetail\?[^"]+)"[^>]*>([^<]+)</g
  );
}

// 34. Macomb 16th Circuit
export async function scanMacomb16th(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://circuitcourtcasesearch.macombgov.org/Search?name=${encodeURIComponent(name)}`,
    "Macomb County 16th Circuit",
    "Court Records",
    "high",
    "Macomb Circuit",
    name,
    "https://circuitcourtcasesearch.macombgov.org/",
    /href="(CaseDetail[^"]+)"[^>]*>([^<]+)</g
  );
}

// 35. Washtenaw County
export async function scanWashtenaw(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://co.washtenaw.mi.us/searchcase?name=${encodeURIComponent(name)}`,
    "Washtenaw County Courts",
    "Court Records",
    "high",
    "Washtenaw Court",
    name,
    "https://co.washtenaw.mi.us/",
    /href="(searchcasedetail[^"]+)"[^>]*>([^<]+)</g
  );
}

// 36. Kent County 17th Circuit (Grand Rapids)
export async function scanKent17th(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://courts.accesskent.com/CaseSearch.aspx?name=${encodeURIComponent(name)}`,
    "Kent County 17th Circuit (Grand Rapids)",
    "Court Records",
    "high",
    "Kent Circuit",
    name,
    "https://courts.accesskent.com/",
    /href="(CaseDetail\.aspx\?[^"]+)"[^>]*>([^<]+)</g
  );
}

// 37. Genesee 7th Circuit
export async function scanGenesee7th(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://www.geneseecountymi.gov/courts/7thcircuit/search?name=${encodeURIComponent(name)}`,
    "Genesee County 7th Circuit",
    "Court Records",
    "high",
    "Genesee Circuit",
    name,
    "https://www.geneseecountymi.gov/",
    /href="(\/courts\/7thcircuit\/case[^"]+)"[^>]*>([^<]+)</g
  );
}

// 38. Wayne County Register of Deeds
export async function scanWayneROD(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://wcrodportal.waynecounty.com/Search/SearchByName?name=${encodeURIComponent(name)}`,
    "Wayne County Register of Deeds",
    "Property Records",
    "info",
    "Wayne ROD",
    name,
    "https://wcrodportal.waynecounty.com/",
    /href="(Detail\?[^"]+)"[^>]*>([^<]+)</g
  );
}

// 39. Oakland Register of Deeds (Super Index)
export async function scanOaklandROD(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://www.oakgov.com/Apps/ROD/SuperIndex.aspx?name=${encodeURIComponent(name)}`,
    "Oakland County Register of Deeds",
    "Property Records",
    "info",
    "Oakland ROD",
    name,
    "https://www.oakgov.com/",
    /href="(\/Apps\/ROD\/Detail[^"]+)"[^>]*>([^<]+)</g
  );
}

// 40. Macomb Register of Deeds
export async function scanMacombROD(name: string): Promise<IntelHit[]> {
  return scrapeAnchors(
    `https://rodonlinesearch.macombgov.org/Search/SearchByName?name=${encodeURIComponent(name)}`,
    "Macomb County Register of Deeds",
    "Property Records",
    "info",
    "Macomb ROD",
    name,
    "https://rodonlinesearch.macombgov.org/",
    /href="(Detail[^"]+)"[^>]*>([^<]+)</g
  );
}
