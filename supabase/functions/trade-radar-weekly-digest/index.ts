// Trade Radar Weekly Digest — Mondays 8am ET. Per client, one combined email
// covering every vertical they're subscribed to: total leads scanned this week,
// top 10 highest-score leads, best-performing signal type.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { dwaEmail, dwaWrap } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VERTICAL_LABELS: Record<string, string> = {
  roofing: "Roofing", hvac: "HVAC", plumbing: "Plumbing",
  electrical: "Electrical", pest_control: "Pest Control",
  gutters: "Gutters", painting: "Painting",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  // Group clients by email so each subscriber gets ONE combined weekly email
  const { data: allClients } = await sb
    .from("trade_radar_clients")
    .select("email, contact_name, business_name, vertical, zip_codes")
    .eq("active", true);

  const byEmail: Record<string, any[]> = {};
  for (const c of (allClients || [])) {
    (byEmail[c.email] ??= []).push(c);
  }

  let sent = 0;
  const errors: string[] = [];

  for (const [email, subs] of Object.entries(byEmail)) {
    const name = subs[0].contact_name || subs[0].business_name || "there";
    const sections: string[] = [];
    let totalWeek = 0;

    for (const sub of subs) {
      const label = VERTICAL_LABELS[sub.vertical] || sub.vertical;
      const zips: string[] = Array.isArray(sub.zip_codes) ? sub.zip_codes : [];

      let topQ = (sb.from as any)("trade_radar_leads")
        .select("score, signal_type, signal_detail, address, city, zip, created_at")
        .eq("vertical", sub.vertical)
        .gte("created_at", since7d)
        .order("score", { ascending: false })
        .limit(10);
      if (zips.length > 0) topQ = topQ.in("zip", zips);
      const { data: top } = await topQ;

      let countQ = (sb.from as any)("trade_radar_leads")
        .select("id", { count: "exact", head: true })
        .eq("vertical", sub.vertical)
        .gte("created_at", since7d);
      if (zips.length > 0) countQ = countQ.in("zip", zips);
      const { count } = await countQ;

      totalWeek += count ?? 0;

      const cards = (top || []).slice(0, 5).map((l: any) => {
        const sig = (l.signal_type || "").replace(/_/g, " ");
        const addr = [l.address, l.city, l.zip].filter(Boolean).join(", ");
        const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
        return `<tr><td style="padding:8px 0;border-bottom:1px solid #1e3a5f;">
          <span style="color:${scoreColor};font-weight:700;">${l.score}/10</span>
          <span style="color:#64748b;font-size:11px;text-transform:uppercase;margin-left:8px;">${sig}</span>
          <p style="margin:4px 0 0;color:#cbd5e1;font-size:12px;">${addr}</p>
        </td></tr>`;
      }).join("");

      sections.push(`
        <div style="margin:24px 0;padding:18px;background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;">
          <h2 style="color:#00d4ff;font-size:16px;margin:0 0 6px;">${label} Radar</h2>
          <p style="color:#94a3b8;font-size:12px;margin:0 0 12px;">${count ?? 0} signal${count === 1 ? "" : "s"} this week · top ${Math.min((top || []).length, 5)} below</p>
          ${cards ? `<table width="100%">${cards}</table>` : `<p style="color:#64748b;font-size:12px;margin:0;">Quiet week — monitoring continues 24/7.</p>`}
        </div>`);
    }

    const innerHtml = `
      <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">🏠 Trade Radar — Weekly Recap</p>
      <h1 style="color:#fff;font-size:22px;margin:10px 0 6px;">Good morning ${name} — your week across ${subs.length} vertical${subs.length === 1 ? "" : "s"}.</h1>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 8px;"><strong style="color:#00d4ff;">${totalWeek}</strong> total signals scanned across your subscriptions this week.</p>
      ${sections.join("")}
      <p style="color:#64748b;font-size:11px;margin-top:24px;">Trade Radar by Detroit Web Agency</p>`;

    const r = await dwaEmail({
      to: email,
      subject: `🏠 Trade Radar Weekly: ${totalWeek} signals across ${subs.length} vertical${subs.length === 1 ? "" : "s"}`,
      html: dwaWrap(innerHtml),
    });
    if (r.ok) sent++; else errors.push(`${email}: ${r.error}`);
  }

  return new Response(JSON.stringify({ ok: true, weekly_sent: sent, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
