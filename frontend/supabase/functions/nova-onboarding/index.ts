// nova-onboarding — First-7-day value sequence for new clients
// Day 3: product-specific tip email | Day 7: first-week summary
// Cron: daily 2pm UTC (10am ET)
// Agent: Nova

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Each entry: { table, emailCol, nameCol, product }
const CLIENT_TABLES = [
  { table: "sms_blast_clients",           emailCol: "email", nameCol: "business_name", product: "Weekly SMS Blast" },
  { table: "noshow_clients",              emailCol: "email", nameCol: "business_name", product: "No-Show Re-Booker" },
  { table: "estimate_drip_clients",       emailCol: "email", nameCol: "business_name", product: "Estimate Follow-Up Drip" },
  { table: "invoice_chaser_clients",      emailCol: "email", nameCol: "business_name", product: "Invoice Chaser" },
  { table: "afterjob_drip_clients",       emailCol: "email", nameCol: "business_name", product: "After-Job Drip" },
  { table: "promo_blaster_clients",       emailCol: "email", nameCol: "business_name", product: "Seasonal Promo Blaster" },
  { table: "referral_program_clients",    emailCol: "email", nameCol: "business_name", product: "Referral Program" },
  { table: "slow_day_clients",            emailCol: "email", nameCol: "business_name", product: "Slow Day SMS" },
  { table: "homeowner_campaign_clients",  emailCol: "email", nameCol: "business_name", product: "New Homeowner Campaign" },
  { table: "review_monitor_clients",      emailCol: "email", nameCol: "business_name", product: "Review Monitor" },
  { table: "gbp_saas_clients",            emailCol: "email", nameCol: "business_name", product: "GBP Automation" },
  { table: "social_media_clients",        emailCol: "email", nameCol: "business_name", product: "Social Media AI" },
  { table: "contractor_clients",          emailCol: "email", nameCol: "business_name", product: "Contractor Lead Gen" },
];

const DAY3_TIPS: Record<string, string> = {
  "Weekly SMS Blast":         "Pro tip: Schedule your blast for Tuesday 10am — highest open rates for service businesses. Your clients are already in work mode and receptive.",
  "No-Show Re-Booker":        "Pro tip: The re-booking SMS fires within 2 hours of a missed appointment. Add a small incentive (10% off) to your message template to boost rebooking rates.",
  "Estimate Follow-Up Drip":  "Pro tip: The Day 3 follow-up has the highest conversion rate. Make sure your estimate includes a clear expiry date — urgency drives decisions.",
  "Invoice Chaser":           "Pro tip: The friendly Day 1 reminder recovers 40% of late invoices. For stubborn ones, the Day 7 message shifts to a firmer tone automatically.",
  "After-Job Drip":           "Pro tip: Customers who get a check-in 48 hours after service are 3x more likely to leave a review. Your sequence handles this automatically.",
  "Seasonal Promo Blaster":   "Pro tip: Upload your customer list with job types tagged so your promos target the right audience. Spring = HVAC, Fall = roofing and gutter cleaning.",
  "Referral Program":         "Pro tip: The referral SMS fires 14 days after job completion — that's the sweet spot when satisfaction is highest. Your link tracks conversions automatically.",
  "Slow Day SMS":             "Pro tip: Trigger a slow day blast when you have 2+ open slots. Last-minute deals with a 24-hour window convert at 15-20% for service businesses.",
  "New Homeowner Campaign":   "Pro tip: New homeowners spend 3x more on home services in their first year. Your campaign catches them in the buying window — make sure your offer is strong.",
  "Review Monitor":           "Pro tip: Responding to reviews within 24 hours improves your star rating recovery by 50%. You'll get notified instantly when new reviews come in.",
  "GBP Automation":           "Pro tip: Google rewards profiles that post consistently. Your 3x/week posts are already building authority — add a photo to your next post for a 35% engagement boost.",
  "Social Media AI":          "Pro tip: The AI personalizes posts to your industry and location. Reply to at least one comment per week — engagement signals boost reach for your whole account.",
  "Contractor Lead Gen":       "Pro tip: Leads are delivered in real time. The fastest responders (under 5 minutes) close at 4x the rate. Set up call forwarding so you never miss a hot lead.",
};

function getDay3Email(product: string, businessName: string): { subject: string; html: string } {
  const tip = DAY3_TIPS[product] ?? `Here's a tip to get the most out of your ${product} service: check in with your dashboard regularly and reach out to matt@mattmichelstraining.com if you have questions.`;
  return {
    subject: `Quick tip for your ${product} — day 3`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
        <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;margin-bottom:16px" />
        <p>Hey ${businessName || "there"} — it's Matt.</p>
        <p>You signed up for <strong>${product}</strong> a few days ago and I wanted to share one tip that'll help you get the most out of it:</p>
        <blockquote style="border-left:3px solid #e8621a;padding-left:16px;margin:16px 0;color:#334155">${tip}</blockquote>
        <p>Any questions at all — just reply to this email. I read every one.</p>
        <p>— Matt</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="color:#94a3b8;font-size:12px">M² Development · matt@mattmichelstraining.com · (313) 992-1219<br>
        <a href="https://mattmichelstraining.com/unsubscribe" style="color:#94a3b8">Unsubscribe</a></p>
      </div>`,
  };
}

function getDay7Email(product: string, businessName: string): { subject: string; html: string } {
  return {
    subject: `Your first week with ${product} — here's what happened`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
        <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;margin-bottom:16px" />
        <p>Hey ${businessName || "there"} — one week in!</p>
        <p>Your <strong>${product}</strong> automation has been running quietly in the background all week. That's the whole idea — you focus on running your business, we handle the follow-up.</p>
        <p>A few things to keep in mind as you settle in:</p>
        <ul style="padding-left:20px;line-height:1.8">
          <li>Log in to your dashboard to review activity from the first week</li>
          <li>Make sure your contact list is up to date for best results</li>
          <li>Reply to any leads or replies your system flagged</li>
        </ul>
        <p>If anything feels off or you want to tweak your setup — just reply here. I'm always reachable.</p>
        <p>Here's to a strong second week. 🤝</p>
        <p>— Matt</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="color:#94a3b8;font-size:12px">M² Development · matt@mattmichelstraining.com · (313) 992-1219<br>
        <a href="https://mattmichelstraining.com/unsubscribe" style="color:#94a3b8">Unsubscribe</a></p>
      </div>`,
  };
}

async function alreadySent(email: string, product: string, dayNumber: number): Promise<boolean> {
  const { data } = await supabase
    .from("nova_sends")
    .select("id")
    .eq("client_email", email)
    .eq("product", product)
    .eq("day_number", dayNumber)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt at M² <matt@mattmichelstraining.com>",
      to: [to],
      subject,
      html,
    }),
  });
}

async function processTable(
  table: string,
  emailCol: string,
  nameCol: string,
  product: string,
  daysAgo: number,
  dayNumber: 3 | 7,
): Promise<number> {
  // Fetch all active clients created AT LEAST daysAgo days ago.
  // alreadySent() deduplication ensures each client gets each step exactly once,
  // so if a cron run was missed the email still goes out on the next run.
  const threshold = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const { data: clients } = await (supabase.from as any)(table)
    .select(`${emailCol}, ${nameCol}, active`)
    .eq("active", true)
    .lte("created_at", threshold);

  if (!clients?.length) return 0;

  let sent = 0;
  for (const client of clients) {
    const email = client[emailCol];
    const name = client[nameCol];
    if (!email) continue;
    if (await alreadySent(email, product, dayNumber)) continue;

    const { subject, html } = dayNumber === 3
      ? getDay3Email(product, name)
      : getDay7Email(product, name);

    await sendEmail(email, subject, html);
    await supabase.from("nova_sends").insert({ client_email: email, product, day_number: dayNumber });
    sent++;
  }
  return sent;
}

async function updateHeartbeat(status: "ok" | "error") {
  await supabase.from("agent_heartbeats").upsert({
    agent_name: "nova",
    last_run_at: new Date().toISOString(),
    last_status: status,
  });
}

Deno.serve(async () => {
  try {
    console.log("[nova-onboarding] Starting onboarding run");
    let totalSent = 0;

    for (const { table, emailCol, nameCol, product } of CLIENT_TABLES) {
      const [day3, day7] = await Promise.all([
        processTable(table, emailCol, nameCol, product, 3, 3),
        processTable(table, emailCol, nameCol, product, 7, 7),
      ]);
      totalSent += day3 + day7;
      if (day3 + day7 > 0) {
        console.log(`[nova-onboarding] ${product}: ${day3} Day-3, ${day7} Day-7`);
      }
    }

    await updateHeartbeat("ok");
    console.log(`[nova-onboarding] Done: ${totalSent} onboarding emails sent`);

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[nova-onboarding] Error:", err);
    await updateHeartbeat("error");
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
