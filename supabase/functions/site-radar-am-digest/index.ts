// site-radar-am-digest — daily 7:30 AM ET cron (11:30 UTC)
// Sends a premium dark-theme daily visitor intelligence email to every active
// SiteRadar client. Always sends — even quiet days — to prove the tracker is live.
//
// Design: matches mortgage-radar-am-digest aesthetic (dark #030711 bg, #00d4ff cyan).
// Features:
//   - 3-column hero stat bar (total visits / biz visitors / new companies)
//   - Company cards with 🔥 RETURNING and ⚡ NEW TODAY badges
//   - 🚨 HIGH-INTENT callout for companies visiting 3+ times
//   - Quiet-day variant with tips (proof-of-work)
//   - Idempotency guard via agent_heartbeats
//   - Logs to system_comms_log per client send

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── HTML helpers ─────────────────────────────────────────────────────────────

function statCell(label: string, value: string | number, accent = false): string {
  return `
    <td style="width:33%;padding:16px 12px;text-align:center;border-right:1px solid #1e3a5f;">
      <div style="font-size:28px;font-weight:900;color:${accent ? "#00d4ff" : "#fff"};">${value}</div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-top:4px;">${label}</div>
    </td>`;
}

function companyCard(b: any, isNew: boolean, isHot: boolean, idx: number): string {
  const bg = idx % 2 === 0 ? "#0a1628" : "#0f1f3d";
  const pageName = (b.page_visited || "Homepage")
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Homepage";

  const badges: string[] = [];
  if (isHot) badges.push(`<span style="display:inline-block;background:#7f1d1d;color:#fca5a5;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;margin-right:4px;">🚨 HIGH INTENT</span>`);
  if (isNew) badges.push(`<span style="display:inline-block;background:#052e16;color:#86efac;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;margin-right:4px;">⚡ NEW TODAY</span>`);
  if (!isNew && b.visit_count > 1) badges.push(`<span style="display:inline-block;background:#1c1917;color:#fdba74;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;">🔥 RETURNING</span>`);

  return `
    <tr>
      <td style="padding:14px 16px;background:${bg};border-bottom:1px solid #1e3a5f;">
        <div style="margin-bottom:6px;">${badges.join("")}</div>
        <div style="font-size:15px;font-weight:800;color:#00d4ff;">${escHtml(b.company_name)}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:3px;">
          ${b.city ? `📍 ${escHtml(b.city)} &nbsp;·&nbsp; ` : ""}
          📄 ${escHtml(pageName)} &nbsp;·&nbsp;
          👁 ${b.visit_count} visit${b.visit_count !== 1 ? "s" : ""} today
        </div>
      </td>
    </tr>`;
}

function escHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSubject(businesses: any[], totalVisits: number): string {
  if (businesses.length === 0) {
    return `📡 SiteRadar daily — quiet (${totalVisits} total visits, 0 companies identified)`;
  }
  const hot = businesses.filter(b => b.visit_count >= 3);
  if (hot.length > 0) {
    return `🚨 ${escHtml(hot[0].company_name)} is watching you — ${hot[0].visit_count} visits today`;
  }
  if (businesses.length === 1) {
    return `${escHtml(businesses[0].company_name)} visited your site today — ${totalVisits} total visits`;
  }
  return `${businesses.length} companies on your site today — ${escHtml(businesses[0].company_name)} + ${businesses.length - 1} more`;
}

function buildEmail(client: any, businesses: any[], totalVisits: number, newCompanyNames: Set<string>, portalUrl: string): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Detroit" });
  const hotVisitors = businesses.filter(b => b.visit_count >= 3);
  const newCount = businesses.filter(b => newCompanyNames.has(b.company_name)).length;

  // ── Quiet day variant ──
  if (businesses.length === 0) {
    return `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:28px 20px;">
    <p style="margin:0 0 4px;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🔍 SITERADAR DAILY BRIEF</p>
    <h1 style="color:#fff;font-size:22px;margin:8px 0 6px;line-height:1.3;">Quiet day on ${escHtml(client.business_name)}'s site</h1>
    <p style="color:#64748b;font-size:12px;margin:0 0 24px;">${today}</p>

    <table style="width:100%;border-collapse:collapse;background:#0a1628;border-radius:10px;overflow:hidden;margin-bottom:24px;border:1px solid #1e3a5f;">
      <tr>
        ${statCell("Total Visits", totalVisits)}
        ${statCell("Businesses", 0)}
        <td style="width:33%;padding:16px 12px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#fff;">Active</div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-top:4px;">Tracker Status</div>
        </td>
      </tr>
    </table>

    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 10px;color:#94a3b8;font-size:14px;line-height:1.7;">
        Your SiteRadar tracker is <strong style="color:#00d4ff;">live and firing</strong>. We watched all day for repeat visits, ICP companies, and high-intent pageviews — none crossed the threshold today.
      </p>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
        💡 <strong style="color:#94a3b8;">Drive more B2B traffic:</strong> Target industry forums, LinkedIn content, or paid campaigns toward your ICP to start seeing companies on your site.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${portalUrl}" style="display:inline-block;background:#00d4ff;color:#030711;font-weight:800;padding:13px 32px;border-radius:8px;text-decoration:none;font-size:14px;">Open dashboard →</a>
    </div>
    <p style="color:#334155;font-size:10px;text-align:center;margin:0;">SiteRadar by Detroit Web Agency · Watching your site 24/7</p>
  </div></body></html>`;
  }

  // ── Hot-intent callout banner ──
  const hotBanner = hotVisitors.length > 0 ? `
    <div style="background:#450a0a;border:1px solid #dc2626;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;color:#fca5a5;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;">🚨 High-Intent Visitors</p>
      ${hotVisitors.map(b => `
        <p style="margin:0 0 4px;color:#fff;font-size:14px;font-weight:700;">${escHtml(b.company_name)} <span style="color:#fca5a5;font-weight:400;">visited ${b.visit_count}× today — they're actively researching.</span></p>
      `).join("")}
    </div>` : "";

  // ── Company cards ──
  const cards = businesses.slice(0, 10).map((b, i) =>
    companyCard(b, newCompanyNames.has(b.company_name), b.visit_count >= 3, i)
  ).join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:28px 20px;">

    <p style="margin:0 0 4px;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🔍 SITERADAR DAILY BRIEF</p>
    <h1 style="color:#fff;font-size:22px;margin:8px 0 6px;line-height:1.3;">${businesses.length} compan${businesses.length === 1 ? "y" : "ies"} on ${escHtml(client.business_name)}'s site today</h1>
    <p style="color:#64748b;font-size:12px;margin:0 0 24px;">${today}</p>

    <!-- Stat bar -->
    <table style="width:100%;border-collapse:collapse;background:#0a1628;border-radius:10px;overflow:hidden;margin-bottom:24px;border:1px solid #1e3a5f;">
      <tr>
        ${statCell("Total Visits", totalVisits)}
        ${statCell("Companies ID'd", businesses.length, true)}
        ${statCell("New Today", newCount)}
      </tr>
    </table>

    ${hotBanner}

    <!-- Company cards -->
    <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #1e3a5f;margin-bottom:24px;">
      <thead>
        <tr style="background:#0f1f3d;">
          <th style="padding:10px 16px;text-align:left;color:#00d4ff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Visitor Intelligence</th>
        </tr>
      </thead>
      <tbody>${cards}</tbody>
    </table>

    ${businesses.length > 10 ? `<p style="color:#64748b;font-size:12px;text-align:center;margin:0 0 20px;">+ ${businesses.length - 10} more companies in your dashboard</p>` : ""}

    <!-- Proof of work footer -->
    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
        📡 <strong style="color:#94a3b8;">Watching ${escHtml(client.business_name)}'s site 24/7.</strong> We identify business visitors by cross-referencing IP ranges with company databases. Consumer traffic and VPNs are filtered out automatically.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${portalUrl}" style="display:inline-block;background:#00d4ff;color:#030711;font-weight:800;padding:13px 32px;border-radius:8px;text-decoration:none;font-size:14px;">View full dashboard →</a>
    </div>
    <p style="color:#334155;font-size:10px;text-align:center;margin:0;">SiteRadar by Detroit Web Agency · Unsubscribe by replying to this email</p>
  </div></body></html>`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // ── Idempotency guard ────────────────────────────────────────────────────
  if (!body.force) {
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const { data: hb } = await (sb.from as any)("agent_heartbeats")
      .select("last_beat, metadata")
      .eq("agent_name", "site-radar-am-digest")
      .maybeSingle();
    if (hb?.last_beat && new Date(hb.last_beat) >= todayStart && (hb.metadata?.digests_sent ?? 0) > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_sent_today", last_beat: hb.last_beat }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  // Fetch active SiteRadar clients
  const { data: clients } = await sb
    .from("field_crm_clients")
    .select("id, business_name, email, dispatch_token")
    .eq("status", "active")
    .not("stripe_subscription_id", "is", null);

  let sent = 0;

  for (const client of (clients || []) as any[]) {
    if (!client.email) continue;

    try {
      // Today's visitors
      const { data: todayEvents } = await sb
        .from("crm_visitor_events")
        .select("company_name, city, page_visited, visit_count, is_business")
        .eq("client_id", client.id)
        .gte("created_at", since24h)
        .order("visit_count", { ascending: false });

      const totalVisits = (todayEvents || []).length;
      const businesses = (todayEvents || []).filter((e: any) => e.is_business && e.company_name) as any[];

      // Prior 30-day company names for NEW TODAY detection
      const { data: priorEvents } = await sb
        .from("crm_visitor_events")
        .select("company_name")
        .eq("client_id", client.id)
        .gte("created_at", since30d)
        .lt("created_at", since24h)
        .eq("is_business", true);

      const seenBefore = new Set((priorEvents || []).map((e: any) => e.company_name).filter(Boolean));
      const newCompanyNames = new Set(businesses.map((b: any) => b.company_name).filter((n: string) => !seenBefore.has(n)));

      const portalUrl = client.dispatch_token
        ? `https://detroitwebagent.com/my-site-radar?token=${client.dispatch_token}`
        : "https://detroitwebagent.com/my-site-radar";

      const subject = buildSubject(businesses, totalVisits);
      const html = buildEmail(client, businesses, totalVisits, newCompanyNames, portalUrl);

      if (!RESEND_API_KEY) continue;

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SiteRadar <matt@detroitwebagent.com>",
          to: [client.email],
          subject,
          html,
        }),
      });

      if (sendRes.ok) {
        sent++;
        await sb.from("system_comms_log").insert({
          product: "site_radar",
          channel: "email",
          status: "ok",
          recipient: client.email,
          meta: { client_id: client.id, businesses_count: businesses.length, total_visits: totalVisits, new_today: newCompanyNames.size },
        }).catch(() => {});
      }
    } catch (e) {
      console.error(`[site-radar-am-digest] client ${client.id} failed:`, e instanceof Error ? e.message : e);
    }
  }

  // Heartbeat
  await (sb.from as any)("agent_heartbeats").upsert({
    agent_name: "site-radar-am-digest",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { digests_sent: sent },
  }, { onConflict: "agent_name" }).catch(() => {});

  return new Response(JSON.stringify({ ok: true, digests_sent: sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
