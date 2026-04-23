// Mortgage Radar daily scanner — FCRA-clean pre-trigger mortgage signals
// Sources (all public/behavioral, NOT bureau): BSEED permits, MI SOS new LLCs,
// county foreclosure/lis pendens, FSBO, divorce filings, property-tax cures,
// job changes. Property-level dedup: repeat signals on the same address roll
// up into one lead with a higher score and full signal_history.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

interface RawSignal {
  full_name?: string;
  address?: string;
  city?: string;
  zip?: string;
  signal_type: string;
  signal_source: string;
  signal_detail?: string;
  signal_url?: string;
  signal_date?: string;
  estimated_equity?: number;
  estimated_loan_amount?: number;
}

const BASE_SCORES: Record<string, number> = {
  renovation_permit: 9,
  kitchen_addition_permit: 9,
  fsbo_listing: 8,
  lis_pendens: 9,
  foreclosure_notice: 9,
  divorce_filing: 7,
  new_llc_self_employed: 6,
  property_tax_cure: 7,
  high_equity_low_rate: 6,
  job_change_high_income: 7,
};

const OPENERS: Record<string, { opener: string; window: string }> = {
  renovation_permit: {
    opener: "Hey {name} — saw the permit on the {address} project. A lot of folks doing this size of reno are pulling cash out instead of using a HELOC. Happy to run numbers on both, no pressure.",
    window: "11am–1pm or 5pm–7pm",
  },
  fsbo_listing: {
    opener: "Hi {name} — saw your home is for sale by owner. When the next purchase comes around I help local buyers structure financing and lock in rates early. Worth 5 min when you're ready?",
    window: "5pm–8pm weekdays / weekends",
  },
  lis_pendens: {
    opener: "Hi {name} — I work with families in this exact spot. There are 2–3 refi options that can stop the clock if we move in the next couple weeks. Can I send the comparison?",
    window: "9am–11am",
  },
  foreclosure_notice: {
    opener: "Hi {name} — I work with families in this exact spot. There are 2–3 refi options that can stop the clock if we move in the next couple weeks. Can I send the comparison?",
    window: "9am–11am",
  },
  divorce_filing: {
    opener: "Hi {name} — when something like this comes up, the mortgage piece is usually the last thing handled. I can quietly pre-qualify you for a buyout refi so you have options on the table.",
    window: "lunch hour or 6pm+",
  },
  new_llc_self_employed: {
    opener: "Hi {name} — congrats on the new business. Most lenders want 2 yrs of self-employed tax returns; I work with bank-statement loans that get around that. Want me to run numbers?",
    window: "10am–noon",
  },
  property_tax_cure: {
    opener: "Hi {name} — saw the tax position get cured. If the cash came out of savings and you'd rather rebuild reserves, a quick cash-out refi might make sense. 5 min call?",
    window: "5pm–7pm",
  },
  high_equity_low_rate: {
    opener: "Hi {name} — your home has a lot of trapped equity right now. If you're sitting on a sub-4 rate I have a couple of HELOC options that don't touch the first mortgage.",
    window: "afternoon",
  },
  job_change_high_income: {
    opener: "Hi {name} — congrats on the move. New role often means relocation or a step-up purchase. I help structure financing before the listing rush. Worth 10 min?",
    window: "lunch or evening",
  },
};

function scoreFor(signal_type: string): number {
  return BASE_SCORES[signal_type] ?? 5;
}

function openerFor(signal_type: string): { opener: string; window: string } {
  return OPENERS[signal_type] ?? {
    opener: "Hi {name} — saw a public record on {address} and thought it might be worth a quick mortgage chat.",
    window: "10am–6pm local",
  };
}

// === SOURCES ===

async function scanBSEEDPermits(): Promise<RawSignal[]> {
  try {
    const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BSEED_Trades_Permits/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=100&f=json&orderByFields=ISSUED_DATE+DESC";
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    const out: RawSignal[] = [];
    for (const f of (j.features || [])) {
      const a = f.attributes || {};
      const desc = String(a.WORK_DESCRIPTION || a.SCOPE_OF_WORK || "").toLowerCase();
      const isReno = /kitchen|addition|remodel|bath|whole house|finish basement|roof/.test(desc);
      if (!isReno) continue;
      out.push({
        address: a.SITE_ADDRESS || a.ADDRESS || "",
        city: a.SITE_CITY || "Detroit",
        zip: String(a.SITE_ZIP || a.ZIP || "").slice(0, 5) || undefined,
        signal_type: "renovation_permit",
        signal_source: "BSEED",
        signal_detail: String(a.WORK_DESCRIPTION || "Renovation permit").slice(0, 200),
        signal_date: a.ISSUED_DATE ? new Date(a.ISSUED_DATE).toISOString().slice(0, 10) : undefined,
      });
    }
    return out.slice(0, 50);
  } catch (e) {
    console.warn("[scanBSEEDPermits]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Sonar OSINT helper — used for FSBO, foreclosure, divorce, SOS, job changes.
// Cheap, returns JSON. Falls back to [] gracefully if not configured.
async function sonarSearch(prompt: string, schemaHint: string): Promise<any[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are a public-records OSINT researcher. Return ONLY a valid JSON array (no prose, no markdown fence). Each item: ${schemaHint}. Empty array if nothing found. Public sources only — no credit bureau data.` },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn("[sonarSearch]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanForeclosureNotices(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find recent (last 14 days) lis pendens / foreclosure notices filed in Wayne, Oakland, or Macomb County Michigan public records. Include homeowner name, property address, city, ZIP, filing date, and source URL. Public county recorder data only.",
    `{ "full_name": string, "address": string, "city": string, "zip": string, "signal_date": "YYYY-MM-DD", "signal_url": string, "signal_detail": string }`,
  );
  return items.map((i: any) => ({
    full_name: i.full_name || undefined,
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "lis_pendens",
    signal_source: "CountyRecorder",
    signal_detail: i.signal_detail || "Foreclosure / lis pendens filing",
    signal_url: i.signal_url || undefined,
    signal_date: i.signal_date || undefined,
  })).filter(s => s.address);
}

async function scanFSBOListings(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find current For Sale By Owner (FSBO) home listings in Metro Detroit (Wayne, Oakland, Macomb counties) Michigan. Sources: Zillow FSBO, Craigslist real estate by-owner, ForSaleByOwner.com. Include owner name if shown, full property address, city, ZIP, listing URL.",
    `{ "full_name": string, "address": string, "city": string, "zip": string, "signal_url": string, "signal_detail": string }`,
  );
  return items.map((i: any) => ({
    full_name: i.full_name || undefined,
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "fsbo_listing",
    signal_source: "FSBO",
    signal_detail: i.signal_detail || "For sale by owner listing",
    signal_url: i.signal_url || undefined,
    signal_date: new Date().toISOString().slice(0, 10),
  })).filter(s => s.address);
}

async function scanDivorceFilings(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find recent (last 30 days) divorce / dissolution-of-marriage filings in Wayne, Oakland, or Macomb County Michigan circuit court public records. Include petitioner name, last-known property address if available, city, ZIP, filing date, source URL.",
    `{ "full_name": string, "address": string, "city": string, "zip": string, "signal_date": "YYYY-MM-DD", "signal_url": string, "signal_detail": string }`,
  );
  return items.map((i: any) => ({
    full_name: i.full_name || undefined,
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "divorce_filing",
    signal_source: "CircuitCourt",
    signal_detail: i.signal_detail || "Divorce filing",
    signal_url: i.signal_url || undefined,
    signal_date: i.signal_date || undefined,
  })).filter(s => s.address);
}

async function scanNewMichiganLLCs(sb: ReturnType<typeof createClient>): Promise<RawSignal[]> {
  // Pull from existing industry_pulse_signals where signal_type='new_business' and not yet flagged
  try {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data } = await (sb.from as any)("industry_pulse_signals")
      .select("entity_name, address, city, zip, signal_url, detected_at")
      .eq("signal_type", "new_business")
      .gte("detected_at", since)
      .limit(50);
    return (data || []).map((r: any) => ({
      full_name: r.entity_name || undefined,
      address: r.address || "",
      city: r.city || undefined,
      zip: typeof r.zip === "string" ? r.zip.slice(0, 5) : undefined,
      signal_type: "new_llc_self_employed",
      signal_source: "MI_SOS",
      signal_detail: `New Michigan LLC: ${r.entity_name || "(name pending)"}`,
      signal_url: r.signal_url || undefined,
      signal_date: r.detected_at ? new Date(r.detected_at).toISOString().slice(0, 10) : undefined,
    })).filter((s: RawSignal) => s.address);
  } catch (e) {
    console.warn("[scanNewMichiganLLCs]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanJobChanges(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find recent (last 14 days) public LinkedIn or press-release announcements of executive / professional job changes (Director+, $100k+ roles) at Metro Detroit companies. Include person name, new employer, city, ZIP if known, source URL. Note: address may not be available — if not, set address to the new employer's office address.",
    `{ "full_name": string, "address": string, "city": string, "zip": string, "signal_url": string, "signal_detail": string }`,
  );
  return items.map((i: any) => ({
    full_name: i.full_name || undefined,
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "job_change_high_income",
    signal_source: "Sonar_LinkedIn",
    signal_detail: i.signal_detail || "Executive job change",
    signal_url: i.signal_url || undefined,
    signal_date: new Date().toISOString().slice(0, 10),
  })).filter(s => s.address);
}

async function notifyClients(sb: ReturnType<typeof createClient>, zip: string | undefined, score: number): Promise<string[]> {
  if (!zip || score < 7) return [];
  const { data: clients } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, zip_codes")
    .eq("active", true);
  const matched = (clients || []).filter((c: any) => Array.isArray(c.zip_codes) && c.zip_codes.includes(zip));
  return matched.map((c: any) => c.id);
}

// Property-level dedup: address + zip is the unique key.
// If the same property emits a new signal type, score is bumped (capped 10),
// and the new signal is appended to signal_history.
async function upsertWithDedup(sb: ReturnType<typeof createClient>, s: RawSignal): Promise<{ id: string; created: boolean } | null> {
  if (!s.address) return null;
  const baseScore = scoreFor(s.signal_type);
  const { opener, window } = openerFor(s.signal_type);

  const lookupAddress = s.address.toLowerCase();
  const { data: existing } = await (sb.from as any)("mortgage_radar_leads")
    .select("id, score, signal_count, signal_history, signal_type")
    .eq("zip", s.zip || "")
    .ilike("address", s.address)
    .maybeSingle();

  if (existing) {
    // Same property, new signal — bump score, append history (only if signal type is new or > 30 days old)
    const history: any[] = Array.isArray(existing.signal_history) ? existing.signal_history : [];
    const alreadyLogged = history.some((h: any) =>
      h.signal_type === s.signal_type &&
      h.signal_date === (s.signal_date || null)
    );
    if (alreadyLogged) return { id: existing.id, created: false };

    history.push({
      signal_type: s.signal_type,
      signal_source: s.signal_source,
      signal_detail: s.signal_detail || null,
      signal_date: s.signal_date || null,
      detected_at: new Date().toISOString(),
    });

    // Repeat signal on same property = stronger intent. Bump by +1, capped at 10.
    const newScore = Math.min(10, Math.max(existing.score, baseScore) + 1);

    await (sb.from as any)("mortgage_radar_leads")
      .update({
        score: newScore,
        signal_count: (existing.signal_count || 1) + 1,
        signal_history: history,
        last_signal_at: new Date().toISOString(),
        // Keep latest signal as the "headline"
        signal_type: s.signal_type,
        signal_source: s.signal_source,
        signal_detail: s.signal_detail || null,
        signal_url: s.signal_url || null,
        signal_date: s.signal_date || null,
        suggested_opener: opener,
        best_call_window: window,
      })
      .eq("id", existing.id);
    return { id: existing.id, created: false };
  }

  // New property — insert
  const row = {
    full_name: s.full_name || null,
    address: s.address,
    city: s.city || null,
    state: "MI",
    zip: s.zip || null,
    signal_type: s.signal_type,
    signal_source: s.signal_source,
    signal_detail: s.signal_detail || null,
    signal_url: s.signal_url || null,
    signal_date: s.signal_date || null,
    estimated_equity: s.estimated_equity || null,
    estimated_loan_amount: s.estimated_loan_amount || null,
    score: baseScore,
    signal_count: 1,
    last_signal_at: new Date().toISOString(),
    signal_history: [{
      signal_type: s.signal_type,
      signal_source: s.signal_source,
      signal_detail: s.signal_detail || null,
      signal_date: s.signal_date || null,
      detected_at: new Date().toISOString(),
    }],
    suggested_opener: opener,
    best_call_window: window,
    raw: s as unknown as Record<string, unknown>,
  };
  const { data: ins, error } = await (sb.from as any)("mortgage_radar_leads")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) {
    // Race: another concurrent insert. Fall back to upsert lookup.
    if (String(error.message || "").includes("duplicate")) {
      const { data: again } = await (sb.from as any)("mortgage_radar_leads")
        .select("id").eq("zip", s.zip || "").ilike("address", s.address).maybeSingle();
      return again ? { id: again.id, created: false } : null;
    }
    console.warn("[upsertWithDedup] insert error:", error.message);
    return null;
  }
  return ins ? { id: ins.id, created: true } : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();

  const results = await Promise.allSettled([
    scanBSEEDPermits(),
    scanForeclosureNotices(),
    scanFSBOListings(),
    scanDivorceFilings(),
    scanNewMichiganLLCs(sb),
    scanJobChanges(),
  ]);

  const signals: RawSignal[] = [];
  const sourceBreakdown: Record<string, number> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const s of r.value) {
        signals.push(s);
        sourceBreakdown[s.signal_source] = (sourceBreakdown[s.signal_source] || 0) + 1;
      }
    } else {
      console.warn("[scanner] source rejected:", r.reason);
    }
  }

  let inserted = 0;
  let updated = 0;
  let alertsQueued = 0;
  for (const s of signals) {
    const res = await upsertWithDedup(sb, s);
    if (!res) continue;
    if (res.created) inserted += 1; else updated += 1;

    const matchedClientIds = await notifyClients(sb, s.zip, scoreFor(s.signal_type));
    if (matchedClientIds.length > 0) {
      await (sb.from as any)("mortgage_radar_leads")
        .update({ notified_client_ids: matchedClientIds })
        .eq("id", res.id);
      alertsQueued += matchedClientIds.length;
    }
  }

  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `🏠 Mortgage Radar — ${inserted} new, ${updated} updated, ${alertsQueued} alerts`,
          html: `<p><strong>Mortgage Radar daily run</strong></p>
            <p>Started: ${startedAt}<br>Signals fetched: ${signals.length}<br>New leads: ${inserted}<br>Updated (repeat signals): ${updated}<br>Client alerts queued: ${alertsQueued}</p>
            <pre>${JSON.stringify(sourceBreakdown, null, 2)}</pre>`,
        }),
      });
    } catch (e) {
      console.warn("[mortgage-radar-scanner] digest send failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    started_at: startedAt,
    signals_fetched: signals.length,
    inserted,
    updated,
    alerts_queued: alertsQueued,
    source_breakdown: sourceBreakdown,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
