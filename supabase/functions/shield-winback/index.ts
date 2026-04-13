// shield-winback — Automated win-back email sequence after cancellation
// Cron: daily 1pm UTC (9am ET)
// Agent: Shield
// Also triggered by stripe-webhook on customer.subscription.deleted

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const MATT_EMAIL = "matt@mattmichelstraining.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const STEP_DELAYS_DAYS = { 1: 0, 2: 3, 3: 7 } as const;

function getEmailContent(step: number, product: string, email: string) {
  const checkoutUrl = `https://mattmichelstraining.com/pricing`;

  const contents: Record<number, { subject: string; body: string }> = {
    1: {
      subject: `We're sad to see you go — here's 20% off to come back`,
      body: `
        <p>Hey — we noticed you cancelled your ${product} subscription. We're bummed to lose you.</p>
        <p>If it was about price, we'd like to make it right. Use code <strong>COMEBACK20</strong> for <strong>20% off</strong> your first month back:</p>
        <p><a href="${checkoutUrl}" style="background:#e8621a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Reactivate at 20% Off →</a></p>
        <p style="color:#94a3b8;font-size:13px">This offer expires in 7 days. If there was something we could have done better, just reply — Matt reads every message.</p>`,
    },
    2: {
      subject: `Your comeback offer expires in 3 days`,
      body: `
        <p>Just a heads up — your 20% off offer for ${product} expires in <strong>3 days</strong>.</p>
        <p>Use code <strong>COMEBACK20</strong> at checkout:</p>
        <p><a href="${checkoutUrl}" style="background:#e8621a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Claim Your Discount →</a></p>
        <p style="color:#94a3b8;font-size:13px">No hard feelings if it's not the right time. We'll be here when you're ready.</p>`,
    },
    3: {
      subject: `Last chance — your M² offer expires tonight`,
      body: `
        <p>This is the last email we'll send. Your 20% off offer for ${product} expires today.</p>
        <p><a href="${checkoutUrl}" style="background:#e8621a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Reactivate Before Midnight →</a></p>
        <p style="color:#94a3b8;font-size:13px">Thanks for giving us a try. We hope to earn you back someday. — Matt</p>`,
    },
  };

  return contents[step] ?? contents[1];
}

async function processSequences() {
  const now = new Date();
  let sent = 0;
  const won = 0;

  // Get all active win-back sequences
  const { data: sequences } = await supabase
    .from("winback_sequences")
    .select("*")
    .eq("status", "active");

  if (!sequences || sequences.length === 0) return { sent, won };

  for (const seq of sequences) {
    const delayDays = STEP_DELAYS_DAYS[seq.step as keyof typeof STEP_DELAYS_DAYS] ?? 0;
    const createdAt = new Date(seq.created_at);
    const sendAfter = new Date(createdAt.getTime() + delayDays * 24 * 60 * 60 * 1000);

    // Not time yet for this step
    if (now < sendAfter) continue;

    // Skip if already sent this step
    if (seq.last_sent_at) {
      const lastSent = new Date(seq.last_sent_at);
      const daysSinceSend = (now.getTime() - lastSent.getTime()) / (24 * 60 * 60 * 1000);
      const nextStepDelay =
        seq.step === 1
          ? STEP_DELAYS_DAYS[2] - STEP_DELAYS_DAYS[1]
          : STEP_DELAYS_DAYS[3] - STEP_DELAYS_DAYS[2];
      if (daysSinceSend < nextStepDelay - 0.5) continue;
    }

    const { subject, body } = getEmailContent(seq.step, seq.product, seq.customer_email);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt at M² <matt@mattmichelstraining.com>",
        to: [seq.customer_email],
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;margin-bottom:16px" />
            ${body}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
            <p style="color:#94a3b8;font-size:12px">M² Development · matt@mattmichelstraining.com · (313) 992-1219<br>
            <a href="https://mattmichelstraining.com/unsubscribe?email=${encodeURIComponent(seq.customer_email)}" style="color:#94a3b8">Unsubscribe</a></p>
          </div>`,
      }),
    });

    sent++;

    const nextStep = seq.step + 1;
    if (nextStep > 3) {
      // Sequence exhausted
      await supabase
        .from("winback_sequences")
        .update({ status: "exhausted", last_sent_at: now.toISOString() })
        .eq("id", seq.id);
    } else {
      await supabase
        .from("winback_sequences")
        .update({ step: nextStep, last_sent_at: now.toISOString() })
        .eq("id", seq.id);
    }
  }

  return { sent, won };
}

async function updateHeartbeat(status: "ok" | "error") {
  await supabase.from("agent_heartbeats").upsert({
    agent_name: "shield",
    last_run_at: new Date().toISOString(),
    last_status: status,
  });
}

Deno.serve(async (req) => {
  try {
    // Can be triggered directly (with a body) to create a new win-back sequence
    // e.g. from stripe-webhook on customer.subscription.deleted
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.customer_email && body.product) {
        // Check not already in an active sequence
        const { data: existing } = await supabase
          .from("winback_sequences")
          .select("id")
          .eq("customer_email", body.customer_email)
          .eq("status", "active")
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("winback_sequences").insert({
            customer_email: body.customer_email,
            product: body.product,
            stripe_subscription_id: body.stripe_subscription_id ?? null,
            step: 1,
            status: "active",
          });
          console.log(`[shield-winback] Created win-back sequence for ${body.customer_email}`);
        }
      }
    }

    // Only batch-process sequences on cron (GET/no-body), not on webhook POST
    const isCronRun = req.method !== "POST";
    const { sent } = isCronRun ? await processSequences() : { sent: 0 };

    await updateHeartbeat("ok");
    if (isCronRun) console.log(`[shield-winback] Done: ${sent} win-back emails sent`);

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[shield-winback] Error:", err);
    await updateHeartbeat("error");
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
