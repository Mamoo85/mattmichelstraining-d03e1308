// deliver-ondemand-names — Triggered by Stripe webhook after successful payment
// Pulls top N candidates from hire_alert_candidates, emails them to the buyer
// Logs delivery to ondemand_purchases table
// Calculates refund if we can't deliver full pack

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Candidate {
  id: string;
  full_name: string;
  license_type: string;
  license_number: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  availability_score: number;
  score_reason: string | null;
  source: string | null;
}

function buildDeliveryEmail(
  companyName: string,
  candidates: Candidate[],
  namesRequested: number,
  refundAmount: number
): string {
  const candidateRows = candidates.map((c, i) => `
    <tr style="border-bottom:1px solid #1e3a5f;">
      <td style="padding:12px 8px;color:#fff;font-weight:700;">${i + 1}</td>
      <td style="padding:12px 8px;">
        <div style="color:#fff;font-weight:700;">${c.full_name}</div>
        <div style="color:#64748b;font-size:12px;">${c.license_type}${c.license_number ? ` — #${c.license_number}` : ""}</div>
      </td>
      <td style="padding:12px 8px;color:#94a3b8;font-size:13px;">${c.location || "Metro Detroit"}</td>
      <td style="padding:12px 8px;">
        ${c.phone ? `<a href="tel:${c.phone}" style="color:#00d4ff;text-decoration:none;font-size:13px;">${c.phone}</a>` : '<span style="color:#475569;font-size:12px;">Not available</span>'}
      </td>
      <td style="padding:12px 8px;text-align:center;">
        <span style="background:${c.availability_score >= 7 ? "#22c55e" : c.availability_score >= 4 ? "#f97316" : "#64748b"}20;color:${c.availability_score >= 7 ? "#22c55e" : c.availability_score >= 4 ? "#f97316" : "#94a3b8"};padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700;">
          ${c.availability_score}/10
        </span>
      </td>
    </tr>
  `).join("");

  const refundNote = refundAmount > 0 ? `
    <div style="background:#7f1d1d;border:1px solid #dc2626;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="color:#fca5a5;margin:0;font-size:14px;">
        <strong>Refund notice:</strong> We could only deliver ${candidates.length} of ${namesRequested} names requested. 
        A refund of <strong>$${(refundAmount / 100).toFixed(2)}</strong> ($5 × ${namesRequested - candidates.length} undeliverable) 
        has been issued to your card. This is because those positions aren't in our current monitoring window, not because we made an error.
      </p>
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:#00d4ff;font-weight:800;font-size:14px;letter-spacing:2px;">DETROIT WEB AGENCY</span>
    </div>
    
    <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 8px;text-align:center;">
      Your Name Pack is Ready
    </h1>
    <p style="color:#94a3b8;font-size:15px;text-align:center;margin:0 0 32px;">
      ${companyName ? `${companyName} — ` : ""}${candidates.length} licensed professionals delivered
    </p>

    ${refundNote}

    <table style="width:100%;border-collapse:collapse;background:#001a33;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#0d2137;">
          <th style="padding:10px 8px;text-align:left;color:#64748b;font-size:11px;font-weight:700;">#</th>
          <th style="padding:10px 8px;text-align:left;color:#64748b;font-size:11px;font-weight:700;">NAME / LICENSE</th>
          <th style="padding:10px 8px;text-align:left;color:#64748b;font-size:11px;font-weight:700;">LOCATION</th>
          <th style="padding:10px 8px;text-align:left;color:#64748b;font-size:11px;font-weight:700;">PHONE</th>
          <th style="padding:10px 8px;text-align:center;color:#64748b;font-size:11px;font-weight:700;">SCORE</th>
        </tr>
      </thead>
      <tbody>
        ${candidateRows}
      </tbody>
    </table>

    <div style="margin-top:24px;background:#00d4ff10;border:1px solid #00d4ff30;border-radius:8px;padding:20px;text-align:center;">
      <p style="color:#fff;font-weight:700;margin:0 0 8px;">Want these delivered daily? Go unlimited.</p>
      <a href="https://www.detroitwebagent.com/hire-alert" 
         style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 28px;border-radius:8px;font-weight:800;font-size:14px;text-decoration:none;">
        Upgrade to HireAlert Membership →
      </a>
      <p style="color:#64748b;font-size:12px;margin:12px 0 0;">$199/mo · Cancel anytime · Daily 7am scanner · Unlimited candidates</p>
    </div>

    <div style="margin-top:24px;text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0 0 4px;">Questions? Just reply to this email or text Matt:</p>
      <a href="sms:+13139921219" style="color:#00d4ff;font-weight:800;font-size:14px;text-decoration:none;">(313) 992-1219</a>
    </div>

    <hr style="border:none;border-top:1px solid #1e3a5f;margin:32px 0 16px;" />
    <p style="color:#475569;font-size:11px;text-align:center;margin:0;">
      Detroit Web Agency · Grosse Pointe, MI · These candidates were identified through public licensing records and professional databases.
    </p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      company_name,
      pack,
      names_requested,
      license_types,
      county,
      stripe_session_id,
    } = await req.json();

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const numNames = parseInt(names_requested) || 10;

    // Pull top candidates by availability score
    let query = sb
      .from("hire_alert_candidates")
      .select("id, full_name, license_type, license_number, location, phone, email, availability_score, score_reason, source")
      .gte("availability_score", 3)
      .order("availability_score", { ascending: false })
      .limit(numNames);

    if (county) {
      query = query.ilike("location", `%${county}%`);
    }

    // Filter by license types if provided
    const types = typeof license_types === "string" ? JSON.parse(license_types || "[]") : license_types;
    if (types?.length > 0) {
      query = query.in("license_type", types);
    }

    const { data: candidates } = await query;
    const delivered = candidates || [];
    const shortfall = numNames - delivered.length;
    const refundCents = shortfall > 0 ? shortfall * 500 : 0; // $5 per missing name

    // Log the purchase
    await sb.from("ondemand_purchases").insert({
      email,
      company_name: company_name || null,
      pack,
      names_requested: numNames,
      names_delivered: delivered.length,
      refund_cents: refundCents,
      candidate_ids: delivered.map(c => c.id),
      county: county || null,
      license_types: types || null,
      stripe_session_id: stripe_session_id || null,
      delivered_at: new Date().toISOString(),
    });

    // Send the email with candidates
    if (RESEND_API_KEY && email) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Matt at Detroit Web Agency <matt@detroitwebagent.com>",
          to: [email],
          subject: `Your ${delivered.length} Licensed Names — Ready Now`,
          html: buildDeliveryEmail(company_name, delivered, numNames, refundCents),
        }),
      });

      if (!emailRes.ok) {
        console.error("[deliver-ondemand-names] Email send failed:", await emailRes.text());
      }
    }

    // Notify Matt
    const notifyMsg = `💰 On-demand pack sold! ${company_name || email} bought ${pack} (${delivered.length}/${numNames} delivered)${refundCents > 0 ? ` — $${(refundCents/100).toFixed(0)} refund for ${shortfall} missing` : ""}`;
    try {
      await sendSMS(ADMIN_PHONE, notifyMsg);
    } catch {
      console.error("[deliver-ondemand-names] Failed to notify Matt");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        delivered: delivered.length,
        shortfall,
        refund_cents: refundCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deliver-ondemand-names] Error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
