import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Service catalog — maps source to product info for drip emails
const SERVICE_MAP: Record<string, { name: string; price: string; url: string; benefit: string }> = {
  free_trending_products: {
    name: "AI Trending Product Finder",
    price: "$29/mo",
    url: "https://www.mattmichelstraining.com/get-started?service=trending_product_finder",
    benefit: "15+ trending products weekly with profit margins, supplier links, and ad creative ideas",
  },
  free_grant_digest: {
    name: "AI Grant & Funding Digest",
    price: "$29/mo",
    url: "https://www.mattmichelstraining.com/get-started?service=grant_funding_digest",
    benefit: "15+ matched grants weekly with deadlines, eligibility details, and direct application links",
  },
  free_real_estate_digest: {
    name: "AI Real Estate Market Digest",
    price: "$39/mo",
    url: "https://www.mattmichelstraining.com/get-started?service=real_estate_digest",
    benefit: "20+ market insights weekly — price trends, inventory shifts, and investment opportunity scores",
  },
};

const DEFAULT_SERVICE = {
  name: "Full Weekly Digest",
  price: "$29/mo",
  url: "https://www.mattmichelstraining.com/get-started",
  benefit: "complete weekly reports with actionable insights delivered to your inbox",
};

// ─── Email Templates ─────────────────────────────────────────────
function emailStep1(name: string, svc: typeof DEFAULT_SERVICE) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return {
    subject: `Did you see something you liked? Here's what you're missing…`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <img src="https://www.mattmichelstraining.com/assets/m2-logo-placeholder.jpg" alt="M² Development" width="80" style="margin-bottom:20px;"/>
  <p style="font-size:15px;color:#333;line-height:1.6;">${greeting}</p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    Thanks for downloading your free <strong>${svc.name}</strong> sample. That report only scratched the surface.
  </p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    The full version includes <strong>${svc.benefit}</strong> — delivered automatically every week so you never miss an opportunity.
  </p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    And it's only <strong>${svc.price}</strong>. Cancel anytime, no contracts.
  </p>
  <a href="${svc.url}" style="display:inline-block;background:#e8621a;color:#fff;padding:14px 28px;font-weight:bold;font-size:14px;text-decoration:none;border-radius:6px;margin:16px 0;">
    Unlock Full Access →
  </a>
  <p style="font-size:13px;color:#999;margin-top:24px;">
    — Matt Michels<br/>M² Development · Grosse Pointe, MI
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="font-size:11px;color:#bbb;">You received this because you downloaded a free report from mattmichelstraining.com. <a href="https://www.mattmichelstraining.com" style="color:#bbb;">Unsubscribe</a></p>
</div>
</body></html>`,
  };
}

function emailStep2(name: string, svc: typeof DEFAULT_SERVICE) {
  const greeting = name ? `${name},` : "Hey,";
  return {
    subject: `Quick question about your ${svc.name} report`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <img src="https://www.mattmichelstraining.com/assets/m2-logo-placeholder.jpg" alt="M² Development" width="80" style="margin-bottom:20px;"/>
  <p style="font-size:15px;color:#333;line-height:1.6;">${greeting}</p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    I wanted to check — did the sample report help you find anything useful?
  </p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    Most people tell me the free version gives them 2-3 solid leads. The full ${svc.name} gives <strong>5x more</strong> every single week, automatically.
  </p>
  <p style="font-size:15px;color:#333;line-height:1.6;">Here's what subscribers get that you don't:</p>
  <ul style="font-size:14px;color:#333;line-height:1.8;padding-left:20px;">
    <li>✅ 15+ curated matches (vs. 3 in the sample)</li>
    <li>✅ Direct application/action links</li>
    <li>✅ Deadline & eligibility alerts</li>
    <li>✅ AI-powered match scoring</li>
    <li>✅ Weekly delivery — zero effort from you</li>
  </ul>
  <a href="${svc.url}" style="display:inline-block;background:#e8621a;color:#fff;padding:14px 28px;font-weight:bold;font-size:14px;text-decoration:none;border-radius:6px;margin:16px 0;">
    Start Getting Full Reports →
  </a>
  <p style="font-size:13px;color:#999;margin-top:24px;">
    — Matt<br/>P.S. Reply to this email if you have questions. I read every one.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="font-size:11px;color:#bbb;">You received this because you downloaded a free report from mattmichelstraining.com. <a href="https://www.mattmichelstraining.com" style="color:#bbb;">Unsubscribe</a></p>
</div>
</body></html>`,
  };
}

function emailStep3(name: string, svc: typeof DEFAULT_SERVICE) {
  const greeting = name ? `Last chance, ${name}` : "Last chance";
  return {
    subject: `${greeting} — your free sample expires soon`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <img src="https://www.mattmichelstraining.com/assets/m2-logo-placeholder.jpg" alt="M² Development" width="80" style="margin-bottom:20px;"/>
  <p style="font-size:15px;color:#333;line-height:1.6;font-weight:bold;">${greeting} —</p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    This is my last email about the free ${svc.name} sample. After today, I won't bug you again.
  </p>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    But I want to make sure you know what you'd be leaving on the table:
  </p>
  <div style="background:#f9f9f9;border-left:4px solid #e8621a;padding:16px 20px;margin:16px 0;border-radius:4px;">
    <p style="font-size:14px;color:#333;margin:0;line-height:1.6;">
      <strong>${svc.benefit}</strong><br/>
      All for <strong>${svc.price}</strong>. Cancel with one click. No contracts. No commitment.
    </p>
  </div>
  <p style="font-size:15px;color:#333;line-height:1.6;">
    If it's not for you, no hard feelings. But if you've been on the fence — this is the nudge.
  </p>
  <a href="${svc.url}" style="display:inline-block;background:#e8621a;color:#fff;padding:14px 28px;font-weight:bold;font-size:14px;text-decoration:none;border-radius:6px;margin:16px 0;">
    Start Now — ${svc.price} →
  </a>
  <p style="font-size:13px;color:#999;margin-top:24px;">
    — Matt Michels<br/>M² Development · Grosse Pointe, MI<br/>(313) 806-4952
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="font-size:11px;color:#bbb;">You received this because you downloaded a free report from mattmichelstraining.com. <a href="https://www.mattmichelstraining.com" style="color:#bbb;">Unsubscribe</a></p>
</div>
</body></html>`,
  };
}

const DRIP_STEPS = [
  { step: 1, delayDays: 1, getEmail: emailStep1 },   // Day 1 after download
  { step: 2, delayDays: 3, getEmail: emailStep2 },   // Day 3
  { step: 3, delayDays: 7, getEmail: emailStep3 },   // Day 7
];

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt Michels <matt@notify.mattmichelstraining.com>",
      to: [to], bcc: ["matthewmichels4@gmail.com"],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${res.status} ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Find leads from free report sources that haven't completed the drip
    const freeSources = Object.keys(SERVICE_MAP);
    const { data: leads, error } = await supabase
      .from("marketing_leads")
      .select("id, email, first_name, source, created_at, drip_step, drip_last_sent_at")
      .in("source", freeSources)
      .or("drip_completed.is.null,drip_completed.eq.false")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No leads to drip" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let sent = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        const currentStep = lead.drip_step || 0;
        const nextStepConfig = DRIP_STEPS.find((s) => s.step === currentStep + 1);

        // All steps done
        if (!nextStepConfig) {
          await supabase
            .from("marketing_leads")
            .update({ drip_completed: true })
            .eq("id", lead.id);
          continue;
        }

        // Check timing — has enough time elapsed?
        const createdAt = new Date(lead.created_at);
        const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceCreation < nextStepConfig.delayDays) continue;

        // Don't double-send on same day
        if (lead.drip_last_sent_at) {
          const lastSent = new Date(lead.drip_last_sent_at);
          const hoursSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLast < 20) continue;
        }

        const svc = SERVICE_MAP[lead.source] || DEFAULT_SERVICE;
        const { subject, html } = nextStepConfig.getEmail(lead.first_name || "", svc);

        await sendEmail(lead.email, subject, html);

        await supabase
          .from("marketing_leads")
          .update({
            drip_step: nextStepConfig.step,
            drip_last_sent_at: now.toISOString(),
            drip_completed: nextStepConfig.step >= 3,
          })
          .eq("id", lead.id);

        sent++;

        // Small delay between sends
        await new Promise((r) => setTimeout(r, 300));
      } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${lead.email}: ${e.message}`);
      }
    }

    // Log to email_send_log
    if (sent > 0) {
      await supabase.from("email_send_log").insert({
        recipient_email: "batch",
        template_name: "free_report_drip",
        status: "sent",
        metadata: { sent, errors: errors.length, timestamp: now.toISOString() },
      });
    }

    return new Response(JSON.stringify({ sent, errors: errors.length, details: errors.slice(0, 5) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
