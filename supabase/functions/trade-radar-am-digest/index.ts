// Trade Radar AM Digest — daily 8am ET. For every active client across all 11
// verticals, sends a DWA-branded morning brief. ALWAYS sends, even on 0-lead
// days (shows the watch-list so subscribers see proof of work). One function,
// all 11 verticals.
//
// POST shapes:
//   {}                                → run all verticals, all clients
//   {"vertical": "roofing"}           → run only that vertical
//   {"test_sms": true}                → text Matt + Mitchell, one per vertical
//   {"test_sms": ["+1..."]}           → text custom list

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendSMS } from "../_shared/twilio.ts";
import { dwaEmail, dwaWrap } from "../_shared/dwa-email.ts";
import { wrapServe } from "../_shared/telemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const ALL_VERTICALS = [
  "roofing", "hvac", "plumbing", "electrical", "pest_control", "gutters",
  "exterior", "tree", "restoration", "demo_junk", "foundation",
] as const;
type Vertical = typeof ALL_VERTICALS[number];

const VERTICAL_LABELS: Record<Vertical, string> = {
  roofing: "Roofing Radar",
  hvac: "HVAC Radar",
  plumbing: "Plumbing Radar",
  electrical: "Electrical Radar",
  pest_control: "Pest Control Radar",
  gutters: "Gutters Radar",
  exterior: "Exterior Radar",
  tree: "Tree Service Radar",
  restoration: "Restoration Radar",
  demo_junk: "Demo & Junk Radar",
  foundation: "Foundation Radar",
};

// Watch-list shown on 0-lead days so subscribers see what's being monitored.
const VERTICAL_WATCHLIST: Record<Vertical, string[]> = {
  roofing: [
    "NOAA hail/wind storm alerts (live, all SE Michigan ZIPs)",
    "BSEED roof permits ($25k+ filings)",
    "FEMA disaster declarations",
    "Insurance claim filings (statewide)",
    "New homeowner records (closings ≤90 days)",
  ],
  hvac: [
    "EPA refrigerant leak reports",
    "BSEED HVAC mechanical permits",
    "Energy-utility rebate filings (DTE / Consumers)",
    "Real estate listings with 'old furnace/AC' language",
    "Heat-wave / cold-snap NOAA alerts",
  ],
  plumbing: [
    "Water main break reports (city / DPW)",
    "Sewer line repair permits",
    "Property transfer + age-of-home filter (>40 yrs)",
    "Mold + water damage insurance claims",
    "EPA lead-pipe replacement filings",
  ],
  electrical: [
    "OSHA renovation site inspections",
    "BSEED electrical permits",
    "EV charger install permits (utility filings)",
    "Solar interconnect applications",
    "Service panel upgrade requests (200A+)",
  ],
  pest_control: [
    "Restaurant health inspection violations",
    "BSEED demolition / debris permits",
    "Property transfer records (new homeowner pest checks)",
    "Termite swarm season alerts (NOAA temp + humidity)",
    "Multifamily housing complaint filings",
  ],
  gutters: [
    "NOAA heavy rain / wind alerts",
    "Roof permit filings (gutters often follow)",
    "Tree removal permits (gutter damage indicator)",
    "FEMA flood disaster declarations",
    "New homeowner records (closings ≤90 days)",
  ],
  exterior: [
    "NOAA hail/wind storm alerts (siding damage area signals)",
    "BSEED exterior/siding/window/paint permits",
    "Zillow FSBO listings (pre-sale exterior prep opportunity)",
    "Foreclosure notices (pre-REO exterior refresh)",
    "New homeowner records (closings ≤90 days)",
  ],
  tree: [
    "NOAA wind/storm alerts (tree hazard area signals)",
    "FEMA disaster declarations",
    "BSEED tree removal/trim/stump permits",
    "Detroit 311 tree service requests (Socrata)",
    "Estate sales (clearance of mature trees)",
  ],
  restoration: [
    "NOAA flood/flash-flood warnings (area signal)",
    "NOAA fire weather alerts (area signal)",
    "FEMA disaster declarations (flood/fire/storm)",
    "BSEED water damage / fire repair / mold remediation permits",
    "Heavy rain events (basement backup / sump failure)",
  ],
  demo_junk: [
    "BSEED demolition permits (per-address)",
    "Estate sales (day-after cleanout opportunity)",
    "Wayne/Oakland/Macomb probate filings",
    "Foreclosure notices (bank-owned cleanout)",
    "Detroit 311 bulk/debris pickup requests",
  ],
  foundation: [
    "FEMA flood zone / NFIP data (chronic hydrostatic risk)",
    "NOAA flood/heavy-rain events (area signal)",
    "FEMA disaster declarations (flood-type)",
    "OpenFEMA NFIP claims (repeat-payout zips)",
    "BSEED foundation/structural/waterproofing permits",
  ],
};

function buildStaticMapUrl(leads: any[]): string {
  if (!GOOGLE_MAPS_API_KEY) return "";
  const withCoords = leads.filter(l => l.lat != null && l.lon != null);
  if (withCoords.length === 0) return "";
  const markers = withCoords.map(l => {
    const color = l.score >= 9 ? "red" : l.score >= 7 ? "orange" : "yellow";
    return `markers=color:${color}|${l.lat},${l.lon}`;
  }).join("&");
  return `https://maps.googleapis.com/maps/api/staticmap?size=600x200&scale=2&${markers}&key=${GOOGLE_MAPS_API_KEY}`;
}

function daysOld(lead: any): number {
  const ref = lead.signal_date || lead.created_at;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
}

function buildSubject(vertical: Vertical, leadCount: number, topLead: any | null): string {
  const label = VERTICAL_LABELS[vertical];
  if (!leadCount || !topLead) {
    return `🏠 ${label} — Daily Brief: scanning your zips, no new signals (yet)`;
  }
  const city = topLead.city || "your market";
  const sig = (topLead.signal_type || "").replace(/_/g, " ");
  const dow = new Date().getDay();
  const variants = [
    `🏠 ${label}: ${leadCount} new lead${leadCount > 1 ? "s" : ""} — top score ${topLead.score}/10 in ${city}`,
    `🔥 ${label}: ${sig} signal in ${city} today (${leadCount} total)`,
    `🏠 ${leadCount} fresh ${label.toLowerCase().replace(" radar", "")} lead${leadCount > 1 ? "s" : ""} in your ZIPs — top: ${topLead.score}/10`,
  ];
  return variants[dow % variants.length];
}

function buildLeadCard(l: any, label: string): string {
  const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
  const sig = (l.signal_type ?? "").replace(/_/g, " ");
  const addr = [l.address, l.city, l.zip].filter(Boolean).join(", ");
  const age = daysOld(l);
  const ageBadge = age <= 1
    ? `<span style="color:#22c55e;font-size:10px;font-weight:700;">🟢 FRESH</span>`
    : age <= 7
      ? `<span style="color:#fbbf24;font-size:10px;font-weight:700;">⏳ ${age}d old</span>`
      : `<span style="color:#94a3b8;font-size:10px;font-weight:700;">📅 ${age}d old</span>`;
  const searchQ = l.address
    ? encodeURIComponent(`${l.address} ${l.city ?? ""} owner contact`)
    : encodeURIComponent(`${l.city ?? ""} ${label} lead`);
  const commHtml = l.estimated_value
    ? `<p style="margin:6px 0 0;color:#22c55e;font-size:12px;font-weight:600;">💵 Est. job value: $${Math.round(l.estimated_value).toLocaleString()}</p>`
    : "";
  return `<div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:10px;padding:16px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <span style="color:${scoreColor};font-size:22px;font-weight:800;">${l.score ?? "?"}/10</span>
        <span style="color:#64748b;font-size:11px;text-transform:uppercase;margin-left:10px;">${sig}</span>
      </div>
      ${ageBadge}
    </div>
    <p style="color:#f1f5f9;font-weight:700;margin:10px 0 4px;font-size:14px;">${addr || "Area lead"}</p>
    ${l.signal_detail ? `<p style="color:#cbd5e1;font-size:12px;margin:6px 0;line-height:1.5;">${l.signal_detail}</p>` : ""}
    ${commHtml}
    ${l.suggested_opener ? `<div style="margin:12px 0 8px;padding:10px 12px;background:#030711;border-left:2px solid #00d4ff;border-radius:4px;"><p style="margin:0 0 4px;color:#00d4ff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Suggested opener</p><p style="margin:0;color:#cbd5e1;font-size:12px;font-style:italic;">"${l.suggested_opener}"</p></div>` : ""}
    <a href="https://www.google.com/search?q=${searchQ}" style="display:inline-block;margin-top:8px;padding:7px 14px;background:#0f172a;color:#00d4ff;border:1px solid #00d4ff;border-radius:5px;font-size:11px;text-decoration:none;font-weight:600;">🔍 Find Contact</a>
  </div>`;
}

async function sendDigestForClient(
  sb: ReturnType<typeof createClient>,
  vertical: Vertical,
  client: any,
  since24h: string,
  since7d: string,
): Promise<{ sent: boolean; reason: string; leadCount: number }> {
  const label = VERTICAL_LABELS[vertical];
  const zips: string[] = Array.isArray(client.zip_codes) ? client.zip_codes : [];

  // Today's per-address leads — zip filter if client has zips, otherwise all
  let q = (sb.from as any)("trade_radar_leads")
    .select("*")
    .eq("vertical", vertical)
    .gte("created_at", since24h)
    .order("score", { ascending: false })
    .limit(5);
  if (zips.length > 0) q = q.in("zip", zips);

  const { data: leadsData } = await q;
  let leads: any[] = leadsData || [];

  // Fallback: if zip filter caught nothing but leads exist, surface them anyway
  if (leads.length === 0 && zips.length > 0) {
    const { data: fallback } = await (sb.from as any)("trade_radar_leads")
      .select("*")
      .eq("vertical", vertical)
      .gte("created_at", since24h)
      .order("score", { ascending: false })
      .limit(5);
    leads = fallback || [];
  }

  // Area signals (NOAA/FEMA/county-level) — always pull, shown when 0 per-address leads
  const { data: areaData } = await (sb.from as any)("trade_radar_area_signals")
    .select("alert_type, alert_detail, scope, scope_value, signal_date, source")
    .eq("vertical", vertical)
    .gte("created_at", since24h)
    .order("created_at", { ascending: false })
    .limit(5);
  const areaSignals: any[] = areaData || [];

  // Week count
  let weekQ = (sb.from as any)("trade_radar_leads")
    .select("id", { count: "exact", head: true })
    .eq("vertical", vertical)
    .gte("created_at", since7d);
  if (zips.length > 0) weekQ = weekQ.in("zip", zips);
  const { count: weekCount } = await weekQ;

  const name = client.contact_name || client.business_name || "there";
  const dashboardLink = `https://detroitwebagent.com/my-${vertical.replace("_", "-")}-radar?email=${encodeURIComponent(client.email)}`;

  let body: string;
  let subject: string;

  if (leads.length === 0) {
    const watchItems = VERTICAL_WATCHLIST[vertical]
      .map(w => `<li style="margin:6px 0;color:#cbd5e1;font-size:13px;">${w}</li>`).join("");

    // Build area-intel section when NOAA/FEMA/county signals fired even with no street-level leads
    const areaHtml = areaSignals.length > 0
      ? `<div style="margin:0 0 20px;background:#0d1f35;border:1px solid #1e4a6f;border-radius:8px;padding:16px;">
           <p style="margin:0 0 10px;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">📡 Market Intel — Active in Your Region</p>
           ${areaSignals.map(a => `
             <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #1e3a5f;">
               <p style="margin:0;color:#e2e8f0;font-size:13px;font-weight:600;">${a.alert_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
               <p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">${a.alert_detail ?? ""} · ${a.scope_value ?? a.scope}</p>
             </div>`).join("")}
         </div>`
      : "";

    subject = areaSignals.length > 0
      ? `🏠 ${label} — ${areaSignals.length} market signal${areaSignals.length > 1 ? "s" : ""} in your region`
      : buildSubject(vertical, 0, null);

    body = `
      <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🏠 ${label} — Morning Brief</p>
      <h1 style="color:#fff;font-size:22px;margin:10px 0 6px;line-height:1.3;">Good morning ${name}${areaSignals.length > 0 ? ` — ${areaSignals.length} regional signal${areaSignals.length > 1 ? "s" : ""} detected` : ` — a quiet day in your ${zips.length || "monitored"} ZIPs`}.</h1>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 18px;">${areaSignals.length > 0 ? "No individual property leads yet, but these market signals indicate activity in your area:" : `No new ${label.toLowerCase().replace(" radar", "")} signals fired in the last 24 hours. We're actively monitoring:`}</p>
      ${areaHtml}
      <ul style="margin:0 0 20px;padding-left:20px;background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px 16px 16px 36px;">
        ${watchItems}
      </ul>
      <p style="color:#94a3b8;font-size:12px;margin:18px 0 6px;">📊 This week so far: <strong style="color:#00d4ff;">${weekCount ?? 0}</strong> ${label.toLowerCase().replace(" radar", "")} signal${weekCount === 1 ? "" : "s"} surfaced in your market.</p>
      <p style="color:#64748b;font-size:11px;margin-top:16px;">${label} by Detroit Web Agency · You'll get an instant SMS the moment a 9/10+ signal fires.</p>`;
  } else {
    subject = buildSubject(vertical, leads.length, leads[0]);
    const mapUrl = buildStaticMapUrl(leads);
    const mapHtml = mapUrl
      ? `<div style="margin:0 0 20px;border-radius:8px;overflow:hidden;border:1px solid #1e3a5f;"><img src="${mapUrl}" alt="Lead map" width="600" style="display:block;width:100%;height:auto;"></div>`
      : "";
    const cards = leads.map((l: any) => buildLeadCard(l, label)).join("\n");
    body = `
      <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🏠 ${label} — Morning Brief</p>
      <h1 style="color:#fff;font-size:22px;margin:10px 0 6px;line-height:1.3;">Good morning ${name} — ${leads.length} new lead${leads.length === 1 ? "" : "s"} from the last 24 hours.</h1>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 18px;">All from public records + behavioral signals. Outreach must be sent manually by you.</p>
      ${mapHtml}
      ${cards}
      <p style="color:#94a3b8;font-size:12px;margin:18px 0 6px;">📊 This week: <strong style="color:#00d4ff;">${weekCount ?? leads.length}</strong> total ${label.toLowerCase().replace(" radar", "")} signal${weekCount === 1 ? "" : "s"}.</p>
      <p style="color:#64748b;font-size:11px;margin-top:16px;">${label} by Detroit Web Agency</p>`;
  }

  // White-label: swap DWA branding for agency brand
  const fromName = client.is_whitelabel && client.whitelabel_brand
    ? `${client.whitelabel_brand} Leads`
    : "Trade Radar · Detroit Web Agency";
  const replyTo = client.is_whitelabel && client.whitelabel_from_email
    ? client.whitelabel_from_email
    : "matt@detroitwebagent.com";
  const footerBrand = client.is_whitelabel && client.whitelabel_brand
    ? client.whitelabel_brand
    : "Detroit Web Agency";

  const finalBody = body.replace(
    "by Detroit Web Agency",
    `by ${footerBrand}`,
  );

  const result = await dwaEmail({
    to: client.email,
    subject,
    html: dwaWrap(finalBody, { ctaText: "Open dashboard →", ctaUrl: dashboardLink }),
    replyTo,
    fromName,
  });

  // Hot lead SMS (≥9)
  const top = leads[0];
  if (client.phone && top && top.score >= 9 && TWILIO_FROM) {
    await sendSMS(
      client.phone,
      TWILIO_FROM,
      `🏠 ${label}: ${leads.length} new lead${leads.length > 1 ? "s" : ""} today. Top: ${top.score}/10 — ${top.city ?? "your area"}. Check your email. — DWA`,
      "trade_radar",
    ).catch(() => {});
  }

  return { sent: result.ok, reason: result.error || "ok", leadCount: leads.length };
}

serve(wrapServe("trade-radar-am-digest", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  // Test SMS mode — proof-of-life texts to Matt + Mitchell, one per vertical
  if (body.test_sms) {
    const phones: string[] = Array.isArray(body.test_sms)
      ? body.test_sms
      : ["+13139921219", "+13136719441"];
    const results: any[] = [];
    for (const v of ALL_VERTICALS) {
      const label = VERTICAL_LABELS[v];
      const msg = `🏠 ${label} is LIVE. Scanning your SE Michigan ZIPs daily. — Detroit Web Agency`;
      for (const p of phones) {
        const r = await sendSMS(p, TWILIO_FROM, msg, "trade_radar_test").catch((e) => ({
          success: false, error: e instanceof Error ? e.message : String(e),
        }));
        results.push({ vertical: v, phone: p, result: r });
      }
    }
    return new Response(JSON.stringify({ ok: true, test_sms: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestedVertical = body.vertical as string | undefined;
  const verticals: Vertical[] = requestedVertical && requestedVertical !== "all"
    ? (ALL_VERTICALS.includes(requestedVertical as Vertical) ? [requestedVertical as Vertical] : [])
    : [...ALL_VERTICALS];

  if (!verticals.length) {
    return new Response(JSON.stringify({ error: `Unknown vertical: ${requestedVertical}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 3600_000).toISOString();
  const since7d = new Date(now - 7 * 24 * 3600_000).toISOString();

  const summary: Record<string, any> = {};
  let totalSent = 0;

  for (const vertical of verticals) {
    const { data: clients } = await sb
      .from("trade_radar_clients")
      .select("id, email, contact_name, business_name, phone, zip_codes, is_whitelabel, whitelabel_brand, whitelabel_logo_url, whitelabel_from_email")
      .eq("vertical", vertical)
      .eq("active", true);

    const stats = { clients: clients?.length ?? 0, sent: 0, failed: 0, total_leads: 0, errors: [] as string[] };
    for (const client of (clients || [])) {
      try {
        const r = await sendDigestForClient(sb, vertical, client, since24h, since7d);
        if (r.sent) stats.sent++; else { stats.failed++; stats.errors.push(`${client.email}: ${r.reason}`); }
        stats.total_leads += r.leadCount;
      } catch (e) {
        stats.failed++;
        stats.errors.push(`${client.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    summary[vertical] = stats;
    totalSent += stats.sent;
  }

  await (sb.from as any)("agent_heartbeats").upsert({
    agent_name: "trade-radar-am-digest",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { digests_sent: totalSent, summary },
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({ ok: true, digests_sent: totalSent, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));
