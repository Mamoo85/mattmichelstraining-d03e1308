/**
 * web-project-fulfillment
 *
 * One-click project kickoff. Matt clicks "Approve" in the admin panel,
 * this function takes over:
 *
 * Stage 1 — approve:       Welcome email + intake questionnaire → client
 * Stage 2 — intake_done:   Notify Matt that client submitted their brief
 * Stage 3 — preview_ready: Send client their preview link, request feedback
 * Stage 4 — approved:      Final delivery email + DNS/access instructions
 * Stage 5 — revision:      Acknowledge revision request, set expectations
 *
 * All stages log to web_project_stages table.
 * Matt can trigger any stage from AdminWebDesign panel.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[FULFILLMENT] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const INTAKE_FORM_URL = "https://www.mattmichelstraining.com/web-project-intake";

// ── Email builders ─────────────────────────────────────────────────────────

function wrapHtml(body: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <tr><td style="background:#e8621a;padding:4px 0;"></td></tr>
    <tr><td style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
      ${body}
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      Matt Michels Web Design · Grosse Pointe, MI<br>
      <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> ·
      <a href="tel:+13138064952" style="color:#94a3b8;">(313) 806-4952</a> ·
      <a href="https://www.mattmichelstraining.com/detroit-web-design" style="color:#94a3b8;">See my work</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

function emailApprove(business: string, clientName: string, projectId: string): { subject: string; html: string} {
  const subject = `Your website project is officially underway — ${business}`;
  const body = `
    <p>Hey ${clientName || "there"} —</p>
    <p>You're locked in. I'm excited to build this site for <strong>${business}</strong> and I want to make sure it's exactly what you need.</p>
    <p>Before I start designing, I need a few quick answers from you — takes about 5 minutes:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${INTAKE_FORM_URL}?project=${projectId}" style="background:#e8621a;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
        Answer 5 Quick Questions →
      </a>
    </p>
    <p><strong>What I need from you:</strong></p>
    <ul style="padding-left:20px;line-height:2.2;">
      <li>Your logo (or let me know if you need one)</li>
      <li>2–3 photos of your work (or I'll source them)</li>
      <li>Your top 3 services to highlight</li>
      <li>Any competitors' sites you like the look of</li>
      <li>Preferred colors / vibe (or just say "professional" and I'll handle it)</li>
    </ul>
    <p>Once I have that, I'll be in design mode. You'll get a preview link within 7 days.</p>
    <p>Questions? Email me at <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a> — whichever works best for you. I'm fast to respond.</p>
    <p>— Matt Michels</p>`;
  return { subject, html: wrapHtml(body, subject) };
}

function emailPreviewReady(business: string, clientName: string, previewUrl: string): { subject: string; html: string} {
  const subject = `Your website preview is ready — ${business}`;
  const body = `
    <p>Hey ${clientName || "there"} —</p>
    <p>Your site is built. Take a look:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${previewUrl}" style="background:#e8621a;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
        View Your Website Preview →
      </a>
    </p>
    <p><strong>How to review it:</strong> Check it on your phone AND on a desktop. Make sure your services, phone number, and contact form are all exactly right.</p>
    <p><strong>You have 2 rounds of revisions included.</strong> Just reply to this email with a list of anything you want changed — be as specific as you like. I'll turn revisions around within 2 business days.</p>
    <p>If it looks good and you're ready to go live, just reply and say <strong>"Approved — go live"</strong> and I'll get it live on your domain within 24 hours.</p>
    <p>Email <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a> — I'm here.</p>
    <p>— Matt</p>`;
  return { subject, html: wrapHtml(body, subject) };
}

function emailGoLive(business: string, clientName: string, siteUrl: string): { subject: string; html: string} {
  const subject = `🚀 ${business} is live on Google`;
  const body = `
    <p>Hey ${clientName || "there"} —</p>
    <p><strong>${business} is live.</strong> Your site is published, indexed by Google, and ready to bring in calls.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${siteUrl}" style="background:#16a34a;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
        View Your Live Site →
      </a>
    </p>
    <p><strong>What happens next:</strong></p>
    <ul style="padding-left:20px;line-height:2.2;">
      <li>Google will index your site within 3–7 days</li>
      <li>You'll start showing up in local searches for your services</li>
      <li>Your $49/mo maintenance keeps it updated, backed up, and secure</li>
    </ul>
    <p><strong>You're in control:</strong> I'll email you login info separately. You can update your hours, services, and photos anytime — or just text me and I'll do it for you, no extra charge.</p>
    <p><strong>Get more Google reviews now:</strong> Ask your last 5 happy customers to leave a review. That's the fastest way to start ranking higher.</p>
    <p>Thank you for trusting me with this. If you ever need anything — changes, questions, new pages — I'm one text away.</p>
    <p>Email <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
    <p>— Matt Michels</p>`;
  return { subject, html: wrapHtml(body, subject) };
}

function emailRevisionAck(business: string, clientName: string): { subject: string; html: string} {
  const subject = `Got your revision notes — ${business}`;
  const body = `
    <p>Hey ${clientName || "there"} —</p>
    <p>Got your feedback. I'm on it.</p>
    <p>I'll have the updated preview back to you within <strong>2 business days</strong>. I'll send a new link as soon as it's ready.</p>
    <p>If you think of anything else before then, just reply to this email or text me at <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>. It's easier to batch changes together.</p>
    <p>— Matt</p>`;
  return { subject, html: wrapHtml(body, subject) };
}

// ── Notify Matt ─────────────────────────────────────────────────────────────

function emailMattNotify(stage: string, business: string, clientEmail: string, notes: string): { subject: string; html: string} {
  const subject = `[Project Update] ${business} — ${stage}`;
  const body = `
    <p><strong>Business:</strong> ${business}<br>
    <strong>Client email:</strong> ${clientEmail}<br>
    <strong>Stage:</strong> ${stage}<br>
    <strong>Notes:</strong> ${notes || "None"}</p>
    <p>Log in to your admin panel to take action:</p>
    <p><a href="https://www.mattmichelstraining.com/admin" style="color:#e8621a;">Open Admin Panel →</a></p>`;
  return { subject, html: wrapHtml(body, subject) };
}

// ── Main handler ─────────────────────────────────────────────────────────────


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Admin-only endpoint
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      lead_id,        // required: the web_design_leads.id
      stage,          // required: approve | preview_ready | go_live | revision | intake_done
      preview_url,    // for stage=preview_ready
      site_url,       // for stage=go_live
      notes,          // optional context passed to admin notification
    } = await req.json();

    if (!lead_id || !stage) {
      return new Response(JSON.stringify({ error: "lead_id and stage are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the lead
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
      return new Response(JSON.stringify({ error: "Lead has no email address — cannot send" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the right emails for this stage
    let clientEmail_payload: { subject: string; html: string} | null = null;
    let newStatus: string | null = null;
    const projectId = lead_id;

    switch (stage) {
      case "approve":
        clientEmail_payload = emailApprove(business, clientName, projectId);
        newStatus = "in_progress";
        break;
      case "preview_ready":
        if (!preview_url) return new Response(JSON.stringify({ error: "preview_url required for this stage" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
        clientEmail_payload = emailPreviewReady(business, clientName, preview_url);
        newStatus = "preview_sent";
        break;
      case "go_live":
        if (!site_url) return new Response(JSON.stringify({ error: "site_url required for this stage" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
        clientEmail_payload = emailGoLive(business, clientName, site_url);
        newStatus = "delivered";
        break;
      case "revision":
        clientEmail_payload = emailRevisionAck(business, clientName);
        newStatus = "revision_in_progress";
        break;
      case "intake_done":
        // Only notify Matt — no client email
        newStatus = "brief_received";
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown stage: ${stage}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Send client email (if applicable)
    if (clientEmail_payload) {
      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [clientEmail],
          subject: clientEmail_payload.subject,
          html: clientEmail_payload.html,
        }),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        log("Client email send failed", { error: errText });
        return new Response(JSON.stringify({ error: `Email send failed: ${errText}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      log("Client email sent", { stage, clientEmail, subject: clientEmail_payload.subject });
    }

    // Always notify Matt
    const mattEmail = emailMattNotify(stage, business, clientEmail, notes || "");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "M2 System <matt@mattmichelstraining.com>",
        to: ["matt@m2training.com"],
        subject: mattEmail.subject,
        html: mattEmail.html,
      }),
    });

    // Update lead status
    if (newStatus) {
      await serviceClient
        .from("web_design_leads" as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", lead_id);
    }

    // Log the stage
    await serviceClient.from("email_send_log" as any).insert({
      recipient_email: clientEmail,
      template_name: `web_fulfillment_${stage}`,
      status: "sent",
      message_id: `fulfillment_${lead_id}_${stage}_${Date.now()}`,
      metadata: { stage, business, lead_id },
    });

    log("Stage complete", { stage, business, newStatus });

    return new Response(
      JSON.stringify({
        success: true,
        stage,
        business,
        client_email: clientEmail,
        new_status: newStatus,
        message: `Stage "${stage}" complete. ${clientEmail_payload ? "Client notified." : "No client email for this stage."} Matt notified.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
