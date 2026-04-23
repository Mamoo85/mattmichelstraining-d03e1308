// Admin: send a sample Mortgage Radar morning digest to any prospect email.
// Pulls top 5 highest-score leads (any time) for an Ameristeel-style preview.
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

function streetViewUrl(address: string, city: string, zip: string): string {
  if (!GOOGLE_MAPS_API_KEY) return "";
  const location = encodeURIComponent(`${address}, ${city} ${zip}, MI`);
  return `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${location}&fov=80&key=${GOOGLE_MAPS_API_KEY}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to_email, contact_name, business_name } = await req.json();
    if (!to_email || typeof to_email !== "string" || !to_email.includes("@")) {
      return new Response(JSON.stringify({ error: "valid to_email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: leads, error } = await (sb.from as any)("mortgage_radar_leads")
      .select("id, full_name, address, city, zip, signal_type, signal_detail, score, suggested_opener, best_call_window, estimated_equity, intel_highlights")
      .order("score", { ascending: false })
      .limit(5);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ error: "no leads available to preview yet — wait for first scanner run" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctaLink = `https://detroitwebagent.com/mortgage-radar?utm_source=preview&utm_medium=email`;

    const cards = leads.map((l: any) => {
      const sv = streetViewUrl(l.address || "", l.city || "", l.zip || "");
      const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
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
          ${l.best_call_window ? `<p style="margin:10px 0 0;color:#94a3b8;font-size:11px;">📞 Best call window: ${l.best_call_window}</p>` : ""}
        </td></tr>
      </table>`;
    }).join("");

    const greeting = contact_name ? `${contact_name}` : (business_name || "there");

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
        <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🏠 Mortgage Radar — Sample Brief</p>
        <h1 style="color:#fff;font-size:24px;margin:10px 0 6px;line-height:1.3;">${greeting}, this is what your morning email would look like.</h1>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 8px;">Below: 5 real in-market homeowner signals from public records + behavioral data — exactly what you'd get every morning at 6:30am ET.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 22px;">No bureau trigger leads. No SSNs. 100% FCRA-clean. Outreach must be sent manually by you.</p>
        ${cards}
        <div style="margin-top:24px;text-align:center;background:#0a1628;border:1px solid #00d4ff;border-radius:12px;padding:24px;">
          <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 8px;">Want this every morning for your ZIPs?</p>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">$399/mo Solo (5 ZIPs) · $899/mo Team (15 ZIPs). Cancel anytime.</p>
          <a href="${ctaLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:800;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;">Start Mortgage Radar →</a>
        </div>
        <p style="color:#64748b;font-size:11px;margin-top:24px;text-align:center;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
        <p style="color:#475569;font-size:10px;margin-top:8px;text-align:center;">Mortgage Radar uses public + behavioral signals only. We do not access, purchase, or resell credit-bureau trigger leads.</p>
      </div></body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to: [to_email],
        subject: `🏠 Sample: Top 5 in-market mortgage leads — score ${leads[0].score}/10`,
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Resend ${resp.status}: ${errText}`);
    }

    return new Response(JSON.stringify({ ok: true, sent_to: to_email, leads_included: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[mortgage-radar-send-preview]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
