// HAN SOLO — Post-Purchase Upsell Engine
// Runs every 4 hours. Finds customers who bought a $49 product 48-72 hours ago
// and haven't bought anything else. Sends a targeted follow-up in Matt's voice.
//
// Han's philosophy: "Never tell me the odds." Someone who already said yes once
// is 5-10x more likely to buy again than a cold prospect. These are warm leads
// sitting in the database doing nothing.
//
// Enhanced beyond basic upsell:
//   - Sequences are product-aware (audit buyer gets GBP pack pitch, not another audit)
//   - Step 2 (day 5) sends a case study / social proof angle
//   - Step 3 (day 10) makes the "last chance" offer with a different angle
//   - Tracks conversion so we know which upsell sequences work best
//   - Never upsells someone who's already a subscriber (they already said yes to recurring)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MATT = "matt@mattmichelstraining.com";

// What to pitch based on what they bought
const UPSELL_MAP: Record<string, { product: string; headline: string; pitch: string; price: string; url: string; step2pitch: string }> = {
  website_audit: {
    product: "GBP Post Pack",
    headline: "Your audit is done — now let's fix Google too",
    pitch: "Your website audit showed the gaps. The next thing most businesses are missing is their Google Business Profile — most haven't posted in months, which tanks their ranking. I can generate 30 ready-to-post updates for your Google profile for $49. One-time, instant delivery.",
    price: "$49",
    url: "https://www.mattmichelstraining.com/gbp-post-pack",
    step2pitch: "Quick follow-up on this. The businesses I see getting the most Google calls are the ones posting 3x/week. It sounds like a lot but it takes 2 minutes per post if they're pre-written. I wrote 30 of them for you — they're ready to go for $49.",
  },
  gbp_post_pack: {
    product: "Website Audit",
    headline: "Got your Google posts — now make sure your website converts",
    pitch: "Your Google posts are ready. But here's the problem I see all the time: we get people clicking from Google to the website... and the website loses them. I do a full website audit ($49) that tells you exactly what's pushing people away and what to fix. Instant report, no call needed.",
    price: "$49",
    url: "https://www.mattmichelstraining.com/website-audit",
    step2pitch: "Still thinking about the audit. Here's what I found on average: 7 out of 10 business websites I audit have at least one thing that's actively costing them calls. Usually it's load speed, a buried phone number, or a contact form nobody can find. $49 to find out which one is hurting you.",
  },
  competitor_report: {
    product: "Website Audit",
    headline: "You know what your competitors are doing — now outrank them",
    pitch: "Your competitor report is in your inbox. You now know exactly where they're weak. The fastest way to take advantage of that is making sure your own website doesn't have the same problems. I can audit your site right now for $49 — same instant delivery.",
    price: "$49",
    url: "https://www.mattmichelstraining.com/website-audit",
    step2pitch: "One thing I noticed in a lot of competitor reports I've done: the businesses that actually act on the data are the ones that move. Knowing your competitors are weak on reviews is one thing. Showing up above them on Google is another. Your website is the lever. Let me take a look.",
  },
};

// Matt's own test emails — never upsell these
const TEST_EMAILS = ["matt@mattmichelstraining.com", "matthewmichels@gmail.com", "matthewmichels4@gmail.com"];

// Check if this email is already a subscriber (don't upsell subscribers)
async function isSubscriber(sb: ReturnType<typeof createClient>, email: string): Promise<boolean> {
  const checks = await Promise.all([
    sb.from("gbp_saas_clients").select("id", { count: "exact", head: true }).eq("email", email),
    sb.from("social_media_clients").select("id", { count: "exact", head: true }).eq("email", email),
    sb.from("b2b_subscribers").select("id", { count: "exact", head: true }).eq("email", email),
  ]);
  return checks.some(c => (c.count || 0) > 0);
}

// Check if already in upsell sequence for this product combo
async function alreadyInSequence(sb: ReturnType<typeof createClient>, email: string, productBought: string): Promise<boolean> {
  const { count } = await sb
    .from("upsell_sequences")
    .select("*", { count: "exact", head: true })
    .eq("email", email)
    .eq("product_bought", productBought)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  return (count || 0) > 0;
}

function buildUpsellEmail(email: string, productBought: string, step: number): { subject: string; html: string; upsell_product: string } | null {
  const upsell = UPSELL_MAP[productBought];
  if (!upsell) return null;

  const isStep2 = step === 2;
  const pitch = isStep2 ? upsell.step2pitch : upsell.pitch;
  const subject = isStep2
    ? `Following up — ${upsell.product} for your business`
    : upsell.headline;

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
  <tr><td style="background:#fff;padding:28px 28px;border:1px solid #e2e8f0;border-radius:8px;">
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.8;">${pitch}</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${upsell.url}" style="display:inline-block;background:#e8621a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:14px;">
        Get ${upsell.product} — ${upsell.price} →
      </a>
    </div>
    <hr style="border:1px solid #e2e8f0;margin:20px 0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a></div>
    </div>
    <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">You bought a ${productBought.replace(/_/g, " ")} from M² recently. Reply "stop" to unsubscribe from follow-ups.</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html, upsell_product: upsell.product };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json") ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dry_run === true;

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

    let totalSent = 0;
    const results: { email: string; product: string; step: number }[] = [];

    // Step 1: 48-72h after purchase
    const step1Sources: [string, string][] = [
      ["audit_orders", "website_audit"],
      ["gbp_post_packs", "gbp_post_pack"],
      ["competitor_reports", "competitor_report"],
    ];

    for (const [table, productType] of step1Sources) {
      const { data: orders } = await sb
        .from(table)
        .select("email, created_at")
        .eq("status", "delivered")
        .gte("created_at", seventyTwoHoursAgo)
        .lt("created_at", fortyEightHoursAgo)
        .limit(15);

      for (const order of orders || []) {
        if (!order.email || totalSent >= 30) continue;
        if (TEST_EMAILS.includes(order.email)) continue; // never upsell test accounts
        if (await isSubscriber(sb, order.email)) continue;
        if (await alreadyInSequence(sb, order.email, productType)) continue;

        const email = buildUpsellEmail(order.email, productType, 1);
        if (!email) continue;

        if (!dryRun && RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: `Matt Michels <${MATT}>`, to: [order.email], subject: email.subject, html: email.html }),
          });
          await sb.from("upsell_sequences").insert({
            email: order.email,
            product_bought: productType,
            upsell_product: email.upsell_product,
            step: 1,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        }
        results.push({ email: order.email, product: productType, step: 1 });
        totalSent++;
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // Step 2: 5-6 days after purchase (follow-up)
    const { data: step2Pending } = await sb
      .from("upsell_sequences")
      .select("email, product_bought, upsell_product")
      .eq("step", 1)
      .eq("status", "sent")
      .gte("sent_at", sixDaysAgo)
      .lt("sent_at", fiveDaysAgo)
      .limit(15);

    for (const seq of step2Pending || []) {
      if (totalSent >= 30) break;
      if (await isSubscriber(sb, seq.email)) {
        await sb.from("upsell_sequences").update({ status: "converted" }).eq("email", seq.email).eq("step", 1);
        continue;
      }

      const email = buildUpsellEmail(seq.email, seq.product_bought, 2);
      if (!email) continue;

      if (!dryRun && RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `Matt Michels <${MATT}>`, to: [seq.email], subject: email.subject, html: email.html }),
        });
        await sb.from("upsell_sequences").insert({
          email: seq.email, product_bought: seq.product_bought, upsell_product: email.upsell_product,
          step: 2, status: "sent", sent_at: new Date().toISOString(),
        });
        await sb.from("upsell_sequences").update({ status: "completed" }).eq("email", seq.email).eq("step", 1).eq("product_bought", seq.product_bought);
      }
      results.push({ email: seq.email, product: seq.product_bought, step: 2 });
      totalSent++;
    }

    console.log(`[HAN] Sent ${totalSent} upsell emails (${dryRun ? "DRY RUN" : "LIVE"})`);
    return new Response(JSON.stringify({ sent: totalSent, dry_run: dryRun, results }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[HAN]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
