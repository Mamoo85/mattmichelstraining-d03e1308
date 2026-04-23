// Mortgage Radar weekly digest — emails each active LO their top leads from the past 7 days.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: clients } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, email, contact_name, business_name, zip_codes")
    .eq("active", true);

  let sent = 0;
  for (const c of (clients || [])) {
    const zips: string[] = Array.isArray(c.zip_codes) ? c.zip_codes : [];
    if (zips.length === 0) continue;

    const { data: leads } = await (sb.from as any)("mortgage_radar_leads")
      .select("id, full_name, address, city, zip, signal_type, signal_detail, score, suggested_opener, best_call_window, signal_date")
      .in("zip", zips)
      .gte("created_at", since)
      .order("score", { ascending: false })
      .limit(15);

    if (!leads || leads.length === 0) continue;

    const rows = leads.map((l: any) => `
      <tr style="border-top:1px solid #1e3a5f;">
        <td style="padding:10px;color:#fff;">${l.address || "—"}<br><span style="color:#94a3b8;font-size:12px;">${l.city || ""} ${l.zip || ""}</span></td>
        <td style="padding:10px;color:#00d4ff;font-weight:700;">${l.score}/10</td>
        <td style="padding:10px;color:#cbd5e1;font-size:13px;">${l.signal_type.replace(/_/g, " ")}<br><span style="color:#64748b;font-size:11px;">${l.signal_detail || ""}</span></td>
        <td style="padding:10px;color:#94a3b8;font-size:12px;">${l.best_call_window || ""}</td>
      </tr>`).join("");

    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: [c.email],
            subject: `🏠 This week's Mortgage Radar — ${leads.length} new in-market leads`,
            html: `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;">
              <div style="max-width:680px;margin:0 auto;padding:24px;">
                <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🏠 Mortgage Radar — Weekly</p>
                <h1 style="color:#fff;font-size:22px;margin:8px 0 16px;">Hi ${c.contact_name || "there"} — here are this week's hottest in-market leads in your ZIPs.</h1>
                <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">All from public records and behavioral signals. Outreach must be sent manually by you, in compliance with TCPA + FCRA.</p>
                <table style="width:100%;border-collapse:collapse;background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;overflow:hidden;">
                  <thead><tr style="background:#0a1628;color:#00d4ff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;">
                    <th style="padding:10px;">Address</th><th style="padding:10px;">Score</th><th style="padding:10px;">Signal</th><th style="padding:10px;">Best Call</th>
                  </tr></thead>
                  <tbody>${rows}</tbody>
                </table>
                <p style="color:#64748b;font-size:11px;margin-top:16px;">Mortgage Radar uses public + behavioral signals only. We do not access, purchase, or resell credit-bureau trigger leads.</p>
              </div></body></html>`,
          }),
        });
        sent += 1;
        await (sb.from as any)("mortgage_radar_clients").update({ last_digest_sent_at: new Date().toISOString() }).eq("id", c.id);
      } catch (e) {
        console.warn("[mortgage-radar-digest] send failed:", e instanceof Error ? e.message : String(e));
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, digests_sent: sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
