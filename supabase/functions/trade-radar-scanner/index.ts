// Trade Radar daily scanner — 7 trade verticals, Michigan-first then nationwide.
// Reuses the same anti-hallucination gate as mortgage-radar-scanner.
// POST { vertical?: "roofing"|"hvac"|"plumbing"|"electrical"|"pest_control"|"gutters"|"painting"|"all" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLead, quarantineRaw } from "../_shared/anti-hallucination.ts";
import { sendSMS } from "../_shared/twilio.ts";
import { dwaEmail, dwaWrap } from "../_shared/dwa-email.ts";
import { scanSignals as scanRoofing } from "../_shared/trade-signals/signals-roofing.ts";
import { scanSignals as scanHvac } from "../_shared/trade-signals/signals-hvac.ts";
import { scanSignals as scanPlumbing } from "../_shared/trade-signals/signals-plumbing.ts";
import { scanSignals as scanElectrical } from "../_shared/trade-signals/signals-electrical.ts";
import { scanSignals as scanPestControl } from "../_shared/trade-signals/signals-pest_control.ts";
import { scanSignals as scanGutters } from "../_shared/trade-signals/signals-gutters.ts";
import { scanSignals as scanPainting } from "../_shared/trade-signals/signals-painting.ts";
import { fetchFreshBusinessSignals, fetchMortgageSignals, fetchHireSignals } from "../_shared/signal-waterfall.ts";

// NAICS code per vertical (used to filter registry-driven signals)
const VERTICAL_NAICS: Record<string, string> = {
  roofing: "238160",
  hvac: "238220",
  plumbing: "238220",
  electrical: "238210",
  pest_control: "561710",
  gutters: "238160",
  painting: "238320",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE_NUMBER") || "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const ALL_VERTICALS = ["roofing", "hvac", "plumbing", "electrical", "pest_control", "gutters", "painting"] as const;
type Vertical = typeof ALL_VERTICALS[number];

// County → region map (verbatim from mortgage scanner)
const COUNTY_TO_REGION: Record<string, string> = {
  Wayne: "Southeast Michigan", Oakland: "Southeast Michigan", Macomb: "Southeast Michigan",
  Washtenaw: "Southeast Michigan", Monroe: "Southeast Michigan", Livingston: "Southeast Michigan",
  "St. Clair": "Southeast Michigan", Lenawee: "Southeast Michigan",
  Kent: "West Michigan", Ottawa: "West Michigan", Kalamazoo: "West Michigan",
  Muskegon: "West Michigan", Allegan: "West Michigan",
  Ingham: "Mid-Michigan", Eaton: "Mid-Michigan", Genesee: "Mid-Michigan",
  Saginaw: "Mid-Michigan", Bay: "Mid-Michigan",
  "Grand Traverse": "Northern Michigan", Emmet: "Northern Michigan",
  Lapeer: "East Michigan", Tuscola: "East Michigan", Sanilac: "East Michigan",
  Marquette: "Upper Peninsula", Chippewa: "Upper Peninsula", Delta: "Upper Peninsula",
};

function inferCounty(city?: string): string | undefined {
  if (!city) return undefined;
  const c = city.toLowerCase().trim();
  if (/\b(detroit|dearborn|livonia|westland|taylor|southgate|wyandotte|trenton|hamtramck|highland park|redford|canton|plymouth|grosse pointe)\b/.test(c)) return "Wayne";
  if (/\b(troy|royal oak|birmingham|bloomfield|pontiac|southfield|farmington|novi|ferndale|auburn hills|rochester|waterford|west bloomfield|clarkston)\b/.test(c)) return "Oakland";
  if (/\b(sterling heights|warren|clinton township|mount clemens|utica|shelby township|chesterfield|eastpointe|roseville|st clair shores|fraser)\b/.test(c)) return "Macomb";
  if (/\b(ann arbor|ypsilanti|saline|chelsea|dexter)\b/.test(c)) return "Washtenaw";
  if (/\b(grand rapids|kentwood|wyoming|walker|grandville)\b/.test(c)) return "Kent";
  if (/\b(lansing|east lansing|meridian|okemos|holt)\b/.test(c)) return "Ingham";
  if (/\b(flint|burton|grand blanc|flushing|davison)\b/.test(c)) return "Genesee";
  return undefined;
}

function inferRegion(county?: string): string | undefined {
  if (!county) return undefined;
  return COUNTY_TO_REGION[county];
}

async function upsertWithDedup(
  sb: ReturnType<typeof createClient>,
  vertical: Vertical,
  signal: any,
): Promise<"inserted" | "updated" | "quarantined" | "skipped"> {
  // LLM score cap — same rule as mortgage scanner
  const rawScore = signal.score ?? 5;
  const score = signal.source_method === "llm_search" ? Math.min(3, rawScore) : rawScore;

  // Anti-hallucination gate
  const validation = await validateLead({
    address: signal.address,
    city: signal.city,
    zip: signal.zip,
    signal_type: signal.signal_type,
    source_method: signal.source_method ?? "scraper",
  });

  if (!validation.valid) {
    await quarantineRaw(sb, {
      table: "trade_radar_leads",
      vertical,
      raw: signal,
      reason: validation.reason ?? "validation_failed",
    });
    return "quarantined";
  }

  const county = inferCounty(signal.city);
  const region = inferRegion(county);

  // Check for existing lead (address+zip+vertical)
  const { data: existing } = await sb
    .from("trade_radar_leads")
    .select("id, score, signal_count")
    .eq("vertical", vertical)
    .eq("address", signal.address ?? "")
    .eq("zip", signal.zip ?? "")
    .maybeSingle();

  if (existing) {
    await sb.from("trade_radar_leads").update({
      score: Math.min(10, existing.score + 1),
      signal_count: (existing.signal_count ?? 1) + 1,
      last_signal_at: new Date().toISOString(),
      signal_detail: signal.signal_detail,
      signal_type: signal.signal_type,
    }).eq("id", existing.id);
    return "updated";
  }

  const { error } = await sb.from("trade_radar_leads").insert({
    vertical,
    address: validation.formatted_address ?? signal.address,
    city: signal.city,
    zip: signal.zip,
    lat: validation.lat,
    lon: validation.lon,
    county,
    region,
    signal_type: signal.signal_type,
    signal_detail: signal.signal_detail,
    signal_date: signal.signal_date,
    score,
    suggested_opener: signal.suggested_opener,
    best_call_window: signal.best_call_window,
    estimated_value: signal.estimated_value,
    source_method: signal.source_method,
    raw_source_data: signal.raw_source_data,
    status: "new",
    signal_count: 1,
    last_signal_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return "skipped"; // unique conflict — already exists
    console.error(`[trade-scanner] insert error (${vertical}):`, error.message);
    return "skipped";
  }
  return "inserted";
}

async function notifyClients(
  sb: ReturnType<typeof createClient>,
  vertical: Vertical,
  leads: any[],
): Promise<void> {
  if (!leads.length) return;

  const { data: clients } = await sb
    .from("trade_radar_clients")
    .select("id, email, contact_name, business_name, phone, zip_codes")
    .eq("vertical", vertical)
    .eq("active", true);

  if (!clients?.length) return;

  const VERTICAL_LABELS: Record<string, string> = {
    roofing: "Roofing", hvac: "HVAC", plumbing: "Plumbing",
    electrical: "Electrical", pest_control: "Pest Control",
    gutters: "Gutters", painting: "Painting",
  };
  const label = VERTICAL_LABELS[vertical] ?? vertical;

  for (const client of clients) {
    const clientZips = new Set<string>(client.zip_codes ?? []);
    const filtered = clientZips.size
      ? leads.filter((l) => !l.zip || clientZips.has(l.zip))
      : leads;
    const top5 = filtered.slice(0, 5);
    if (!top5.length) continue;

    const name = client.contact_name || client.business_name || "there";
    const top = top5[0];

    const cards = top5.map((l: any) => {
      const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
      const sig = (l.signal_type ?? "").replace(/_/g, " ");
      const addr = [l.address, l.city, l.zip].filter(Boolean).join(", ");
      const searchQ = l.address
        ? encodeURIComponent(`${l.address} ${l.city ?? ""} owner contact`)
        : encodeURIComponent(`${l.city ?? ""} ${label} lead`);
      return `<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:${scoreColor};font-size:22px;font-weight:700;">${l.score ?? "?"}/10</span>
          <span style="color:#64748b;font-size:11px;text-transform:uppercase;">${sig}</span>
        </div>
        <p style="color:#f1f5f9;font-weight:600;margin:8px 0 4px;">${addr || "Area lead"}</p>
        ${l.signal_detail ? `<p style="color:#cbd5e1;font-size:12px;margin:4px 0;">${l.signal_detail}</p>` : ""}
        ${l.suggested_opener ? `<p style="color:#e2e8f0;font-size:12px;font-style:italic;margin:8px 0;">"${l.suggested_opener}"</p>` : ""}
        <a href="https://www.google.com/search?q=${searchQ}" style="display:inline-block;margin-top:8px;padding:6px 12px;background:#0f172a;color:#00d4ff;border:1px solid #00d4ff;border-radius:4px;font-size:11px;text-decoration:none;">🔍 Find Contact</a>
      </div>`;
    }).join("\n");

    const innerHtml = `
      <h2 style="color:#00d4ff;font-size:18px;margin:0 0 8px;">${label} Radar — ${top5.length} new lead${top5.length > 1 ? "s" : ""} today</h2>
      <p style="color:#94a3b8;margin:0 0 20px;">Hi ${name}, here are today's top ${label.toLowerCase()} signals in your market.</p>
      ${cards}
      <p style="color:#64748b;font-size:11px;margin-top:16px;">${leads.length} total leads scanned today · ${label} Radar by Detroit Web Agency</p>`;

    const subject = `🏠 ${top5.length} new ${label.toLowerCase()} lead${top5.length > 1 ? "s" : ""} in your ZIPs — top score ${top.score ?? "?"}/10`;

    await dwaEmail({
      to: client.email,
      subject,
      html: dwaWrap(innerHtml),
    });

    if (client.phone && top.score >= 9) {
      await sendSMS(
        client.phone,
        TWILIO_FROM,
        `🏠 ${label} Radar: ${top5.length} new leads today. Top score: ${top.score}/10 — ${top.city ?? "your area"}. Check your email. — Detroit Web Agency`,
        "trade_radar",
      ).catch((e) => console.warn(`[trade-scanner] hot-lead SMS failed:`, e instanceof Error ? e.message : String(e)));
    }
  }
}

const SCANNERS: Record<Vertical, (state: string, zips?: string[]) => Promise<any[]>> = {
  roofing: scanRoofing,
  hvac: scanHvac,
  plumbing: scanPlumbing,
  electrical: scanElectrical,
  pest_control: scanPestControl,
  gutters: scanGutters,
  painting: scanPainting,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), { status: 500 });
  }

  let body: { vertical?: string; state?: string; initial?: boolean } = {};
  try { body = await req.json(); } catch { /* default */ }

  const requestedVertical = body.vertical ?? "all";
  const state = body.state ?? "MI";
  const verticals: Vertical[] = requestedVertical === "all"
    ? [...ALL_VERTICALS]
    : ALL_VERTICALS.includes(requestedVertical as Vertical)
      ? [requestedVertical as Vertical]
      : [];

  if (!verticals.length) {
    return new Response(JSON.stringify({ error: `Unknown vertical: ${requestedVertical}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const summary: Record<string, { inserted: number; updated: number; quarantined: number; skipped: number; notified: number }> = {};

  for (const vertical of verticals) {
    const stats = { inserted: 0, updated: 0, quarantined: 0, skipped: 0, notified: 0 };
    summary[vertical] = stats;

    try {
      const rawSignals = await SCANNERS[vertical](state);

      // Augment with registry-driven signals (FEMA storms, EPA, OSHA, HMDA, fresh LLCs).
      try {
        const naics = VERTICAL_NAICS[vertical] || "238220";
        // Mortgage waterfall: FEMA+NOAA+HMDA+EPA — useful for weather/property-driven trades
        const MORTGAGE_WATERFALL_VERTICALS = ["roofing", "gutters", "painting", "pest_control", "hvac", "plumbing"];
        // Hire waterfall: OSHA inspections — useful for electricians targeting renovation sites
        const HIRE_WATERFALL_VERTICALS = ["electrical"];
        const [biz, env] = await Promise.all([
          fetchFreshBusinessSignals(sb, { state, naics }).catch(() => []),
          MORTGAGE_WATERFALL_VERTICALS.includes(vertical)
            ? fetchMortgageSignals(sb, { state, days: 14 }).catch(() => [])
            : HIRE_WATERFALL_VERTICALS.includes(vertical)
              ? fetchHireSignals(sb, { state, naics }).catch(() => [])
              : Promise.resolve([]),
        ]);
        for (const s of [...(biz || []), ...(env || [])].slice(0, 100)) {
          const a = s as any;
          rawSignals.push({
            address: a.address,
            city: a.city,
            zip: a.zip,
            signal_type: a.type || "registry_signal",
            signal_source: a.source || "registry",
            signal_detail: a.detail || a.description,
            signal_url: a.url,
            signal_date: a.date || new Date().toISOString(),
            source_method: "registry",
            score: 4,
          });
        }
      } catch (e) {
        console.warn(`[trade-scanner] ${vertical} registry augment failed:`, e instanceof Error ? e.message : String(e));
      }

      const insertedLeads: any[] = [];

      for (const sig of rawSignals) {
        const result = await upsertWithDedup(sb, vertical, sig);
        if (result === "inserted") { stats.inserted++; insertedLeads.push(sig); }
        else if (result === "updated") stats.updated++;
        else if (result === "quarantined") stats.quarantined++;
        else stats.skipped++;
      }

      if (insertedLeads.length || body.initial) {
        // Fetch full leads for digest
        const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
        const { data: freshLeads } = await sb
          .from("trade_radar_leads")
          .select("*")
          .eq("vertical", vertical)
          .gte("created_at", since24h)
          .order("score", { ascending: false })
          .limit(10);

        if (freshLeads?.length) {
          await notifyClients(sb, vertical, freshLeads);
          stats.notified = freshLeads.length;
        }
      }
    } catch (e: unknown) {
      console.error(`[trade-scanner] ${vertical} error:`, e instanceof Error ? e.message : String(e));
    }
  }

  const totalInserted = Object.values(summary).reduce((n, s) => n + s.inserted, 0);
  if (totalInserted > 0) {
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_FROM,
      `🏠 Trade Radar: ${totalInserted} new leads across ${verticals.join(", ")} today. — DWA`,
      "trade_radar",
    ).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
