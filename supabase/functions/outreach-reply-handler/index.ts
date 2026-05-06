// Outreach Reply Handler
// Accepts inbound replies (email forwarded as JSON, or SMS via Twilio).
// Classifies sentiment with simple keyword rules and stores in outreach_replies.
// Positive replies: instantly auto-responds with Claude-drafted follow-up + calendar link,
//   and SMSes Matt with a summary so he can follow up personally.
// Inbound email: configure Resend inbound or forward to this endpoint with { from, subject, body }.
// Inbound SMS: configure Twilio Messaging webhook to POST here with form-encoded { From, Body }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyTwilioSignature } from "../_shared/webhook-verify.ts";
import { generateWithHaiku } from "../_shared/opus.ts";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { dwaEmail } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
// Matt's booking link — auto-appended to every positive reply auto-response
const CALENDLY_URL = "https://calendly.com/detroitwebagency/discovery";

const UNSUB_KEYWORDS = ["unsubscribe", "stop", "remove me", "opt out", "opt-out", "no thanks", "do not email"];
const POSITIVE_KEYWORDS = ["interested", "yes", "send me", "tell me more", "sounds good", "let's talk", "lets talk", "more info", "pricing", "demo", "call me", "claim"];
const NEGATIVE_KEYWORDS = ["not interested", "wrong person", "don't contact", "go away", "spam", "fuck off"];
const AUTO_REPLY_KEYWORDS = ["out of office", "auto-reply", "vacation", "automatic reply", "delivery status notification"];

function classify(body: string): "unsubscribe" | "positive" | "negative" | "auto_reply" | "neutral" {
  const lower = (body || "").toLowerCase();
  if (AUTO_REPLY_KEYWORDS.some(k => lower.includes(k))) return "auto_reply";
  if (UNSUB_KEYWORDS.some(k => lower.includes(k))) return "unsubscribe";
  if (NEGATIVE_KEYWORDS.some(k => lower.includes(k))) return "negative";
  if (POSITIVE_KEYWORDS.some(k => lower.includes(k))) return "positive";
  return "neutral";
}

function extractEmail(s: string): string | null {
  const m = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

async function sendPositiveAutoReply(
  replyTo: string,
  prospectName: string | null,
  companyName: string | null,
  originalBody: string,
  channel: "email" | "sms",
): Promise<void> {
  const name = prospectName?.split(" ")[0] || "there";
  const company = companyName || "your company";

  try {
    const draft = await generateWithHaiku(
      `Write a warm 3-sentence reply to someone who expressed interest in our services.
Context:
- Their name: ${name}
- Their company: ${company}
- Their message snippet: "${originalBody.slice(0, 200)}"

Rules:
- Sentence 1: acknowledge their interest with genuine enthusiasm (mention their name)
- Sentence 2: offer to schedule a quick 15-minute call to learn about their situation
- Sentence 3: point them to the calendar link below to pick a time that works
- Natural, conversational tone — NOT salesy
- No subject, no sign-off, just the 3 sentences`,
      "You write warm, human follow-up messages for a web agency owner.",
      200,
    );

    if (channel === "email" && replyTo) {
      const html = `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7;font-size:15px">
<p>Hi ${name},</p>
<p>${draft.trim().replace(/\n\n/g, "</p><p>").replace(/\n/g, " ")}</p>
<p><a href="${CALENDLY_URL}" style="display:inline-block;background:#0a1628;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">📅 Pick a Time →</a></p>
<p style="margin-top:20px">Talk soon,<br><strong>Matt Michels</strong><br>Detroit Web Agency<br>(313) 992-1219</p>
</div>`;

      await dwaEmail({ to: replyTo, subject: `Re: Let's connect`, html });
    }
  } catch (e) {
    console.error("[reply-handler] auto-reply error:", e instanceof Error ? e.message : e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let channel: "email" | "sms" = "email";
  let from = "";
  let subject: string | null = null;
  let body = "";
  let raw: Record<string, unknown> = {};

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio inbound SMS — verify signature
      const form = await req.formData();
      const params: Record<string, string> = {};
      for (const [k, v] of form.entries()) params[k] = String(v);

      if (TWILIO_AUTH_TOKEN) {
        const fullUrl = req.url;
        const sig = req.headers.get("x-twilio-signature");
        const ok = await verifyTwilioSignature(fullUrl, params, sig, TWILIO_AUTH_TOKEN);
        if (!ok) {
          return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>", {
            status: 401, headers: { ...corsHeaders, "Content-Type": "text/xml" },
          });
        }
      } else {
        console.warn("[outreach-reply-handler] TWILIO_AUTH_TOKEN not set — accepting unsigned (DEV ONLY)");
      }

      channel = "sms";
      from = params.From || "";
      body = params.Body || "";
      raw = params;
    } else {
      const json = await req.json();
      raw = json;
      channel = (json.channel === "sms" ? "sms" : "email");
      from = String(json.from || json.From || "");
      subject = json.subject || null;
      body = String(json.body || json.text || json.html || "");
      // Strip HTML tags for classification
      if (body && /<[a-z][\s\S]*>/i.test(body)) body = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "parse failed", detail: e instanceof Error ? e.message : "" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!from || !body) {
    return new Response(JSON.stringify({ error: "from and body required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve prospect
  let prospect: { id: string; email: string | null; phone: string | null; business_name?: string | null; owner_name?: string | null } | null = null;
  if (channel === "email") {
    const email = extractEmail(from) || from.toLowerCase();
    const { data } = await supabase
      .from("contractor_outreach_prospects")
      .select("id,email,phone,business_name,owner_name").ilike("email", email).maybeSingle();
    prospect = data;
  } else {
    const { data } = await supabase
      .from("contractor_outreach_prospects")
      .select("id,email,phone,business_name,owner_name").eq("phone", from).maybeSingle();
    prospect = data;
  }

  const sentiment = classify(body);

  const { data: reply, error: insErr } = await supabase
    .from("outreach_replies")
    .insert({
      prospect_id: prospect?.id ?? null,
      channel, from_address: from, subject, body: body.slice(0, 4000),
      sentiment, raw,
    })
    .select("id").single();

  if (insErr) {
    console.error("reply insert error", insErr);
    return new Response(JSON.stringify({ error: insErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Side effects
  if (prospect?.id) {
    await supabase.from("contractor_outreach_audit_log").insert({
      prospect_id: prospect.id, channel, event: "replied",
      reason: `Sentiment: ${sentiment}`,
      metadata: { reply_id: reply!.id, subject },
    });

    await supabase.from("contractor_outreach_prospects")
      .update({ reply_status: sentiment }).eq("id", prospect.id);

    if (sentiment === "unsubscribe") {
      await supabase.from("contractor_outreach_prospects")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("id", prospect.id);
      const contact = channel === "email" ? (prospect.email || "").toLowerCase() : (prospect.phone || from);
      if (contact) {
        await supabase.from("contractor_outreach_suppression").insert({
          contact, contact_type: channel,
          source: channel === "sms" ? "sms_stop" : "unsubscribe_link",
          reason: "Reply contained unsubscribe keyword",
        }).select();
      }
    }

    // Positive reply: auto-respond instantly + SMS Matt
    if (sentiment === "positive") {
      const replyTo = channel === "email" ? (extractEmail(from) || from) : (prospect.email || "");
      const prospectName = prospect.owner_name || null;
      const companyName = prospect.business_name || null;

      // Fire-and-forget auto-reply (non-blocking)
      sendPositiveAutoReply(replyTo, prospectName, companyName, body, channel).catch(() => {});

      // SMS Matt immediately so he can follow up personally
      const mattAlert = `🔥 POSITIVE REPLY from ${companyName || replyTo} (${channel})\n"${body.slice(0, 120)}"\nCalendly auto-sent. Book: ${CALENDLY_URL}`;
      sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, mattAlert, "outreach_positive_reply").catch(() => {});
    }
  }

  // For Twilio SMS, return TwiML so Twilio doesn't treat as error
  if (channel === "sms") {
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>", {
      status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }

  return new Response(JSON.stringify({ ok: true, sentiment, prospect_id: prospect?.id ?? null }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
