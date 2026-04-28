// Resend Webhook Receiver
// Captures email.bounced, email.complained, email.opened, email.clicked events
// from Resend and updates prospects + audit log accordingly.
// Configure in Resend dashboard: https://resend.com/webhooks → POST to this endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySvixSignature } from "../_shared/webhook-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    click?: { link?: string; ipAddress?: string; userAgent?: string };
    tags?: Array<{ name: string; value: string }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Read raw body once for signature verification
  const rawBody = await req.text();

  if (!RESEND_WEBHOOK_SECRET) {
    console.warn("[resend-bounce-webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned webhooks (DEV ONLY)");
  } else {
    const ok = await verifySvixSignature(rawBody, req.headers, RESEND_WEBHOOK_SECRET);
    if (!ok) {
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders });
  }

  const email = event.data?.to?.[0]?.toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ ok: true, skipped: "no recipient" }), { status: 200, headers: corsHeaders });
  }

  // Resolve prospect by email
  const { data: prospect } = await supabase
    .from("contractor_outreach_prospects")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  const prospectId = prospect?.id ?? null;

  try {
    switch (event.type) {
      case "email.bounced": {
        const bounceType = event.data.bounce?.type === "Permanent" ? "hard" : "soft";
        const reason = event.data.bounce?.message || event.data.bounce?.subType || "bounce";
        await supabase.rpc("handle_email_bounce", {
          p_email: email, p_bounce_type: bounceType, p_reason: reason,
        });
        break;
      }
      case "email.complained": {
        // Spam complaint — instant suppression
        await supabase.from("contractor_outreach_suppression").insert({
          contact: email, contact_type: "email", source: "complaint", reason: "Spam complaint via Resend",
        }).select(); // ignore conflict
        if (prospectId) {
          await supabase.from("contractor_outreach_prospects")
            .update({ unsubscribed_at: new Date().toISOString() })
            .eq("id", prospectId);
          await supabase.from("contractor_outreach_audit_log").insert({
            prospect_id: prospectId, channel: "email", event: "complaint",
            reason: "Spam complaint",
          });
        }
        break;
      }
      case "email.opened": {
        if (prospectId) {
          await supabase.from("contractor_outreach_audit_log").insert({
            prospect_id: prospectId, channel: "email", event: "opened",
            reason: event.data.subject || "open",
          });
        }
        break;
      }
      case "email.clicked": {
        if (prospectId) {
          await supabase.from("contractor_outreach_audit_log").insert({
            prospect_id: prospectId, channel: "email", event: "clicked",
            reason: event.data.click?.link?.slice(0, 240) || "click",
            ip_address: event.data.click?.ipAddress,
            user_agent: event.data.click?.userAgent,
          });
        }
        break;
      }
      case "email.delivered":
      case "email.sent":
        // Already logged when worker sent it
        break;
      default:
        console.log("unhandled resend event", event.type);
    }
  } catch (e) {
    console.error("resend webhook handler error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, type: event.type, prospect_id: prospectId }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
