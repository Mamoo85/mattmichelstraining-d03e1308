// Cron-triggered function: checks for unnotified leads every 15 minutes
// and sends follow-up notifications if immediate delivery failed

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  // Allow both cron (service role) and direct calls
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Find leads created in last 24h that haven't been notified
    const { data: unnotified } = await sb
      .from("contractor_leads")
      .select(`
        id, name, phone, email, message, project_type, created_at,
        contractor_lead_sites (trade, city, state, slug, active_contractor_id),
        contractor_clients (name, business_name, email)
      `)
      .eq("status", "new")
      .is("notified_at", null)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!unnotified || unnotified.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
    }

    let count = 0;
    for (const lead of unnotified) {
      const site = (lead as any).contractor_lead_sites;
      const contractor = (lead as any).contractor_clients;

      if (contractor?.email && RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Lead Network <matt@mattmichelstraining.com>",
            to: [contractor.email], bcc: ["matthewmichels4@gmail.com"],
            subject: `New ${site?.trade || "service"} lead — ${lead.name}`,
            html: `<p>Hey — you have a new lead waiting.<br><strong>${lead.name}</strong> — <a href="tel:${lead.phone}">${lead.phone}</a>${lead.email ? ` — ${lead.email}` : ""}</p><p>Reply to this email or call them directly. First one to respond wins the job.<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
          }),
        });

        await sb.from("contractor_leads")
          .update({ notified_at: new Date().toISOString(), status: "notified" })
          .eq("id", lead.id);

        count++;
      }
    }

    console.log(`[LEAD-NOTIFY] Sent ${count} delayed notifications`);
    return new Response(JSON.stringify({ notified: count }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[LEAD-NOTIFY] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
