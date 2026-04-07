// cashier-dunning — Automated payment failure email drip (Day 1, 3, 7)
// Cron: daily 12pm UTC (8am ET)
// Agent: Cashier

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const MATT_EMAIL = "matt@mattmichelstraining.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface DunningRecord {
  customer_email: string;
  stripe_customer_id: string;
  day_number: number;
  amount_cents: number;
}

async function sendDunningEmail(record: DunningRecord) {
  const portalUrl = `https://billing.stripe.com/p/login/test_placeholder`;

  const subjects: Record<number, string> = {
    1: "Your payment didn't go through — action needed",
    3: "Reminder: your account may be paused soon",
    7: "Final notice — your service has been paused",
  };

  const bodies: Record<number, string> = {
    1: `
      <p>Hey — we tried to process your payment of <strong>$${(record.amount_cents / 100).toFixed(2)}</strong> but it didn't go through.</p>
      <p>No worries, it happens. Just update your card and you're good to go:</p>
      <p><a href="${portalUrl}" style="background:#e8621a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Update Payment Method →</a></p>
      <p style="color:#94a3b8;font-size:13px">Your service is still active. We'll try again in 3 days.</p>`,
    3: `
      <p>We've tried your payment twice now and it's still not going through.</p>
      <p>Your service will be paused if we can't process payment in the next <strong>4 days</strong>. Please update your card:</p>
      <p><a href="${portalUrl}" style="background:#e8621a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Update Payment Method →</a></p>
      <p style="color:#94a3b8;font-size:13px">Need help? Just reply to this email.</p>`,
    7: `
      <p>We've been unable to process your payment and your service has been <strong>paused</strong>.</p>
      <p>To reactivate, please update your payment method:</p>
      <p><a href="${portalUrl}" style="background:#e8621a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Reactivate My Account →</a></p>
      <p style="color:#94a3b8;font-size:13px">Your data is safe and your account will reactivate instantly once payment is updated.</p>`,
  };

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt at M² <matt@mattmichelstraining.com>",
      to: [record.customer_email],
      subject: subjects[record.day_number],
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;margin-bottom:16px" />
          <h2 style="margin:0 0 16px;font-size:20px">Payment Update Needed</h2>
          ${bodies[record.day_number]}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
          <p style="color:#94a3b8;font-size:12px">M² Development · matt@mattmichelstraining.com · (313) 806-4952</p>
        </div>`,
    }),
  });
}

async function getFailedChargesLast24h(): Promise<DunningRecord[]> {
  // Query Stripe for charges that failed in the last 24 hours
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const res = await fetch(
    `https://api.stripe.com/v1/charges?created[gte]=${since}&limit=100`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
  );
  const data = await res.json();
  if (!data.data) return [];

  const failed = data.data.filter(
    (c: any) => c.status === "failed" && c.customer && c.billing_details?.email
  );

  return failed.map((c: any) => ({
    customer_email: c.billing_details.email,
    stripe_customer_id: c.customer,
    day_number: 1,
    amount_cents: c.amount,
  }));
}

async function alreadySentToday(email: string, day: number): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("dunning_sends")
    .select("id")
    .eq("customer_email", email)
    .eq("day_number", day)
    .gte("sent_at", since.toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function getDayNSends(fromDay: number, daysAgo: number): Promise<DunningRecord[]> {
  const targetDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from("dunning_sends")
    .select("customer_email, stripe_customer_id, amount_cents")
    .eq("day_number", fromDay)
    .gte("sent_at", startOfDay.toISOString())
    .lte("sent_at", endOfDay.toISOString());

  return (data ?? []).map((r) => ({
    ...r,
    day_number: fromDay === 1 ? 3 : 7,
    amount_cents: r.amount_cents ?? 0,
  }));
}

async function updateHeartbeat(status: "ok" | "error") {
  await supabase.from("agent_heartbeats").upsert({
    agent_name: "cashier",
    last_run_at: new Date().toISOString(),
    last_status: status,
  });
}

Deno.serve(async () => {
  try {
    console.log("[cashier-dunning] Starting dunning run");

    // Get all sends needed today
    const [day1Sends, day3Sends, day7Sends] = await Promise.all([
      getFailedChargesLast24h(),           // New failures → Day 1
      getDayNSends(1, 2),                  // Day 1 sent 2 days ago → Day 3
      getDayNSends(3, 4),                  // Day 3 sent 4 days ago → Day 7
    ]);

    const allSends = [...day1Sends, ...day3Sends, ...day7Sends];
    let sent = 0;
    let skipped = 0;

    for (const record of allSends) {
      const alreadySent = await alreadySentToday(record.customer_email, record.day_number);
      if (alreadySent) { skipped++; continue; }

      await sendDunningEmail(record);
      await supabase.from("dunning_sends").insert({
        customer_email: record.customer_email,
        stripe_customer_id: record.stripe_customer_id,
        day_number: record.day_number,
        amount_cents: record.amount_cents,
      });
      sent++;
    }

    // Notify Matt with summary if any sends happened
    if (sent > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Cashier <matt@mattmichelstraining.com>",
          to: [MATT_EMAIL],
          subject: `💳 Dunning: ${sent} payment failure email${sent > 1 ? "s" : ""} sent`,
          html: `<p>Cashier sent <strong>${sent}</strong> dunning email${sent > 1 ? "s" : ""} today (${skipped} skipped as duplicates). Day breakdown: ${day1Sends.length} Day-1, ${day3Sends.length} Day-3, ${day7Sends.length} Day-7.</p>`,
        }),
      });
    }

    await updateHeartbeat("ok");
    console.log(`[cashier-dunning] Done: ${sent} sent, ${skipped} skipped`);

    return new Response(JSON.stringify({ ok: true, sent, skipped }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cashier-dunning] Error:", err);
    await updateHeartbeat("error");
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
