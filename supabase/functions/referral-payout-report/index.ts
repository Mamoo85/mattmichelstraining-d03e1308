import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (_req) => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get all approved conversions grouped by partner where total_earned >= payout_threshold
    const { data: partners } = await sb
      .from("b2b_referral_partners")
      .select("*")
      .eq("status", "active");

    if (!partners || partners.length === 0) {
      return new Response(JSON.stringify({ message: "No active partners" }), { status: 200 });
    }

    const payoutRows: string[] = [];
    let totalDue = 0;

    for (const partner of partners) {
      // Get approved but unpaid conversions
      const { data: conversions } = await sb
        .from("b2b_referral_conversions")
        .select("*")
        .eq("partner_id", partner.id)
        .eq("status", "approved");

      if (!conversions || conversions.length === 0) continue;

      const amount = conversions.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);
      if (amount < (partner.payout_threshold || 50)) continue;

      totalDue += amount;
      payoutRows.push(
        `<tr>
          <td style="padding:6px 12px;border:1px solid #ddd;">${partner.name}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${partner.email}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${partner.payout_handle || "N/A"}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${conversions.length}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold;">$${amount.toFixed(2)}</td>
        </tr>`
      );
    }

    if (payoutRows.length === 0) {
      console.log("[PAYOUT-REPORT] No payouts due this week.");
      return new Response(JSON.stringify({ message: "No payouts due" }), { status: 200 });
    }

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `💰 Weekly Referral Payouts Due — $${totalDue.toFixed(2)}`,
          html: `<h2>Referral Partner Payouts Due</h2>
            <p>${payoutRows.length} partner(s) have earned enough for payout this week:</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0;">
              <thead><tr>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Partner</th>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Email</th>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Venmo/PayPal</th>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Conversions</th>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Amount Due</th>
              </tr></thead>
              <tbody>${payoutRows.join("")}</tbody>
            </table>
            <p><strong>Total due: $${totalDue.toFixed(2)}</strong></p>
            <p>Go to Admin → B2B Referrals to mark as paid after sending.</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ partners_due: payoutRows.length, total: totalDue }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PAYOUT-REPORT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
