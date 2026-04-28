// Mortgage Radar AM Digest — 6:30am ET cron. For each active LO client, sends a
// premium dark HTML email with the top 5 highest-score leads from last 24h, each
// with a Google Street View thumbnail and a one-tap "Open dashboard" deep link.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

function streetViewUrl(lead: { address?: string; city?: string; zip?: string; lat?: number | null; lon?: number | null }): string {
  if (!GOOGLE_MAPS_API_KEY) return "";
  // Prefer validated lat/lon (kills Street View's silent fuzzy-match on bad addresses).
  if (lead.lat != null && lead.lon != null) {
    return `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${lead.lat},${lead.lon}&fov=80&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`;
  }
  // No coords = no image. Better to show no photo than someone else's house.
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: clients } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, email, contact_name, business_name, zip_codes")
    .eq("active", true);

  let sent = 0;

  for (const c of (clients || [])) {
    const zips: string[] = Array.isArray(c.zip_codes) ? c.zip_codes : [];
    if (zips.length === 0) continue;

    const { data: leads } = await (sb.from as any)("mortgage_radar_leads")
      .select("id, full_name, address, city, zip, lat, lon, signal_type, signal_detail, score, suggested_opener, best_call_window, estimated_equity, intel_highlights")
      .in("zip", zips)
      .gte("created_at", since)
      .order("score", { ascending: false })
      .limit(5);

    if (!leads || leads.length === 0) continue;

    const dashboardLink = `https://detroitwebagent.com/my-mortgage-radar?email=${encodeURIComponent(c.email)}`;

    const cards = leads.map((l: any) => {
      const sv = streetViewUrl(l);
      const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
      const draftLink = `${dashboardLink}&draft=${l.id}`;
      const highlights = Array.isArray(l.intel_highlights)
        ? l.intel_highlights.slice(0, 3).map((h: string) => `<li style="margin:2px 0;color:#cbd5e1;font-size:12px;">${h}</li>`).join("")
        : "";
      return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#0a1628;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden;">
        ${sv ? `<tr><td style="padding:0;"><img src="${sv}" alt="Street view" width="600" style="display:block;width:100%;height:auto;border:0;border-bottom:1px solid #1e3a5f;"></td></tr>` : ""}
        <tr><td style="padding:16px 18px;">
          <table width="100%"><tr>
            <td style="vertical-align:top;">
              <p style="margin:0;color:#fff;font-size:16px;font-weight:700;">${l.address || "Address pending"}</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${l.city || ""} ${l.zip || ""} · ${(l.signal_type || "").replace(/_/g, " ")}</p>
            </td>
            <td style="vertical-align:top;text-align:right;width:60px;">
              <span style="display:inline-block;color:${scoreColor};font-size:24px;font-weight:900;">${l.score}/10</span>
            </td>
          </tr></table>
          ${l.signal_detail ? `<p style="margin:10px 0 0;color:#cbd5e1;font-size:13px;line-height:1.5;">${l.signal_detail}</p>` : ""}
          ${l.estimated_equity ? `<p style="margin:8px 0 0;color:#22c55e;font-size:12px;font-weight:600;">💰 Est. equity: ${l.estimated_equity}</p>` : ""}
          ${highlights ? `<ul style="margin:10px 0 0;padding-left:18px;">${highlights}</ul>` : ""}
          ${l.suggested_opener ? `<div style="margin:12px 0 0;padding:10px 12px;background:#030711;border-left:2px solid #00d4ff;border-radius:4px;"><p style="margin:0;color:#cbd5e1;font-size:12px;font-style:italic;">"${l.suggested_opener}"</p></div>` : ""}
          <table width="100%" style="margin-top:14px;"><tr>
            <td><a href="${draftLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:800;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:13px;">✍️ Draft outreach</a></td>
            ${l.best_call_window ? `<td style="text-align:right;color:#94a3b8;font-size:11px;">📞 Best call: ${l.best_call_window}</td>` : ""}
          </tr></table>
        </td></tr>
      </table>`;
    }).join("");

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
        <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🏠 Mortgage Radar — Morning Brief</p>
        <h1 style="color:#fff;font-size:24px;margin:10px 0 6px;line-height:1.3;">Good morning ${c.contact_name || "there"} — your top ${leads.length} in-market lead${leads.length === 1 ? "" : "s"} from the last 24 hours.</h1>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 22px;">All from public records + behavioral signals. Outreach must be sent manually by you, in compliance with TCPA + FCRA.</p>
        ${cards}
        <div style="margin-top:24px;text-align:center;">
          <a href="${dashboardLink}" style="display:inline-block;background:#0a1628;border:1px solid #00d4ff;color:#00d4ff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;">Open full dashboard →</a>
        </div>
        <p style="color:#64748b;font-size:10px;margin-top:24px;text-align:center;">Mortgage Radar uses public + behavioral signals only. We do not access, purchase, or resell credit-bureau trigger leads.</p>
      </div></body></html>`;

    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: [c.email],
            subject: `🏠 Top ${leads.length} mortgage lead${leads.length === 1 ? "" : "s"} this morning — score ${leads[0].score}/10`,
            html,
          }),
        });
        sent += 1;
      } catch (e) {
        console.warn("[mortgage-radar-am-digest] send failed:", e instanceof Error ? e.message : String(e));
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, digests_sent: sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
