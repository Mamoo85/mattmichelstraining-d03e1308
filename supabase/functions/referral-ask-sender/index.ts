import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[REFERRAL-ASK-SENDER] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// All active-client tables to query
const CLIENT_TABLES = [
  "missed_call_clients",
  "reputation_clients",
  "social_media_clients",
  "review_responder_clients",
  "chatbot_clients",
  "blog_post_clients",
  "text_marketing_clients",
  "phone_answering_clients",
];

// Friendly service names for email copy
const SERVICE_LABELS: Record<string, string> = {
  missed_call_clients: "the missed call follow-up",
  reputation_clients: "the reputation management",
  social_media_clients: "the social media posting",
  review_responder_clients: "the review responder",
  chatbot_clients: "the website chatbot",
  blog_post_clients: "the blog post service",
  text_marketing_clients: "the text marketing",
  phone_answering_clients: "the phone answering service",
};

interface ClientRecord {
  email: string;
  contact_name: string | null;
  business_name: string | null;
  created_at: string;
  source_table: string;
}

interface ReferralWindow {
  templateName: string;
  minDays: number;
  maxDays: number;
  subject: string;
  bodyBuilder: (firstName: string, serviceLabel: string) => string;
}

const REFERRAL_WINDOWS: ReferralWindow[] = [
  {
    templateName: "referral_ask_30d",
    minDays: 25,
    maxDays: 35,
    subject: "Quick favor — know anyone who could use this?",
    bodyBuilder: (firstName, serviceLabel) =>
      `Hey ${firstName}, it's been about a month — how's ${serviceLabel} working out for you? If you know another business owner who could use something like this, I'd really appreciate the intro. Send them my way and I'll give you both a $50 credit on next month. Just text me at (313) 806-4952 or have them mention your name when they sign up. — Matt`,
  },
  {
    templateName: "referral_ask_60d",
    minDays: 55,
    maxDays: 65,
    subject: "Still the best compliment I can get",
    bodyBuilder: (firstName, serviceLabel) =>
      `Hey ${firstName}, two months in — hope ${serviceLabel} is still doing its thing for you. If it's been working well, the biggest compliment you can give me is a referral. Send any business owner my way and I'll knock $50 off both of your next bills. Text me at (313) 806-4952. — Matt`,
  },
  {
    templateName: "referral_ask_90d",
    minDays: 85,
    maxDays: 95,
    subject: "Three months — and a little thank-you offer",
    bodyBuilder: (firstName, serviceLabel) =>
      `Hey ${firstName}, you've been with me for three months now — that means a lot. If ${serviceLabel} has been worth it, I'd love an intro to another business owner who could use the same. Refer someone and you both get $50 off next month. Just text me at (313) 806-4952 or have them drop your name at sign-up. Thanks for sticking with me. — Matt`,
  },
];

function buildReferralEmailHtml(bodyText: string): string {
  const htmlBody = bodyText.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tr><td style="background:#e8621a;padding:3px 0;"></td></tr>
    <tr><td style="padding:28px 24px 20px;color:#334155;font-size:15px;line-height:1.8;">
      <p style="margin:0 0 16px;">${htmlBody}</p>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg"
                   style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;"
                   alt="Matt Michels">
            </td>
            <td style="vertical-align:middle;">
              <div style="font-size:14px;color:#1e293b;font-weight:600;">Matt Michels</div>
              <div style="font-size:13px;color:#64748b;">M² Training · Grosse Pointe, MI</div>
              <div style="font-size:13px;color:#64748b;">(313) 806-4952</div>
            </td>
          </tr>
        </table>
      </div>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
      M² Performance Training · Grosse Pointe, MI ·
      <a href="https://www.mattmichelstraining.com" style="color:#94a3b8;">mattmichelstraining.com</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();

    // Collect clients from all tables
    const allClients: ClientRecord[] = [];

    for (const table of CLIENT_TABLES) {
      try {
        const { data, error } = await supabase
          .from(table as any)
          .select("email, contact_name, business_name, created_at")
          .eq("active", true);

        if (error) {
          log(`Query failed for ${table}, skipping`, { error: error.message });
          continue;
        }

        if (data && data.length > 0) {
          for (const row of data) {
            allClients.push({ ...row, source_table: table });
          }
          log(`Loaded ${data.length} active clients from ${table}`);
        }
      } catch (tableErr) {
        log(`Unexpected error querying ${table}, skipping`, { error: String(tableErr) });
      }
    }

    log(`Total active clients loaded`, { count: allClients.length });

    let totalSent = 0;

    // Process each referral window
    for (const window of REFERRAL_WINDOWS) {
      // Filter clients whose created_at falls within this window
      const windowClients = allClients.filter((c) => {
        const createdAt = new Date(c.created_at);
        const daysAgo = (now.getTime() - createdAt.getTime()) / 86400000;
        return daysAgo >= window.minDays && daysAgo <= window.maxDays;
      });

      if (windowClients.length === 0) {
        log(`No clients in window ${window.templateName}`);
        continue;
      }

      log(`Clients in window ${window.templateName}`, { count: windowClients.length });

      // Deduplicate by email (a client might appear in multiple tables)
      const seen = new Set<string>();
      const uniqueClients = windowClients.filter((c) => {
        if (!c.email || seen.has(c.email.toLowerCase())) return false;
        seen.add(c.email.toLowerCase());
        return true;
      });

      // Fetch already-sent log entries for this template in one query
      const emails = uniqueClients.map((c) => c.email.toLowerCase());
      const { data: alreadySent, error: logErr } = await supabase
        .from("email_send_log" as any)
        .select("lead_id")
        .eq("template_name", window.templateName)
        .in("lead_id", emails);

      if (logErr) {
        log(`Could not read email_send_log for ${window.templateName}`, { error: logErr.message });
      }

      const sentSet = new Set((alreadySent || []).map((r: any) => r.lead_id?.toLowerCase()));

      const eligibleClients = uniqueClients.filter(
        (c) => !sentSet.has(c.email.toLowerCase())
      );

      log(`Eligible (not yet sent) for ${window.templateName}`, { count: eligibleClients.length });

      for (const client of eligibleClients) {
        try {
          const firstName = client.contact_name?.split(" ")[0] || "there";
          const serviceLabel = SERVICE_LABELS[client.source_table] || "the service";
          const bodyText = window.bodyBuilder(firstName, serviceLabel);
          const html = buildReferralEmailHtml(bodyText);

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Matt Michels <matt@notify.m2training.com>",
              reply_to: "matt@m2training.com",
              to: [client.email],
              subject: window.subject,
              html,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            log(`Send failed for ${client.email}`, { error: errText });
            continue;
          }

          // Log to email_send_log
          await supabase.from("email_send_log" as any).insert({
            lead_id: client.email.toLowerCase(),
            template_name: window.templateName,
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          totalSent++;
          log(`Referral email sent`, {
            email: client.email,
            template: window.templateName,
            table: client.source_table,
          });

          // Small delay to avoid rate limits
          await new Promise((r) => setTimeout(r, 150));
        } catch (sendErr) {
          log(`Error sending to ${client.email}`, { error: String(sendErr) });
        }
      }
    }

    log(`Run complete`, { sent: totalSent });

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
