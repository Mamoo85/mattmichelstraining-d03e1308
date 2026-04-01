import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const VERIFY_TOKEN = Deno.env.get("FACEBOOK_LEAD_VERIFY_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Facebook webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[FB-WEBHOOK] Verification successful");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Facebook lead webhook (POST)
  try {
    const body = await req.json();
    console.log("[FB-WEBHOOK] Received:", JSON.stringify(body).slice(0, 500));

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const { leadgen_id, page_id } = change.value;
        if (!leadgen_id || !page_id) continue;

        // Fetch full lead data from Graph API
        const graphRes = await fetch(
          `https://graph.facebook.com/v19.0/${leadgen_id}?access_token=${META_ACCESS_TOKEN}&fields=field_data`
        );

        if (!graphRes.ok) {
          const errText = await graphRes.text();
          console.error("[FB-WEBHOOK] Graph API error:", graphRes.status, errText);
          continue;
        }

        const graphData = await graphRes.json();
        const fields = graphData.field_data || [];

        // Map field_data array to named values
        const getField = (name: string) =>
          fields.find((f: { name: string; values: string[] }) => f.name === name)?.values?.[0] || null;

        const name = getField("full_name") || getField("first_name") || "Facebook Lead";
        const phone = getField("phone_number") || "";
        const email = getField("email") || null;

        if (!phone && !email) {
          console.warn("[FB-WEBHOOK] Lead has no phone or email, skipping");
          continue;
        }

        // Look up the contractor_lead_site by facebook_page_id
        const { data: site } = await sb
          .from("contractor_lead_sites")
          .select("id, trade, city, state, active_contractor_id, active")
          .eq("facebook_page_id", page_id)
          .eq("active", true)
          .maybeSingle();

        if (!site) {
          console.warn(`[FB-WEBHOOK] No active site for page_id ${page_id}`);
          continue;
        }

        // Insert the lead
        const { data: lead } = await sb
          .from("contractor_leads")
          .insert({
            site_id: site.id,
            client_id: site.active_contractor_id || null,
            name,
            phone: phone || "N/A",
            email,
            source: "facebook",
            status: "new",
          })
          .select()
          .single();

        console.log(`[FB-WEBHOOK] New FB lead: ${name} ${phone} for ${site.trade} in ${site.city}`);

        // Email Matt
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Leads <matt@mattmichelstraining.com>",
              to: ["matt@mattmichelstraining.com"],
              bcc: ["matthewmichels4@gmail.com"],
              subject: `🔥 FB Lead — ${site.trade} — ${site.city} — ${name}`,
              html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;padding:12px 24px;color:#fff;font-weight:700;font-size:16px;">
    🔥 Facebook Lead — ${site.trade.toUpperCase()} — ${site.city}, ${site.state}
  </div>
  <div style="padding:24px;font-size:15px;color:#1e293b;line-height:1.8;">
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Phone:</strong> <a href="tel:${phone}" style="color:#e8621a;">${phone || "N/A"}</a></p>
    ${email ? `<p><strong>Email:</strong> <a href="mailto:${email}" style="color:#e8621a;">${email}</a></p>` : ""}
    <p style="font-size:13px;color:#16a34a;margin-top:16px;">✓ Source: Facebook Lead Ad</p>
    <hr style="border:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:13px;color:#64748b;">Captured at ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
    ${site.active_contractor_id ? "<p style='font-size:13px;color:#16a34a;'>✓ Contractor notified automatically.</p>" : "<p style='font-size:13px;color:#f59e0b;'>⚠ No contractor assigned — free lead.</p>"}
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
    <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
    <div style="font-size:13px;color:#64748b;">
      <strong style="color:#1e293b;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
    </div>
  </div>
</div></body></html>`,
            }),
          });

          // Notify contractor if assigned
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
                  bcc: ["matthewmichels4@gmail.com"],
                  subject: `🔥 New ${site.trade} lead — ${name} in ${site.city}`,
                  html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;padding:12px 24px;color:#fff;font-weight:700;font-size:16px;">
    New Exclusive Lead — ${site.trade.toUpperCase()}
  </div>
  <div style="padding:24px;font-size:15px;color:#1e293b;line-height:1.9;">
    <p>Hey ${contractor.name || contractor.business_name || "there"} —</p>
    <p>A new ${site.trade} lead just came in. <strong>You're the only one getting this.</strong></p>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Phone:</strong> <a href="tel:${phone}" style="color:#e8621a;font-size:18px;font-weight:700;">${phone || "N/A"}</a></p>
    ${email ? `<p><strong>Email:</strong> ${email}</p>` : ""}
    <p style="margin-top:20px;font-size:13px;color:#64748b;">Source: Facebook Lead Ad · ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
  </div>
</div></body></html>`,
                }),
              });

              if (lead) {
                await sb.from("contractor_leads").update({ notified_at: new Date().toISOString(), status: "notified" }).eq("id", lead.id);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[FB-WEBHOOK] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
