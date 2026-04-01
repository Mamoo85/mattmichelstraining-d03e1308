// Facebook Lead Ads webhook receiver
// Receives real-time lead submissions from Facebook Lead Ad forms
// and routes them into contractor_leads + notifies the contractor immediately.
//
// Setup in Facebook Developers:
//   1. Create a Facebook App (Business type)
//   2. Add "Webhooks" product → subscribe to Page → "leadgen" field
//   3. Callback URL: {SUPABASE_URL}/functions/v1/facebook-lead-webhook
//   4. Verify token: value of FACEBOOK_WEBHOOK_VERIFY_TOKEN secret
//
// Required Supabase secrets:
//   FACEBOOK_WEBHOOK_VERIFY_TOKEN  — random string you choose, must match FB dashboard
//   FACEBOOK_PAGE_TOKEN            — Page Access Token for fetching lead details

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FACEBOOK_WEBHOOK_VERIFY_TOKEN = Deno.env.get("FACEBOOK_WEBHOOK_VERIFY_TOKEN") || "";
const FACEBOOK_PAGE_TOKEN = Deno.env.get("FACEBOOK_PAGE_TOKEN") || "";

serve(async (req) => {
  // ── WEBHOOK VERIFICATION (GET) ────────────────────────────────────────────
  // Facebook sends a GET request to verify the endpoint before subscribing
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
      console.log("[FB-LEAD-WEBHOOK] Verification successful");
      return new Response(challenge, { status: 200 });
    }
    console.error("[FB-LEAD-WEBHOOK] Verification failed — token mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  // ── LEAD RECEIVED (POST) ──────────────────────────────────────────────────
  if (req.method === "POST") {
    // Must return 200 within 5 seconds or Facebook will retry
    const bodyText = await req.text();
    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      console.error("[FB-LEAD-WEBHOOK] Invalid JSON body");
      return new Response("ok", { status: 200 }); // still return 200 to stop retries
    }

    console.log("[FB-LEAD-WEBHOOK] Received:", JSON.stringify(body).slice(0, 300));

    // Facebook webhook payload structure:
    // { object: "page", entry: [{ id, time, changes: [{ value: { leadgen_id, page_id, form_id }, field: "leadgen" }] }] }
    const entries = body?.entry || [];
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    for (const entry of entries) {
      for (const change of entry?.changes || []) {
        if (change.field !== "leadgen") continue;

        const { leadgen_id, page_id } = change.value || {};
        if (!leadgen_id || !page_id) continue;

        // Fetch full lead data from Facebook Graph API
        let leadData: any = null;
        if (FACEBOOK_PAGE_TOKEN) {
          try {
            const fbRes = await fetch(
              `https://graph.facebook.com/v19.0/${leadgen_id}?fields=field_data,created_time&access_token=${FACEBOOK_PAGE_TOKEN}`
            );
            if (fbRes.ok) {
              leadData = await fbRes.json();
            } else {
              const err = await fbRes.text();
              console.error("[FB-LEAD-WEBHOOK] Graph API error:", err);
            }
          } catch (e) {
            console.error("[FB-LEAD-WEBHOOK] Failed to fetch lead data:", e);
          }
        }

        // Map Facebook field_data array to our fields
        // Facebook field names vary by form setup — handle common variations
        const fields: Record<string, string> = {};
        for (const f of leadData?.field_data || []) {
          fields[f.name.toLowerCase()] = f.values?.[0] || "";
        }

        const name =
          fields["full_name"] ||
          fields["name"] ||
          `${fields["first_name"] || ""} ${fields["last_name"] || ""}`.trim() ||
          "Unknown";
        const phone = fields["phone_number"] || fields["phone"] || fields["mobile_number"] || "";
        const email = fields["email"] || fields["email_address"] || "";
        const projectType = fields["what_service_do_you_need"] || fields["service"] || fields["project_type"] || "";
        const message = fields["message"] || fields["additional_details"] || fields["notes"] || "";

        if (!phone && !email) {
          console.warn("[FB-LEAD-WEBHOOK] Lead has no phone or email — skipping:", leadgen_id);
          continue;
        }

        // Find the matching territory by facebook_page_id
        const { data: site } = await sb
          .from("contractor_lead_sites")
          .select("id, trade, city, state, active_contractor_id, slug")
          .eq("facebook_page_id", page_id)
          .maybeSingle();

        // Insert lead regardless of whether we found a site
        const { data: lead, error: insertErr } = await sb
          .from("contractor_leads")
          .insert({
            site_id: site?.id || null,
            client_id: site?.active_contractor_id || null,
            name,
            phone: phone || "",
            email: email || null,
            project_type: projectType || null,
            message: message || null,
            source: "facebook",
            status: "new",
          })
          .select()
          .single();

        if (insertErr) {
          console.error("[FB-LEAD-WEBHOOK] Insert error:", insertErr);
          continue;
        }

        console.log(`[FB-LEAD-WEBHOOK] Lead saved: ${name} ${phone} | site: ${site?.slug || "unmatched page_id:" + page_id}`);

        if (!RESEND_API_KEY) continue;

        const tradeLabel = site?.trade || "service";
        const cityLabel = site?.city || "Unknown city";
        const stateLabel = site?.state || "";

        const siteNote = !site
          ? `<p style='font-size:13px;color:#dc2626;font-weight:bold;'>⚠ Facebook page ID "${page_id}" has no matching territory — update facebook_page_id in contractor_lead_sites.</p>`
          : !site.active_contractor_id
          ? "<p style='font-size:13px;color:#f59e0b;'>⚠ No contractor assigned yet — free lead until you sign one.</p>"
          : "<p style='font-size:13px;color:#16a34a;'>✓ Contractor notified automatically.</p>";

        // Email Matt
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Leads <matt@mattmichelstraining.com>",
            to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
            subject: `🔥 Facebook lead — ${tradeLabel} ${cityLabel} — ${name}`,
            html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#1877f2;padding:12px 24px;color:#fff;font-weight:700;font-size:16px;">
    Facebook Lead — ${tradeLabel.toUpperCase()} — ${cityLabel}${stateLabel ? `, ${stateLabel}` : ""}
  </div>
  <div style="padding:24px;font-size:15px;color:#1e293b;line-height:1.8;">
    <p><strong>Name:</strong> ${name}</p>
    ${phone ? `<p><strong>Phone:</strong> <a href="tel:${phone}" style="color:#e8621a;">${phone}</a></p>` : ""}
    ${email ? `<p><strong>Email:</strong> <a href="mailto:${email}" style="color:#e8621a;">${email}</a></p>` : ""}
    ${projectType ? `<p><strong>Service needed:</strong> ${projectType}</p>` : ""}
    ${message ? `<p><strong>Notes:</strong> ${message}</p>` : ""}
    <hr style="border:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:13px;color:#64748b;">Source: <strong>Facebook Lead Ad</strong> · Page ID: ${page_id} · ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
    ${siteNote}
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
    <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
    <div style="font-size:13px;color:#64748b;"><strong>Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div>
  </div>
</div></body></html>`,
          }),
        });

        // If contractor assigned, notify them immediately
        if (site?.active_contractor_id) {
          const { data: contractor } = await sb
            .from("contractor_clients")
            .select("name, email, business_name")
            .eq("id", site.active_contractor_id)
            .single();

          if (contractor?.email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Lead Network <matt@mattmichelstraining.com>",
                to: [contractor.email], bcc: ["matthewmichels4@gmail.com"],
                subject: `🔥 New ${tradeLabel} lead — ${name} in ${cityLabel}`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;padding:12px 24px;color:#fff;font-weight:700;font-size:16px;">
    New Exclusive Lead — ${tradeLabel.toUpperCase()}
  </div>
  <div style="padding:24px;font-size:15px;color:#1e293b;line-height:1.9;">
    <p>Hey ${contractor.name || contractor.business_name || "there"} —</p>
    <p>A new ${tradeLabel} lead just came in for your territory. <strong>You're the only one getting this.</strong></p>
    <p><strong>Name:</strong> ${name}</p>
    ${phone ? `<p><strong>Phone:</strong> <a href="tel:${phone}" style="color:#e8621a;font-size:18px;font-weight:700;">${phone}</a></p>` : ""}
    ${email ? `<p><strong>Email:</strong> ${email}</p>` : ""}
    ${projectType ? `<p><strong>Service needed:</strong> ${projectType}</p>` : ""}
    ${message ? `<p><strong>Notes:</strong> ${message}</p>` : ""}
    <p style="margin-top:20px;font-size:13px;color:#64748b;">Received ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
    <p style="font-size:13px;color:#64748b;">Questions? Email <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
    <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
    <div style="font-size:13px;color:#64748b;"><strong>Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div>
  </div>
</div></body></html>`,
              }),
            });

            if (lead) {
              await sb.from("contractor_leads")
                .update({ notified_at: new Date().toISOString(), status: "notified" })
                .eq("id", lead.id);
            }
          }
        }
      }
    }

    return new Response("ok", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});
