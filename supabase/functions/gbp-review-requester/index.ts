// GBP Review Requester — called every Sunday by cron
// Sends review request emails for pro-plan GBP SaaS clients

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: clients } = await sb
      .from("gbp_saas_clients")
      .select("id, business_name, business_type, city, gbp_location_id, customer_emails, email, plan")
      .eq("active", true)
      .eq("plan", "pro");

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    let sent = 0;

    for (const client of clients) {
      const customerEmails: string[] = client.customer_emails || [];
      if (customerEmails.length === 0) continue;

      const reviewLink = client.gbp_location_id
        ? `https://search.google.com/local/writereview?placeid=${client.gbp_location_id}`
        : `https://www.google.com/search?q=${encodeURIComponent(client.business_name + " " + (client.city || ""))}`;

      for (const customerEmail of customerEmails) {
        if (!customerEmail || !customerEmail.includes("@")) continue;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${client.business_name} <matt@mattmichelstraining.com>`,
            to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
            reply_to: client.email,
            subject: `How was your experience with ${client.business_name}?`,
            html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;padding:28px;">
  <p style="font-size:16px;color:#1e293b;line-height:1.8;">Hey —</p>
  <p style="font-size:15px;color:#334155;line-height:1.8;">We recently worked with you and we'd love to know how it went. If you had a good experience, leaving us a quick Google review makes a huge difference for a local business like ours.</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${reviewLink}" style="background:#e8621a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">Leave a Google Review →</a>
  </p>
  <p style="font-size:14px;color:#64748b;line-height:1.7;">Takes about 60 seconds. We genuinely appreciate it.</p>
  <p style="font-size:15px;color:#1e293b;">— ${client.business_name}</p>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>
</body></html>`,
          }),
        });
        sent++;
      }
    }

    console.log(`[GBP-REVIEW] Sent ${sent} review request emails`);
    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[GBP-REVIEW] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
