// Outreach Reply Handler
// Accepts inbound replies (email forwarded as JSON, or SMS via Twilio).
// Classifies sentiment with simple keyword rules and stores in outreach_replies.
// Inbound email: configure Resend inbound or forward to this endpoint with { from, subject, body }.
// Inbound SMS: configure Twilio Messaging webhook to POST here with form-encoded { From, Body }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      // Twilio inbound SMS
      const form = await req.formData();
      channel = "sms";
      from = String(form.get("From") || "");
      body = String(form.get("Body") || "");
      raw = Object.fromEntries(form.entries());
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
  let prospect: { id: string; email: string | null; phone: string | null } | null = null;
  if (channel === "email") {
    const email = extractEmail(from) || from.toLowerCase();
    const { data } = await supabase
      .from("contractor_outreach_prospects")
      .select("id,email,phone").ilike("email", email).maybeSingle();
    prospect = data;
  } else {
    const { data } = await supabase
      .from("contractor_outreach_prospects")
      .select("id,email,phone").eq("phone", from).maybeSingle();
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
