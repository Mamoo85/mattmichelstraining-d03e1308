// Property/parcel + professional/asset registries — 7 scanners
import { IntelHit, COMMON_FETCH, UA, splitName } from "./types.ts";

// 41. Genesee County parcel viewer (Flint)
export async function scanGeneseeParcel(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(OWNER) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services1.arcgis.com/Pf6Mq8h00rhV4i7L/arcgis/rest/services/Parcels_GeneseeCounty/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=ADDRESS,ZIP,OWNER,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Genesee County Property Records",
        source_url: "https://www.geneseecountymi.gov",
        category: "Property Records",
        title: `Genesee County Property — ${a.ADDRESS || "Unknown"}`,
        summary: `Owner: ${a.OWNER || name}. ${a.ADDRESS}, ${a.ZIP}. Sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "n/a"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 42. Washtenaw County parcel
export async function scanWashtenawParcel(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(OWNER1) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services1.arcgis.com/HQ2NboooZ8Lq3WXU/arcgis/rest/services/Tax_Parcels/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=PROPADDRESS,ZIP,OWNER1,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Washtenaw County Property",
        source_url: "https://www.washtenaw.org",
        category: "Property Records",
        title: `Washtenaw Property — ${a.PROPADDRESS || "Unknown"}`,
        summary: `Owner: ${a.OWNER1 || name}. ${a.PROPADDRESS}, ${a.ZIP || ""}. Sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "n/a"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 43. Kent County parcel (Grand Rapids)
export async function scanKentParcel(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(TAXPAYER) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services1.arcgis.com/8KS7P0Vg5I0jyjz5/arcgis/rest/services/Parcels/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=PROP_ADDR,PROP_ZIP,TAXPAYER,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Kent County Property (Grand Rapids)",
        source_url: "https://www.accesskent.com",
        category: "Property Records",
        title: `Kent County Property — ${a.PROP_ADDR || "Unknown"}`,
        summary: `Owner: ${a.TAXPAYER || name}. ${a.PROP_ADDR}, ${a.PROP_ZIP || ""}. Sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "n/a"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 44. Detroit Land Bank Authority dispositions
export async function scanDLBA(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(buyer_name) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_auction_sales/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=buyer_name,address,sale_closed_date,sale_price&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Detroit Land Bank Authority",
        source_url: "https://buildingdetroit.org",
        category: "Property Records",
        title: `DLBA Acquisition — ${a.address || "Detroit"}`,
        summary: `Buyer: ${a.buyer_name || name}. Closed: ${a.sale_closed_date ? new Date(a.sale_closed_date).toLocaleDateString() : "n/a"} for $${Number(a.sale_price || 0).toLocaleString()}.`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 45. NPI Registry (medical providers)
export async function scanNPI(name: string): Promise<IntelHit[]> {
  try {
    const { first, last } = splitName(name);
    if (!last) return [];
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&limit=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results || [];
    return items.slice(0, 5).map((r: any): IntelHit => {
      const basic = r.basic || {};
      const taxonomy = (r.taxonomies || [])[0] || {};
      const addr = (r.addresses || [])[0] || {};
      return {
        source: "NPI Registry (CMS)",
        source_url: `https://npiregistry.cms.hhs.gov/provider-view/${r.number}`,
        category: "Government Records",
        title: `NPI Provider — ${basic.first_name || ""} ${basic.last_name || ""}`.trim(),
        summary: `NPI #${r.number}. Specialty: ${taxonomy.desc || "n/a"}. State: ${addr.state || "n/a"}. Status: ${basic.status || "active"}.`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// 46. FAA Airmen / Aircraft owner
export async function scanFAA(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://amsrvs.registry.faa.gov/airmeninquiry/Main.aspx?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/g)].slice(1, 5);
    return matches.map((m): IntelHit => ({
      source: "FAA Airmen Registry",
      source_url: "https://amsrvs.registry.faa.gov/airmeninquiry/",
      category: "Government Records",
      title: `FAA Airman — ${m[1].trim()}`,
      summary: `Address: ${m[2].trim()}. Certificate: ${m[3].trim()}.`,
      severity: "info",
      alias_match: name,
    }));
  } catch { return []; }
}

// 47. USPTO Trademark Assignment
export async function scanUSPTO(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://assignment-api.uspto.gov/trademark/lookup?query=${encodeURIComponent(name)}&searchText=${encodeURIComponent(name)}&rows=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.results?.docs || [];
    return items.slice(0, 5).map((r: any): IntelHit => ({
      source: "USPTO Trademark Assignments",
      source_url: r.url || "https://assignment.uspto.gov/trademark/",
      category: "Business Records",
      title: `Trademark — ${r.markText || r.serialNumber || "n/a"}`,
      summary: `Reel/Frame: ${r.reelFrame || "n/a"}. Conveyance: ${r.conveyance || "n/a"}. Date: ${r.executionDate || "n/a"}.`,
      date: r.executionDate,
      severity: "info",
      alias_match: name,
    }));
  } catch { return []; }
}
