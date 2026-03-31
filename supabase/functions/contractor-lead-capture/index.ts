import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { site_slug, name, phone, email, message, project_type } = await req.json();
    if (!site_slug || !name || !phone) {
      return new Response(JSON.stringify({ error: "name and phone are required" }), { status: 400, headers: corsHeaders });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find the lead site
    const { data: site } = await sb
      .from("contractor_lead_sites")
      .select("id, trade, city, state, active_contractor_id, active")
      .eq("slug", site_slug)
      .single();

    if (!site || !site.active) {
      return new Response(JSON.stringify({ error: "Site not found" }), { status: 404, headers: corsHeaders });
    }

    // Insert the lead
    const { data: lead } = await sb
      .from("contractor_leads")
      .insert({
        site_id: site.id,
        client_id: site.active_contractor_id || null,
        name,
        phone,
        email: email || null,
        message: message || null,
        project_type: project_type || null,
        status: "new",
      })
      .select()
      .single();

    console.log(`[LEAD-CAPTURE] New lead: ${name} ${phone} for ${site.trade} in ${site.city}`);

    // Email Matt immediately
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Leads <matt@mattmichelstraining.com>",
          to: ["matt@m2training.com"],
          subject: `🔥 New ${site.trade} lead — ${site.city} — ${name}`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;padding:12px 24px;color:#fff;font-weight:700;font-size:16px;">
    New ${site.trade.toUpperCase()} Lead — ${site.city}, ${site.state}
  </div>
  <div style="padding:24px;font-size:15px;color:#1e293b;line-height:1.8;">
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Phone:</strong> <a href="tel:${phone}" style="color:#e8621a;">${phone}</a></p>
    ${email ? `<p><strong>Email:</strong> <a href="mailto:${email}" style="color:#e8621a;">${email}</a></p>` : ""}
    ${project_type ? `<p><strong>Project:</strong> ${project_type}</p>` : ""}
    ${message ? `<p><strong>Notes:</strong> ${message}</p>` : ""}
    <hr style="border:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:13px;color:#64748b;">Lead captured from <strong>${site_slug}</strong> at ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
    ${site.active_contractor_id ? "<p style='font-size:13px;color:#16a34a;'>✓ Contractor has been notified automatically.</p>" : "<p style='font-size:13px;color:#f59e0b;'>⚠ No contractor assigned yet — this is a free lead until you sign one.</p>"}
  </div>
</div>
</body></html>`,
        }),
      });

      // If contractor is assigned, notify them too
      if (site.active_contractor_id) {
        const { data: contractor } = await sb
          .from("contractor_clients")
          .select("name, email, phone, business_name")
          .eq("id", site.active_contractor_id)
          .single();

        if (contractor?.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Lead Network <matt@mattmichelstraining.com>",
              to: [contractor.email],
              subject: `🔥 New ${site.trade} lead — ${name} in ${site.city}`,
              html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;padding:12px 24px;color:#fff;font-weight:700;font-size:16px;">
    New Exclusive Lead — ${site.trade.toUpperCase()}
  </div>
  <div style="padding:24px;font-size:15px;color:#1e293b;line-height:1.9;">
    <p>Hey ${contractor.name || contractor.business_name || "there"} —</p>
    <p>A new ${site.trade} lead just came in for your territory. <strong>You're the only one getting this.</strong></p>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Phone:</strong> <a href="tel:${phone}" style="color:#e8621a;font-size:18px;font-weight:700;">${phone}</a></p>
    ${email ? `<p><strong>Email:</strong> ${email}</p>` : ""}
    ${project_type ? `<p><strong>Project type:</strong> ${project_type}</p>` : ""}
    ${message ? `<p><strong>Notes:</strong> ${message}</p>` : ""}
    <p style="margin-top:20px;font-size:13px;color:#64748b;">Received ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
    <p style="font-size:13px;color:#64748b;">Questions? Email <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
  </div>
</div>
</body></html>`,
            }),
          });

          // Mark lead as notified
          if (lead) {
            await sb.from("contractor_leads").update({ notified_at: new Date().toISOString(), status: "notified" }).eq("id", lead.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead?.id }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[LEAD-CAPTURE] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
