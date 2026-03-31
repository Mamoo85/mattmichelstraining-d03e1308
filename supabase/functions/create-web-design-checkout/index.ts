/**
 * create-web-design-checkout
 *
 * Creates Stripe payment links for web design clients and emails them directly.
 * Called from the admin CRM panel.
 *
 * Request body:
 *   lead_id: string   — required
 *   type: 'build' | 'retainer' | 'both'   — defaults to 'both'
 *
 * Creates:
 *   build    → one-time $499 checkout session
 *   retainer → $49/mo recurring subscription session
 *   both     → both sessions, client gets one email with both links
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const SITE_URL = "https://www.mattmichelstraining.com";

function buildEmailHtml(
  business: string,
  clientName: string,
  buildUrl: string | null,
  retainerUrl: string | null
): string {
  const btnStyle = "display:inline-block;padding:14px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:15px;margin:8px 0;";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <tr><td style="background:#e8621a;padding:4px 0;"></td></tr>
    <tr><td style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
      <p>Hey ${clientName || "there"} —</p>
      <p>Here are your secure payment links for the <strong>${business}</strong> website project.</p>

      ${buildUrl ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 6px;font-weight:700;font-size:16px;">Website Build — $499</p>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">One-time. Site is live in 7 days. Includes everything we discussed.</p>
        <a href="${buildUrl}" style="${btnStyle}background:#e8621a;color:#fff;">Pay $499 — Start My Site →</a>
      </div>` : ""}

      ${retainerUrl ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 6px;font-weight:700;font-size:16px;">Monthly Hosting & Maintenance — $49/mo</p>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Cancel anytime. Keeps your site live, secure, and updated. Includes my direct cell for any changes.</p>
        <a href="${retainerUrl}" style="${btnStyle}background:#0f172a;color:#fff;">Set Up $49/mo Maintenance →</a>
      </div>` : ""}

      <p style="color:#64748b;font-size:13px;">Payments are processed securely through Stripe. I'll get an alert the moment you pay and reach out within a few hours to kick things off.</p>
      <p>Questions before you pay? Email me at <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a> — whichever works best for you.</p>
      <p>— Matt Michels</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      Matt Michels Web Design · Grosse Pointe, MI ·
      <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> ·
      <a href="tel:+13138064952" style="color:#94a3b8;">(313) 806-4952</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { lead_id, type = "both" } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await serviceClient
      .from("web_design_leads" as any)
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const business: string = lead.business || "Your Business";
    const clientName: string = lead.name || "";
    const clientEmail: string = lead.email || "";

    if (!clientEmail) {
      return new Response(JSON.stringify({ error: "Lead has no email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let buildUrl: string | null = null;
    let retainerUrl: string | null = null;

    // ── $499 Build Fee (one-time payment) ──────────────────────────────────
    if (type === "build" || type === "both") {
      const buildSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: clientEmail,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `Website Build — ${business}`,
              description: "Custom website. Live in 7 days. Includes mobile design, Google Maps, contact form, SEO setup.",
            },
            unit_amount: 49900, // $499.00
          },
          quantity: 1,
        }],
        metadata: {
          type: "web_design_build",
          lead_id: lead_id,
          business_name: business,
        },
        success_url: `${SITE_URL}/payment-success?type=website&business=${encodeURIComponent(business)}`,
        cancel_url: `${SITE_URL}/detroit-web-design`,
      });
      buildUrl = buildSession.url;
    }

    // ── $49/mo Maintenance Subscription ────────────────────────────────────
    if (type === "retainer" || type === "both") {
      const retainerSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: clientEmail,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `Website Hosting & Maintenance — ${business}`,
              description: "Monthly hosting, security updates, backups, and direct access to Matt for any changes.",
            },
            unit_amount: 4900, // $49.00
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        metadata: {
          type: "web_design_retainer",
          lead_id: lead_id,
          business_name: business,
        },
        success_url: `${SITE_URL}/payment-success?type=maintenance&business=${encodeURIComponent(business)}`,
        cancel_url: `${SITE_URL}/detroit-web-design`,
      });
      retainerUrl = retainerSession.url;
    }

    // ── Email payment links to client ────────────────────────────────────
    const emailHtml = buildEmailHtml(business, clientName, buildUrl, retainerUrl);
    const emailSubject = `Your payment links — ${business} website`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [clientEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    // ── Notify Matt ─────────────────────────────────────────────────────
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "M² System <matt@mattmichelstraining.com>",
        to: ["matt@m2training.com"],
        subject: `Payment link sent — ${business}`,
        html: `<p>Payment link(s) sent to <strong>${clientEmail}</strong> for <strong>${business}</strong>.<br>
          ${buildUrl ? `Build ($499): <a href="${buildUrl}">${buildUrl}</a><br>` : ""}
          ${retainerUrl ? `Retainer ($49/mo): <a href="${retainerUrl}">${retainerUrl}</a>` : ""}
        </p>`,
      }),
    });

    // Log in email_send_log
    await serviceClient.from("email_send_log" as any).insert({
      recipient_email: clientEmail,
      template_name: "web_design_payment_link",
      status: "sent",
      message_id: `payment_link_${lead_id}_${Date.now()}`,
      metadata: { business, type, lead_id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        build_url: buildUrl,
        retainer_url: retainerUrl,
        client_email: clientEmail,
        message: `Payment link(s) sent to ${clientEmail}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CREATE-WEB-DESIGN-CHECKOUT] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
