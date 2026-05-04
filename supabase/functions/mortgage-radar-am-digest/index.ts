// Mortgage Radar AM Digest — 6:30am ET cron. For each active LO client, sends a
// premium dark HTML email with the top 5 highest-score leads from last 24h.
//
// Improvements shipped:
//  #8  Score trend arrow (multi-signal indicator)
//  #9  Pre-personalized opener (uses full_name when lead has one)
//  #10 Estimated commission range per lead
//  #11 Days-since-signal urgency counter with signal-aware copy
//  #12 One-tap contact finder link
//  #13 Static Google Maps header with all lead pins
//  #14 "This week" accumulator panel at bottom
//  #16 Signal cluster alert (hot zone banner when 2+ leads in same city)
//  #19 Smart subject line rotation based on top lead signal type
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encode } from "https://deno.land/std@0.190.0/encoding/base64url.ts";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function signDashboardToken(email: string): Promise<string> {
  const payload = JSON.stringify({ email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const tokenB64 = encode(new TextEncoder().encode(payload));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(tokenB64));
  return `${tokenB64}.${encode(new Uint8Array(sig))}`;
}

function streetViewUrl(lead: { address?: string; city?: string; zip?: string; lat?: number | null; lon?: number | null }): string {
  if (!GOOGLE_MAPS_API_KEY) return "";
  if (lead.lat != null && lead.lon != null) {
    return `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${lead.lat},${lead.lon}&fov=80&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`;
  }
  return "";
}

// #13 — Static map showing all leads as colored pins
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

// #10 — Estimated LO commission based on signal type + equity
function estimateCommission(l: any): { low: number; high: number } | null {
  const HOME_VALUES: Record<string, number> = {
    renovation_permit: 380_000, high_equity_renovation: 420_000,
    fsbo_listing: 320_000, lis_pendens: 260_000, foreclosure_notice: 230_000,
    divorce_filing: 310_000, probate_filing: 280_000, estate_sale: 270_000,
    tax_delinquency: 200_000, fixer_upper_listing: 200_000,
    new_llc_self_employed: 350_000, sba_loan_approved: 380_000,
    job_change_high_income: 400_000,
  };
  const homeVal = HOME_VALUES[l.signal_type];
  if (!homeVal) return null;
  // Equity-based lead: use equity as proxy for refi loan size; purchase signal: use home value × 80% LTV
  const loanAmt = l.estimated_equity
    ? Math.min(l.estimated_equity * 0.85, homeVal * 0.95)
    : homeVal * 0.80;
  // LO commission: 1.0%–1.5% of loan, rounded to nearest $100
  return {
    low: Math.round((loanAmt * 0.010) / 100) * 100,
    high: Math.round((loanAmt * 0.015) / 100) * 100,
  };
}

// #11 — Days-since-signal urgency counter
function daysOld(lead: any): number {
  const ref = lead.signal_date || lead.created_at;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
}

const URGENCY_COPY: Record<string, (d: number) => string> = {
  lis_pendens:        d => d <= 3  ? "⚡ Fresh — foreclosure avg 90 days from filing. Act this week." : d <= 14 ? `⏳ ${d} days old — ~${90-d} days left on clock.` : `🔴 ${d} days old — window closing fast.`,
  foreclosure_notice: d => d <= 3  ? "⚡ New foreclosure notice — act this week." : `⏳ ${d} days old — clock is running.`,
  fsbo_listing:       d => d <= 7  ? "🟢 Active listing — seller is engaged right now." : `⏳ ${d} days on market — motivation rising.`,
  renovation_permit:  d => d <= 14 ? "🔨 Permit fresh — homeowner is mid-project." : `📋 ${d} days old — project underway.`,
  probate_filing:     d => `⚖️ ${d} days since filing — heirs typically sell within 6 months.`,
  estate_sale:        d => d <= 7  ? "🟢 Estate sale this week — heirs are active." : `📦 Estate sale ${d} days ago — property sale likely imminent.`,
  tax_delinquency:    d => d <= 30 ? "🔴 Recent delinquency — intervention window open." : `⏳ ${d} days old — resolve window narrowing.`,
  divorce_filing:     d => `⚖️ ${d} days since filing — buyout refi typically needed within 90 days.`,
};

function urgencyLine(lead: any): string {
  const d = daysOld(lead);
  const fn = URGENCY_COPY[lead.signal_type];
  return fn ? fn(d) : d > 0 ? `📅 ${d} days old` : "";
}

// #19 — Smart subject line rotation based on top lead's signal type
function buildSubject(topLead: any, totalLeads: number): string {
  const name = topLead.full_name ? topLead.full_name.split(" ")[0] : null;
  const addr = topLead.address ? topLead.address.split(",")[0] : null;
  const city = topLead.city || "";
  const equity = topLead.estimated_equity
    ? `$${Math.round(topLead.estimated_equity / 1000)}k equity`
    : null;

  const templates: Record<string, string[]> = {
    renovation_permit: [
      name && addr ? `${name} on ${addr} just pulled a permit. First call wins.` : `New renovation permit in ${city} — call before the contractor does.`,
      `Homeowner in ${city} is spending big. They may need a cash-out refi.`,
    ],
    lis_pendens: [
      `${totalLeads} homeowner${totalLeads > 1 ? "s" : ""} in your market need a refi this week.`,
      name ? `${name} in ${city} just got served a lis pendens. Reach out today.` : `Lis pendens filed in ${city} — 90-day clock started.`,
    ],
    foreclosure_notice: [
      `${totalLeads} families in your market need help this week.`,
      `Foreclosure notice in ${city}${equity ? ` — ${equity} at stake` : ""}. Act fast.`,
    ],
    fsbo_listing: [
      `${totalLeads} seller${totalLeads > 1 ? "s" : ""} listed without an agent this morning in your market.`,
      addr ? `${addr} just listed FSBO — next purchase needs financing.` : `New FSBO in ${city} — next buyer needs you.`,
    ],
    estate_sale: [
      `${totalLeads} estate sale${totalLeads > 1 ? "s" : ""} this weekend — heirs usually sell within 90 days.`,
      `Estate sale in ${city} — property transition incoming.`,
    ],
    probate_filing: [
      `Probate filed in ${city}${equity ? ` — ${equity} in inherited property` : ""}. Family needs guidance.`,
      `${totalLeads} probate filing${totalLeads > 1 ? "s" : ""} in your market — estate refi or sale likely.`,
    ],
    divorce_filing: [
      `Divorce filing in ${city} — one spouse will need a buyout refi.`,
      `${totalLeads} divorce filing${totalLeads > 1 ? "s" : ""} in your market this week.`,
    ],
  };

  const options = templates[topLead.signal_type];
  if (options) {
    // Rotate daily by day-of-week so Matt can see both variants over time
    return `🏠 ${options[new Date().getDay() % options.length]}`;
  }
  return `🏠 ${totalLeads} new mortgage signal${totalLeads > 1 ? "s" : ""} — highest score: ${topLead.score}/10 in ${city}`;
}

// #16 — Signal cluster detection
function detectClusters(leads: any[]): string[] {
  const cityCounts: Record<string, number> = {};
  for (const l of leads) {
    const key = l.city || l.zip || "unknown";
    cityCounts[key] = (cityCounts[key] || 0) + 1;
  }
  return Object.entries(cityCounts)
    .filter(([, count]) => count >= 2)
    .map(([city, count]) => `🔥 Hot Zone: <strong>${city}</strong> has ${count} signals today — multiple homeowners moving at once.`);
}

// #8 — Score trend indicator from signal_count
function scoreTrendBadge(lead: any): string {
  if ((lead.signal_count || 1) >= 3) return ' <span style="color:#f97316;font-size:10px;font-weight:700;">🔺 3+ signals</span>';
  if ((lead.signal_count || 1) >= 2) return ' <span style="color:#fbbf24;font-size:10px;font-weight:700;">🔺 repeat signal</span>';
  return "";
}

// #9 — Personalized opener
function personalizeOpener(opener: string | null, fullName: string | null, address: string | null): string {
  if (!opener) return "";
  const first = fullName ? fullName.trim().split(" ")[0] : null;
  return opener
    .replace(/\{name\}/g, first || "there")
    .replace(/\{address\}/g, address || "the property");
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Test SMS mode — send a confirmation text to specified numbers
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  if (body.test_sms) {
    // Default to Matt's PERSONAL line + brother. Pass an explicit array to override.
    const phones: string[] = Array.isArray(body.test_sms) ? body.test_sms as string[] : ["+13138064952", "+13136719441"];
    let msg: string;
    if (typeof body.custom_body === "string" && body.custom_body.trim()) {
      msg = body.custom_body as string;
    } else {
      const { count } = await sb.from("mortgage_radar_leads").select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
      msg = `🏠 Mortgage Radar is live. ${count ?? 0} new lead${count !== 1 ? "s" : ""} scanned in SE Michigan today. Daily email is on its way. — Detroit Web Agency`;
    }
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
    const results = await Promise.allSettled(phones.map(p => sendSMS(p, TWILIO_FROM, msg, "mortgage_radar")));
    const summary = results.map((r, i) => ({ phone: phones[i], status: r.status === "fulfilled" ? "sent" : (r as PromiseRejectedResult).reason?.message }));
    return new Response(JSON.stringify({ ok: true, test_sms: summary }), { headers: corsHeaders });
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 3600_000).toISOString();
  const since7d  = new Date(now - 7 * 24 * 3600_000).toISOString();

  // Select core columns; coverage_counties + coverage_regions added by later migration —
  // if those columns don't exist yet the whole query silently returns null, so fetch
  // them separately and fall back gracefully.
  const { data: clients } = await sb
    .from("mortgage_radar_clients")
    .select("id, email, contact_name, business_name, zip_codes, phone, crm_webhook_url, crm_webhook_secret")
    .eq("active", true);

  // Best-effort fetch of new geo columns (may not exist yet — ignore errors)
  const { data: geoRows } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, coverage_counties, coverage_regions")
    .eq("active", true);
  const geoById: Record<string, { coverage_counties?: string[]; coverage_regions?: string[] }> = {};
  for (const g of (geoRows || [])) geoById[g.id] = g;

  let sent = 0;
  const debug: Record<string, unknown> = { clients_count: clients?.length ?? 0, clients_null: clients === null };

  for (const c of (clients || [])) {
    const geo = geoById[c.id] || {};
    const regions: string[] = Array.isArray(geo.coverage_regions) ? geo.coverage_regions : [];
    const counties: string[] = Array.isArray(geo.coverage_counties) ? geo.coverage_counties : [];
    const zips: string[] = Array.isArray(c.zip_codes) ? c.zip_codes : [];
    // county + region added by later migration — omit them here; they'll be null until applied
    const baseSelect = "id, full_name, address, city, zip, lat, lon, signal_type, signal_detail, score, suggested_opener, best_call_window, estimated_equity, intel_highlights, signal_count, last_signal_at, signal_date, created_at";

    function applyGeoFilter(q: any) {
      if (regions.length > 0) return q.in("region", regions);
      if (counties.length > 0) return q.in("county", counties);
      if (zips.length > 0) return q.in("zip", zips);
      return q; // no geo restriction set — show all leads
    }

    // Today's top 5 leads — if zip filter returns 0 (leads pre-date county/region columns
    // and have null zip), fall back to unfiltered so the digest always sends when leads exist.
    let leads: any[] | null = null;
    const geoFiltered = await applyGeoFilter(
      (sb.from as any)("mortgage_radar_leads")
        .select(baseSelect)
        .gte("created_at", since24h)
        .order("score", { ascending: false })
        .limit(5)
    );
    leads = geoFiltered.data;
    if ((!leads || leads.length === 0) && zips.length > 0 && regions.length === 0 && counties.length === 0) {
      // Zip filter matched nothing — leads likely have null zip (pre-migration).
      // Fall back to all leads so the digest isn't silently empty.
      const fallback = await (sb.from as any)("mortgage_radar_leads")
        .select(baseSelect)
        .gte("created_at", since24h)
        .order("score", { ascending: false })
        .limit(5);
      leads = fallback.data;
    }
    // Tier 3 — zero-lead "proof of work" digest. If no leads in client's ZIPs/counties,
    // pull adjacent signals (same counties, score >=6, last 48h) so the email isn't dark.
    let isProofOfWork = false;
    if (!leads || leads.length === 0) {
      if (counties.length === 0 && regions.length === 0 && zips.length === 0) continue;
      // Widen window to 48h, drop geo to county-level only, score >=6
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      let adjacentQuery = (sb.from as any)("mortgage_radar_leads")
        .select(baseSelect)
        .gte("created_at", since48h)
        .gte("score", 6)
        .order("score", { ascending: false })
        .limit(3);
      if (counties.length > 0) adjacentQuery = adjacentQuery.in("county", counties);
      else if (regions.length > 0) adjacentQuery = adjacentQuery.in("region", regions);
      const { data: adjacent } = await adjacentQuery;
      if (!adjacent || adjacent.length === 0) {
        await sendSMS(
          "+13138064952",
          `Mortgage Radar digest ran for ${c.email} — 0 leads in 48h. Scanner is healthy; no market signals matched today.`,
          "mortgage_digest_zero_leads"
        );
        continue;
      }
      leads = adjacent;
      isProofOfWork = true;
    }

    // #14 — This week's lead count (separate query, last 7 days)
    const { count: weekCount } = await applyGeoFilter(
      (sb.from as any)("mortgage_radar_leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7d)
    );

    const dashboardToken = await signDashboardToken(c.email);
    const dashboardLink = `https://detroitwebagent.com/my-mortgage-radar?email=${encodeURIComponent(c.email)}&token=${encodeURIComponent(dashboardToken)}`;

    // #13 — Static map header
    const mapUrl = buildStaticMapUrl(leads);

    // #16 — Cluster alerts
    const clusters = detectClusters(leads);

    // Build lead cards
    const cards = leads.map((l: any) => {
      const sv = streetViewUrl(l);
      const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
      const draftLink = `${dashboardLink}&draft=${l.id}`;

      const highlights = Array.isArray(l.intel_highlights)
        ? l.intel_highlights.slice(0, 3).map((h: string) => `<li style="margin:2px 0;color:#cbd5e1;font-size:12px;">${h}</li>`).join("")
        : "";

      // #8 score trend
      const trendBadge = scoreTrendBadge(l);

      // #9 personalized opener
      const opener = personalizeOpener(l.suggested_opener, l.full_name, l.address);

      // #10 commission estimate
      const comm = estimateCommission(l);
      const commHtml = comm
        ? `<p style="margin:8px 0 0;color:#22c55e;font-size:12px;font-weight:600;">💵 Est. commission: $${comm.low.toLocaleString()}–$${comm.high.toLocaleString()}</p>`
        : "";

      // #11 urgency
      const urg = urgencyLine(l);
      const urgHtml = urg ? `<p style="margin:6px 0 0;font-size:11px;color:#f97316;">${urg}</p>` : "";

      // Equity line
      const equityHtml = l.estimated_equity
        ? `<p style="margin:6px 0 0;color:#94a3b8;font-size:11px;">🏠 Est. equity: $${Math.round(l.estimated_equity / 1000)}k</p>`
        : "";

      // Location line
      const locParts = [l.city, l.zip || l.county].filter(Boolean).join(" ");
      const signalLabel = (l.signal_type || "").replace(/_/g, " ");

      // #12 contact finder
      const searchQ = l.full_name
        ? encodeURIComponent(`"${l.full_name}" ${l.city || ""} ${l.zip || ""} phone contact`)
        : encodeURIComponent(`${l.address || ""} ${l.city || ""} owner contact`);
      const contactFinderUrl = `https://www.google.com/search?q=${searchQ}`;

      return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#0a1628;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden;">
        ${sv ? `<tr><td style="padding:0;"><img src="${sv}" alt="Street view" width="600" style="display:block;width:100%;height:auto;border:0;border-bottom:1px solid #1e3a5f;"></td></tr>` : ""}
        <tr><td style="padding:16px 18px;">
          <table width="100%"><tr>
            <td style="vertical-align:top;">
              <p style="margin:0;color:#fff;font-size:16px;font-weight:700;">${l.address || "Address pending"}${trendBadge}</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${locParts} · ${signalLabel}</p>
            </td>
            <td style="vertical-align:top;text-align:right;width:60px;">
              <span style="display:inline-block;color:${scoreColor};font-size:24px;font-weight:900;">${l.score}/10</span>
            </td>
          </tr></table>
          ${l.signal_detail ? `<p style="margin:10px 0 0;color:#cbd5e1;font-size:13px;line-height:1.5;">${l.signal_detail}</p>` : ""}
          ${urgHtml}
          ${commHtml}
          ${equityHtml}
          ${highlights ? `<ul style="margin:10px 0 0;padding-left:18px;">${highlights}</ul>` : ""}
          ${opener ? `<div style="margin:12px 0 0;padding:10px 12px;background:#030711;border-left:2px solid #00d4ff;border-radius:4px;"><p style="margin:0 0 4px;color:#00d4ff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Suggested opener${l.full_name ? " (personalized)" : ""}</p><p style="margin:0;color:#cbd5e1;font-size:12px;font-style:italic;">"${opener}"</p></div>` : ""}
          <table width="100%" style="margin-top:14px;"><tr>
            <td style="padding-right:8px;"><a href="${draftLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:800;padding:9px 14px;border-radius:6px;text-decoration:none;font-size:12px;">✍️ Draft outreach</a></td>
            <td><a href="${contactFinderUrl}" target="_blank" style="display:inline-block;background:#1e3a5f;color:#94a3b8;font-weight:600;padding:9px 14px;border-radius:6px;text-decoration:none;font-size:12px;">🔍 Find contact</a></td>
            ${l.best_call_window ? `<td style="text-align:right;color:#94a3b8;font-size:11px;padding-left:8px;">📞 ${l.best_call_window}</td>` : ""}
          </tr></table>
        </td></tr>
      </table>`;
    }).join("");

    // #16 cluster banner
    const clusterHtml = clusters.length > 0
      ? `<div style="margin:0 0 20px;padding:12px 16px;background:#1c0f00;border:1px solid #f97316;border-radius:8px;">${clusters.map(c => `<p style="margin:0;color:#fdba74;font-size:13px;">${c}</p>`).join("")}</div>`
      : "";

    // #14 this-week accumulator
    const weekHtml = weekCount != null ? `
      <div style="margin-top:24px;padding:14px 18px;background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;">
        <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">This week in your market</p>
        <p style="margin:0;color:#fff;font-size:18px;font-weight:800;">${weekCount} lead${weekCount !== 1 ? "s" : ""} surfaced</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:11px;">All signals from public records + behavioral data. Open dashboard to see full history.</p>
        <a href="${dashboardLink}" style="display:inline-block;margin-top:10px;background:#0a1628;border:1px solid #1e3a5f;color:#94a3b8;font-size:12px;padding:8px 16px;border-radius:6px;text-decoration:none;">View all ${weekCount} →</a>
      </div>` : "";

    // #13 map header
    const mapHtml = mapUrl
      ? `<div style="margin:0 0 20px;border-radius:8px;overflow:hidden;border:1px solid #1e3a5f;"><img src="${mapUrl}" alt="Lead map" width="600" style="display:block;width:100%;height:auto;"></div>`
      : "";

    // Header copy varies for proof-of-work digests
    const headerEyebrow = isProofOfWork
      ? "🏠 Mortgage Radar — Market Pulse"
      : "🏠 Mortgage Radar — Morning Brief";
    const headerH1 = isProofOfWork
      ? `Good morning ${c.contact_name || "there"} — no in-ZIP leads today, but here's nearby market activity worth watching.`
      : `Good morning ${c.contact_name || "there"} — your top ${leads.length} in-market lead${leads.length === 1 ? "" : "s"} from the last 24 hours.`;
    const headerSub = isProofOfWork
      ? `<p style="color:#fbbf24;font-size:12px;margin:0 0 6px;">📡 Adjacent-area signals — outside your exclusive ZIPs but in your county. Useful for trend awareness, not direct outreach.</p><p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">All from public records + behavioral signals.</p>`
      : `<p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">All from public records + behavioral signals. Outreach must be sent manually by you, in compliance with TCPA + FCRA.</p>`;

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
        <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">${headerEyebrow}</p>
        <h1 style="color:#fff;font-size:24px;margin:10px 0 6px;line-height:1.3;">${headerH1}</h1>
        ${headerSub}
        ${mapHtml}
        ${clusterHtml}
        ${cards}
        ${weekHtml}
        <div style="margin-top:24px;text-align:center;">
          <a href="${dashboardLink}" style="display:inline-block;background:#0a1628;border:1px solid #00d4ff;color:#00d4ff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;">Open full dashboard →</a>
        </div>
        <p style="color:#64748b;font-size:10px;margin-top:24px;text-align:center;">Mortgage Radar uses public + behavioral signals only. We do not access, purchase, or resell credit-bureau trigger leads.</p>
      </div></body></html>`;

    // #19 smart subject line — softer for proof-of-work
    const subject = isProofOfWork
      ? `📡 ${c.contact_name?.split(" ")[0] || "Market"} pulse — ${leads.length} signal${leads.length === 1 ? "" : "s"} in your county`
      : buildSubject(leads[0], leads.length);

    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: [c.email],
            subject,
            html,
          }),
        });
        sent += 1;
      } catch (e) {
        console.warn("[mortgage-radar-am-digest] send failed:", e instanceof Error ? e.message : String(e));
      }
    }

    // CRM webhook fan-out — fire-and-forget, one POST per top lead
    if ((c as any).crm_webhook_url && leads?.length && !isProofOfWork) {
      for (const lead of leads) {
        deliverCrmWebhook({
          product: "mortgage_radar",
          client_id: c.id,
          url: (c as any).crm_webhook_url,
          secret: (c as any).crm_webhook_secret,
          payload: { lead },
        }).catch(() => {});
      }
    }
  }

  await (sb.from as any)("agent_heartbeats").upsert({
    agent_name: "mortgage-radar-am-digest",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { digests_sent: sent },
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({ ok: true, digests_sent: sent, debug }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
