// techalert-reply-handler — Resend inbound webhook
// Detects positive replies to cold outreach, flags the prospect as a hot reply,
// SMS Matt immediately, auto-replies to the prospect within 2 minutes.
//
// Wire as a Resend inbound webhook URL. Public endpoint (verify_jwt = false).
// Optional shared-secret check via INBOUND_WEBHOOK_SECRET query param or header.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { dwaColdEmail } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const INBOUND_SECRET = Deno.env.get("INBOUND_WEBHOOK_SECRET") || "";

const POSITIVE_PATTERNS = /\b(yes|sure|send(\s+it)?|interested|please|sounds\s+good|ok(ay)?|y(ea|eah|up)?)\b/i;
const NEGATIVE_PATTERNS = /\b(no|not\s+interested|stop|unsubscribe|remove)\b/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function extractEmail(field: unknown): string | null {
  if (!field) return null;
  if (typeof field === "string") {
    const m = field.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    return m ? m[0].toLowerCase() : null;
  }
  if (Array.isArray(field) && field.length) return extractEmail(field[0]);
  if (typeof field === "object") {
    const o = field as Record<string, unknown>;
    return extractEmail(o.email ?? o.address ?? o.from ?? null);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Optional shared-secret gate
  if (INBOUND_SECRET) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") || req.headers.get("x-webhook-secret") || "";
    if (provided !== INBOUND_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const payload = await req.json().catch(() => ({}));
    // Resend inbound shape varies; check both top-level and `data` wrapper.
    const data = payload?.data ?? payload ?? {};
    const fromEmail = extractEmail(data.from) || extractEmail(payload.from);
    const rawText: string =
      data.text || data.plain || data.body_plain || data.bodyPlain ||
      data.html?.replace(/<[^>]+>/g, " ") || payload.text || "";
    const replyBody = String(rawText || "").trim().slice(0, 500);

    if (!fromEmail) {
      return new Response(JSON.stringify({ ok: true, note: "no sender email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find prospect (case-insensitive)
    const { data: prospect } = await sb
      .from("techalert_prospect_targets")
      .select("id, owner_name, company_name, owner_email, owner_phone, role")
      .ilike("owner_email", fromEmail)
      .order("outreach_sent_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!prospect) {
      return new Response(JSON.stringify({ ok: true, note: "sender not in prospect targets", email: fromEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isPositive = POSITIVE_PATTERNS.test(replyBody) && !NEGATIVE_PATTERNS.test(replyBody);
    const isNegative = NEGATIVE_PATTERNS.test(replyBody);

    await sb.from("techalert_prospect_targets")
      .update({
        replied_at: new Date().toISOString(),
        reply_positive: isPositive,
        reply_body: replyBody,
        outreach_status: isPositive ? "replied_positive" : isNegative ? "replied_negative" : "replied_neutral",
      })
      .eq("id", prospect.id);

    if (isPositive) {
      // SMS Matt — fire and don't fail handler if SMS errors
      const firstName = prospect.owner_name?.split(" ")[0] || "Owner";
      const phoneInfo = prospect.owner_phone ? `Call: ${prospect.owner_phone}` : `Email: ${prospect.owner_email}`;
      const sms = `✅ HOT REPLY from ${firstName} at ${prospect.company_name} (${prospect.owner_email}). ${phoneInfo}. They said: "${replyBody.slice(0, 80)}"`;
      sendSMS(ADMIN_PHONE, TWILIO_FROM, sms, "techalert-reply").catch((e) =>
        console.error("[reply-handler] SMS failed:", e)
      );

      // Auto-response email (fire-and-forget)
      const greeting = firstName === "Owner" ? "there" : firstName;
      const autoBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6;max-width:560px;margin:0 auto;padding:20px;">
<p>Thanks ${greeting} — I'll send the list right over. Give me 5 minutes.</p>
<p>— Matt<br>(313) 992-1219</p>
</body></html>`;
      dwaColdEmail({
        to: prospect.owner_email!,
        subject: `Re: your reply`,
        bodyHtml: autoBody,
        product: "TechAlert",
        ctaUrl: "https://detroitwebagent.com",
        templateName: "techalert_auto_response",
        plainMode: true,
      }, sb).catch((e) => console.error("[reply-handler] auto-reply failed:", e));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-reply-handler",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { positive: isPositive, negative: isNegative, prospect_id: prospect.id },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      ok: true,
      prospect_id: prospect.id,
      positive: isPositive,
      negative: isNegative,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reply-handler] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
