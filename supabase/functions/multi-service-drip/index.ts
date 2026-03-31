import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const log = (step: string, data?: any) =>
  console.log(`[MULTI-SERVICE-DRIP] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const MAX_LEADS_PER_RUN = 10;
const SEND_DELAY_MS = 300;

interface ServiceOffer {
  name: string;
  price: string;
}

function getServicesForIndustry(industry: string): ServiceOffer[] {
  const normalized = (industry || "").toLowerCase();

  const isContractor = [
    "hvac", "plumbing", "roofing", "electrical", "landscaping",
    "pest control", "cleaning", "handyman",
  ].some((k) => normalized.includes(k));

  const isRestaurantRetail = [
    "restaurant", "food", "retail", "bar", "cafe", "bakery", "diner",
  ].some((k) => normalized.includes(k));

  const isMedical = [
    "medical", "dental", "healthcare", "clinic", "doctor", "dentist",
    "chiropractic", "optometry", "pharmacy",
  ].some((k) => normalized.includes(k));

  const isRealEstate = [
    "real estate", "insurance", "realtor", "broker", "mortgage",
  ].some((k) => normalized.includes(k));

  if (isContractor) {
    return [
      { name: "Missed Call Text-Back", price: "$99/mo" },
      { name: "Review Request SMS", price: "$39/mo" },
      { name: "Quote Follow-Up SMS", price: "$49/mo" },
      { name: "Contractor Invoicing", price: "$29/mo" },
    ];
  }

  if (isRestaurantRetail) {
    return [
      { name: "Text Message Marketing", price: "$79/mo" },
      { name: "Social Media AI", price: "$199/mo" },
      { name: "Review Request SMS", price: "$39/mo" },
      { name: "Win-Back SMS", price: "$49/mo" },
    ];
  }

  if (isMedical) {
    return [
      { name: "AI Reputation Dashboard", price: "$79/mo" },
      { name: "Review Request SMS", price: "$39/mo" },
      { name: "AI Phone Answering", price: "$149/mo" },
    ];
  }

  if (isRealEstate) {
    return [
      { name: "AI Phone Answering", price: "$149/mo" },
      { name: "AI Blog Post Service", price: "$79/mo" },
      { name: "Text Marketing", price: "$79/mo" },
    ];
  }

  // Default
  return [
    { name: "AI Reputation Dashboard", price: "$79/mo" },
    { name: "Text Message Marketing", price: "$79/mo" },
    { name: "Social Media AI", price: "$199/mo" },
  ];
}

function buildMultiServiceEmailHtml(subject: string, body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tr><td style="background:#e8621a;padding:3px 0;"></td></tr>
    <tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">
      ${htmlBody}
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
        <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px;">Prefer to just text? (313) 806-4952</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
      Matt Michels · M2 Performance Training · Grosse Pointe, MI · (313) 806-4952<br>
      <a href="https://www.mattmichelstraining.com" style="color:#94a3b8;">mattmichelstraining.com</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Query outreach_leads: status = 'Emailed', email not null
    const { data: leads, error: leadsErr } = await serviceClient
      .from("outreach_leads" as any)
      .select("id, business_name, email, industry, city, status")
      .eq("status", "Emailed")
      .not("email", "is", null)
      .not("email", "eq", "")
      .limit(100); // Fetch more than needed so we can filter already-pitched ones

    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      log("No Emailed leads found");
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No eligible leads" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    log("Fetched Emailed leads", { count: leads.length });

    let sent = 0;
    let processed = 0;

    for (const lead of leads) {
      if (processed >= MAX_LEADS_PER_RUN) break;

      try {
        const leadId: string = lead.id;
        const email: string = lead.email;
        const businessName: string = lead.business_name || "your business";
        const industry: string = lead.industry || "";
        const city: string = lead.city || "your area";

        // Check if multi_service_pitch already sent for this lead
        const { data: existingLog, error: logErr } = await serviceClient
          .from("email_send_log" as any)
          .select("id")
          .eq("lead_id", leadId)
          .eq("template_name", "multi_service_pitch")
          .limit(1);

        if (logErr) {
          log("Log check error", { leadId, error: String(logErr) });
          continue;
        }

        if (existingLog && existingLog.length > 0) {
          log("Already pitched, skipping", { leadId, email });
          continue;
        }

        processed++;

        const services = getServicesForIndustry(industry);
        const serviceList = services
          .map((s) => `• ${s.name} — ${s.price}`)
          .join("\n");

        // Generate personalized email body via Claude Haiku
        const claudeRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            system:
              "You are Matt Michels, local business consultant in Grosse Pointe MI. Casual, direct, personal tone.",
            messages: [
              {
                role: "user",
                content: `Write a SHORT email (under 120 words) to ${businessName}, a ${industry || "local business"} in ${city}. Introduce these services that could help them grow, and encourage them to reply or visit mattmichelstraining.com to learn more. Keep it friendly and local. Do not add a subject line. Start with "Hey —". End with "— Matt". Here are the services to highlight:\n${serviceList}` },
            ] }) });

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          log("Claude API error", { leadId, error: errText });
          continue;
        }

        const claudeJson = await claudeRes.json();
        const emailBody: string =
          claudeJson?.content?.[0]?.text?.trim() ||
          `Hey —\n\nI wanted to reach out about a few tools that might help ${businessName} get more calls and grow.\n\nHere's what I offer:\n${serviceList}\n\nAll automated — no extra work on your end. Happy to chat if any of it sounds useful.\n\nmattmichelstraining.com\n\n— Matt`;

        const subject = `A few more ways I can help ${businessName}`;
        const html = buildMultiServiceEmailHtml(subject, emailBody);

        // Send via Resend
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@notify.m2training.com>",
            reply_to: "matt@m2training.com",
            to: [email],
            subject,
            html }) });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          log("Resend error", { leadId, email, error: errText });
          continue;
        }

        const resendJson = await resendRes.json();
        const messageId: string = resendJson?.id || `multi_${leadId}`;

        // Log the send to email_send_log
        const { error: insertErr } = await serviceClient
          .from("email_send_log" as any)
          .insert({
            lead_id: leadId,
            template_name: "multi_service_pitch",
            status: "sent",
            sent_at: new Date().toISOString(),
            message_id: messageId });

        if (insertErr) {
          log("Log insert error", { leadId, error: String(insertErr) });
          // Don't stop — email already sent, log failure is non-fatal
        }

        sent++;
        log("Email sent", { leadId, email, businessName, industry });

        await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
      } catch (err) {
        log("Per-lead error", { leadId: lead.id, error: String(err) });
      }
    }

    log("Run complete", { sent, processed });
    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("FATAL ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
