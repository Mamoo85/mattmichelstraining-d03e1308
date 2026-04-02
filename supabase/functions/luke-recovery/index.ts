// LUKE SKYWALKER — Cart Abandonment Recovery
// Runs every hour at :30 past. Finds people who started a checkout but didn't finish.
// Sends 2 recovery emails: first at 1h, second at 24h. Then stops — no spam.
//
// Luke doesn't give up. But he's not annoying about it either.
// One hour after they leave: "Hey, you left something." Simple.
// 24 hours later: "Still there if you want it." Clean exit if they don't.
//
// Enhanced beyond basic recovery:
//   - Recovers all 3 product types (audit, GBP pack, competitor report)
//   - Email copy acknowledges they were THIS CLOSE — no pressure, just a nudge
//   - Second email takes a completely different angle (value-focused vs urgency)
//   - Marks recovered when they DO complete a purchase (via stripe webhook flag)
//   - Recovery rate tracked in cart_abandonments table

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MATT = "matt@mattmichelstraining.com";

const PRODUCT_DETAILS: Record<string, { name: string; url: string; tagline: string; value_prop: string }> = {
  website_audit: {
    name: "Website Audit",
    url: "https://www.mattmichelstraining.com/website-audit",
    tagline: "Your free website audit is still waiting",
    value_prop: "Most businesses I audit have 3-5 things actively costing them calls. Takes me 2 minutes to generate. Takes you 5 minutes to read. Costs $49.",
  },
  gbp_post_pack: {
    name: "GBP Post Pack",
    url: "https://www.mattmichelstraining.com/gbp-post-pack",
    tagline: "Your 30 Google posts are still ready",
    value_prop: "Businesses that post to Google weekly get 5x more profile views. I wrote 30 posts for you. They're sitting there. $49 to get them.",
  },
  competitor_report: {
    name: "Competitor Report",
    url: "https://www.mattmichelstraining.com/ai-competitor-report",
    tagline: "Your competitor analysis is ready to run",
    value_prop: "You were one step away from knowing exactly where your competitors are weak. That information is worth a lot more than $49. Still there when you're ready.",
  },
};

function buildRecovery1Email(productType: string, email: string): { subject: string; html: string } {
  const product = PRODUCT_DETAILS[productType] || PRODUCT_DETAILS["website_audit"];
  const subject = product.tagline;

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
  <tr><td style="background:#fff;padding:28px 28px;border:1px solid #e2e8f0;border-radius:8px;">
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.8;">Hey, looks like you started a ${product.name} but didn't finish.</p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.8;">No big deal — happens all the time. Just wanted to make sure it wasn't a glitch on our end.</p>
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.8;">If you're still interested: ${product.value_prop}</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${product.url}" style="display:inline-block;background:#e8621a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:14px;">
        Complete Your ${product.name} — $49 →
      </a>
    </div>
    <hr style="border:1px solid #e2e8f0;margin:20px 0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br><a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a></div>
    </div>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html };
}

function buildRecovery2Email(productType: string): { subject: string; html: string } {
  const product = PRODUCT_DETAILS[productType] || PRODUCT_DETAILS["website_audit"];
  const subject = `Last note on your ${product.name}`;

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
  <tr><td style="background:#fff;padding:28px 28px;border:1px solid #e2e8f0;border-radius:8px;">
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.8;">One more note on your ${product.name} — then I'll leave you alone, I promise.</p>
    <div style="background:#1e293b;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;font-size:14px;color:#f1f5f9;line-height:1.8;">${product.value_prop}</p>
    </div>
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.8;">If the timing's not right, just ignore this. No hard feelings. If it is — link below.</p>
    <div style="text-align:center;margin:20px 0;">
      <a href="${product.url}" style="display:inline-block;background:#e8621a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:14px;">
        Get My ${product.name} →
      </a>
    </div>
    <hr style="border:1px solid #e2e8f0;margin:20px 0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br><a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a></div>
    </div>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json") ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dry_run === true;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    let sent = 0;

    // Recovery 1: carts abandoned 1-2 hours ago, no recovery email sent yet
    const { data: recovery1Needed } = await sb
      .from("cart_abandonments")
      .select("id, email, product_type")
      .is("recovery_1_sent_at", null)
      .eq("recovered", false)
      .not("email", "is", null)
      .gte("created_at", twoHoursAgo)
      .lt("created_at", oneHourAgo)
      .limit(20);

    for (const cart of recovery1Needed || []) {
      if (!cart.email || !cart.product_type) continue;
      const { subject, html } = buildRecovery1Email(cart.product_type, cart.email);
      if (!dryRun && RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `Matt Michels <${MATT}>`, to: [cart.email], subject, html }),
        });
        if (res.ok) {
          await sb.from("cart_abandonments").update({ recovery_1_sent_at: new Date().toISOString() }).eq("id", cart.id);
          sent++;
        }
      } else {
        sent++;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    // Recovery 2: carts with recovery_1 sent 23-25 hours ago, still not recovered
    const { data: recovery2Needed } = await sb
      .from("cart_abandonments")
      .select("id, email, product_type")
      .not("recovery_1_sent_at", "is", null)
      .is("recovery_2_sent_at", null)
      .eq("recovered", false)
      .not("email", "is", null)
      .gte("recovery_1_sent_at", twentyFiveHoursAgo)
      .lt("recovery_1_sent_at", twentyThreeHoursAgo)
      .limit(20);

    for (const cart of recovery2Needed || []) {
      if (!cart.email || !cart.product_type) continue;
      const { subject, html } = buildRecovery2Email(cart.product_type);
      if (!dryRun && RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `Matt Michels <${MATT}>`, to: [cart.email], subject, html }),
        });
        if (res.ok) {
          await sb.from("cart_abandonments").update({ recovery_2_sent_at: new Date().toISOString() }).eq("id", cart.id);
          sent++;
        }
      } else {
        sent++;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`[LUKE] Processed ${sent} recovery emails (${dryRun ? "DRY RUN" : "LIVE"})`);
    return new Response(JSON.stringify({ sent, dry_run: dryRun }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[LUKE]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
