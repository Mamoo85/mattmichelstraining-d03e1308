import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADMIN_EMAIL = "matt@m2training.com";

const log = (msg: string, data?: any) => {
  const d = data ? ` — ${JSON.stringify(data)}` : "";
  console.log(`[SEND-AFFILIATE-PAYOUT-REPORT] ${msg}${d}`);
};


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all pending commissions
    const { data: pendingCommissions, error } = await sb
      .from("affiliate_commissions" as any)
      .select("*")
      .eq("status", "pending");

    if (error) throw error;
    if (!pendingCommissions || pendingCommissions.length === 0) {
      log("No pending commissions");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Pending commissions found", { count: pendingCommissions.length });

    const monthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-03"

    // Group by referrer
    const byReferrer: Record<string, { commissions: any[]; totalCents: number }> = {};
    for (const c of pendingCommissions) {
      if (!byReferrer[c.referrer_user_id]) {
        byReferrer[c.referrer_user_id] = { commissions: [], totalCents: 0 };
      }
      byReferrer[c.referrer_user_id].commissions.push(c);
      byReferrer[c.referrer_user_id].totalCents += c.commission_amount_cents || 0;
    }

    const referrerIds = Object.keys(byReferrer);
    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", referrerIds);

    const profileMap: Record<string, any> = {};
    for (const p of profiles || []) profileMap[p.user_id] = p;

    // Create payout batch
    const totalCents = pendingCommissions.reduce((s: number, c: any) => s + (c.commission_amount_cents || 0), 0);
    const { data: batch } = await sb
      .from("affiliate_payout_batches" as any)
      .insert({
        month: monthStr,
        total_commissions_cents: totalCents,
        affiliates_count: referrerIds.length,
      })
      .select()
      .single();

    // Mark commissions as approved + attach batch id
    const commissionIds = pendingCommissions.map((c: any) => c.id);
    await sb
      .from("affiliate_commissions" as any)
      .update({ status: "approved", payout_batch_id: batch?.id })
      .in("id", commissionIds);

    // Build admin email
    let affiliateRows = "";
    for (const uid of referrerIds) {
      const profile = profileMap[uid];
      const { commissions, totalCents: total } = byReferrer[uid];
      affiliateRows += `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #333;">${profile?.full_name || "Unknown"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #333;">${profile?.email || uid}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #333;">${commissions.length}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #333;color:#22c55e;font-weight:bold;">$${(total / 100).toFixed(2)}</td>
        </tr>`;
    }

    const adminHtml = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#0a0a14;color:#ccc;padding:24px;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#f97316;height:3px;margin-bottom:20px;"></div>
  <h1 style="color:#f97316;font-size:20px;">M² Affiliate Payout Report — ${monthStr}</h1>
  <p>Total owed: <strong style="color:#22c55e;">$${(totalCents / 100).toFixed(2)}</strong> across ${referrerIds.length} affiliates</p>
  <table width="100%" style="border-collapse:collapse;background:#0f0f1a;">
    <thead>
      <tr style="background:#1a1a2e;">
        <th style="padding:8px 12px;text-align:left;color:#f97316;">Name</th>
        <th style="padding:8px 12px;text-align:left;color:#f97316;">Email</th>
        <th style="padding:8px 12px;text-align:left;color:#f97316;">Conversions</th>
        <th style="padding:8px 12px;text-align:left;color:#f97316;">Amount</th>
      </tr>
    </thead>
    <tbody>${affiliateRows}</tbody>
  </table>
  <p style="margin-top:20px;font-size:12px;color:#666;">Send payment to each affiliate, then mark commissions as paid in the admin panel (Vault → Affiliates).</p>
</div>
</body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "M² Training <matt@mattmichelstraining.com>",
        to: [ADMIN_EMAIL],
        subject: `Affiliate Payout Report — ${monthStr} — $${(totalCents / 100).toFixed(2)} owed`,
        html: adminHtml,
      }),
    });

    // Send each affiliate their earnings statement
    let affiliateEmailsSent = 0;
    for (const uid of referrerIds) {
      const profile = profileMap[uid];
      if (!profile?.email) continue;

      const { commissions, totalCents: total } = byReferrer[uid];
      const name = profile.full_name || "there";

      const affiliateHtml = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#0a0a14;color:#ccc;padding:24px;">
<div style="max-width:580px;margin:0 auto;">
  <div style="background:#f97316;height:3px;margin-bottom:20px;"></div>
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:28px;font-weight:900;color:#f97316;">M²</div>
    <div style="font-size:9px;color:#888;letter-spacing:4px;text-transform:uppercase;">TRAINING</div>
  </div>
  <p style="color:#fff;font-size:16px;font-weight:bold;">Hey ${name} —</p>
  <p>You earned <strong style="color:#22c55e;">$${(total / 100).toFixed(2)}</strong> in referral commissions this month. ${commissions.length} person${commissions.length > 1 ? "s" : ""} signed up with your link.</p>
  <p>I'll send your payout within the next few business days. Keep sharing — there's no cap on what you can earn.</p>
  <p style="color:#fff;font-weight:bold;">— Matt</p>
  <p style="color:#f97316;font-size:12px;">M² Training · Your referral link: mattmichelstraining.com?ref=<em>[your profile code]</em></p>
</div>
</body></html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [profile.email],
          subject: `You earned $${(total / 100).toFixed(2)} in M² referrals — ${monthStr}`,
          html: affiliateHtml,
        }),
      });

      affiliateEmailsSent++;
      await new Promise((r) => setTimeout(r, 200));
    }

    log("Done", { adminEmailSent: true, affiliateEmailsSent, totalPayout: `$${(totalCents / 100).toFixed(2)}` });

    return new Response(JSON.stringify({ success: true, affiliateEmailsSent, totalCents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SEND-AFFILIATE-PAYOUT-REPORT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
