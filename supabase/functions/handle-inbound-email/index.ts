// handle-inbound-email
// Receives inbound emails via Resend or SendGrid inbound webhooks.
// Extracts sender + body, calls ai-reply-detector to categorize and handle.
// Set up: configure Resend/SendGrid inbound to POST to this endpoint.
// Reply-To on Tom's outbound: replies@detroitwebagency.com → inbound webhook here.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization" },
    });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let senderEmail = "";
    let senderName = "";
    let replyBody = "";
    let originalSubject = "";

    if (contentType.includes("application/json")) {
      // Resend inbound webhook format
      const body = await req.json();
      senderEmail = body.from?.email || body.sender || body.from || "";
      senderName = body.from?.name || "";
      replyBody = body.text || body.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
      originalSubject = body.subject || "";
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      // SendGrid Inbound Parse format
      const form = await req.formData();
      const fromRaw = form.get("from")?.toString() || "";
      // Parse "Name <email@domain.com>" format
      const emailMatch = fromRaw.match(/<([^>]+)>/);
      senderEmail = emailMatch ? emailMatch[1] : fromRaw;
      const nameMatch = fromRaw.match(/^([^<]+)</);
      senderName = nameMatch ? nameMatch[1].trim().replace(/"/g, "") : "";
      replyBody = form.get("text")?.toString() || form.get("html")?.toString()?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
      originalSubject = form.get("subject")?.toString() || "";
    } else {
      // Try JSON as fallback
      try {
        const body = await req.json();
        senderEmail = body.from || body.sender_email || "";
        senderName = body.sender_name || "";
        replyBody = body.text || body.body || "";
        originalSubject = body.subject || "";
      } catch {
        return new Response(JSON.stringify({ error: "Unsupported content type" }), { status: 400 });
      }
    }

    if (!senderEmail || !replyBody) {
      console.error("[handle-inbound-email] Missing senderEmail or replyBody", { senderEmail: !!senderEmail, replyBody: !!replyBody });
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // Strip quoted/previous email threads (everything after "On ... wrote:" or "---")
    const cleanBody = replyBody
      .replace(/On .+wrote:[\s\S]*/i, "")
      .replace(/[-_]{3,}[\s\S]*/g, "")
      .replace(/From:[\s\S]*/i, "")
      .trim()
      .slice(0, 2000);

    console.log(`[handle-inbound-email] Received from ${senderEmail}: "${cleanBody.slice(0, 100)}"`);

    // Forward to ai-reply-detector
    const detectorRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-reply-detector`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ senderEmail, senderName, replyBody: cleanBody, originalSubject }),
    });

    const result = await detectorRes.json();
    console.log(`[handle-inbound-email] ai-reply-detector result:`, result);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[handle-inbound-email] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
