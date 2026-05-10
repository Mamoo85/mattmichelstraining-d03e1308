// Open-source intelligence aggregates — 3 scanners
import { IntelHit, COMMON_FETCH, UA } from "./types.ts";

// 48. OpenSanctions (PEPs + global sanctions, unified)
export async function scanOpenSanctions(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://api.opensanctions.org/search/default?q=${encodeURIComponent(name)}&limit=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || [];
    return items.slice(0, 5).map((r: any): IntelHit => ({
      source: "OpenSanctions (consolidated PEPs/sanctions)",
      source_url: `https://www.opensanctions.org/entities/${r.id}`,
      category: "Government Records",
      title: `OpenSanctions — ${r.caption || r.name || r.id}`,
      summary: `Datasets: ${(r.datasets || []).slice(0, 3).join(", ")}. Topics: ${(r.properties?.topics || []).slice(0, 3).join(", ")}. First seen: ${r.first_seen || "n/a"}.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 49. ICIJ Offshore Leaks DB
export async function scanICIJ(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://offshoreleaks.icij.org/search?q=${encodeURIComponent(name)}&utf8=%E2%9C%93`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<a[^>]+href="(\/nodes\/\d+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 5);
    return matches.map((m): IntelHit => ({
      source: "ICIJ Offshore Leaks (Panama/Pandora/Paradise)",
      source_url: `https://offshoreleaks.icij.org${m[1]}`,
      category: "Financial Records",
      title: `Offshore Leak — ${m[2].trim()}`,
      summary: `Named entity in ICIJ Offshore Leaks database.`,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

// 50. GDELT Global News (free, optional key)
export async function scanGDELT(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`"${name}"`)}&mode=ArtList&format=json&maxrecords=10&sort=DateDesc`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.articles || [];
    return items.slice(0, 5).map((a: any): IntelHit => ({
      source: "GDELT Global News",
      source_url: a.url,
      category: "News & Public Notices",
      title: `News — ${a.title || "Article"}`,
      summary: `Domain: ${a.domain || "n/a"}. Tone: ${a.tone || "n/a"}. Date: ${a.seendate || "n/a"}.`,
      date: a.seendate,
      severity: "low",
      alias_match: name,
    }));
  } catch { return []; }
}
