// auto-draft-on-inbound — runs every minute via cron.
// Finds inbound SMS in system_comms_log from the last 5 minutes that don't
// already have a draft cached, generates an AI reply, caches it in
// sms_reply_drafts (status=pending), and texts Matt a preview he can approve
// with "A" or edit with "E <message>".

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: inbounds } = await sb
      .from("system_comms_log")
      .select("id, body_preview, metadata, created_at")
      .eq("channel", "sms")
      .eq("status", "inbound")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    const results: Array<{ phone: string; status: string }> = [];

    for (const row of inbounds || []) {
      const meta = ((row as any).metadata || {}) as Record<string, unknown>;
      const fromRaw = typeof meta.from === "string" ? meta.from : "";
      const phone = normalize(fromRaw);
      if (!phone) continue;
      // Skip Matt's own personal cell — those are admin commands, not contractor inbound
      if (phone === ADMIN_PHONE) continue;

      // Skip if we already drafted for this inbound id
      const { data: existing } = await sb
        .from("sms_reply_drafts")
        .select("id")
        .eq("inbound_message_id", (row as any).id)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      // Generate the draft
      const draftRes = await fetch(`${SUPABASE_URL}/functions/v1/draft-sms-reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      if (!draftRes.ok) {
        console.warn("[auto-draft] draft-sms-reply failed:", draftRes.status);
        continue;
      }
      const { draft } = await draftRes.json();
      if (!draft || typeof draft !== "string") continue;

      // Mark any older pending drafts for this phone as expired (we keep only latest)
      await sb
        .from("sms_reply_drafts")
        .update({ status: "expired" })
        .eq("phone", phone)
        .eq("status", "pending");

      // Cache the new draft
      await sb.from("sms_reply_drafts").insert({
        phone,
        draft_body: draft,
        status: "pending",
        inbound_message_id: (row as any).id,
        inbound_body: (row as any).body_preview || "",
      });

      // Look up contact label for the preview
      let label = phone;
      try {
        const digits = phone.replace(/\D/g, "").slice(-10);
        const { data: cc } = await sb
          .from("contractor_clients")
          .select("business_name")
          .ilike("phone", `%${digits}%`)
          .limit(1)
          .maybeSingle();
        if (cc?.business_name) label = `${cc.business_name} (${phone})`;
      } catch (_) { /* noop */ }

      const inboundPreview = ((row as any).body_preview || "").slice(0, 140);
      const previewSms =
        `📩 ${label}: "${inboundPreview}"\n\n💡 Suggested reply:\n${draft}\n\nReply A to send, ` +
        `E <your edit> to edit, or just type your own reply.`;

      await sendSMS(ADMIN_PHONE, TWILIO_FROM, previewSms.slice(0, 1500), "auto_draft_preview");
      results.push({ phone, status: "drafted" });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[auto-draft-on-inbound] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

function normalize(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(digits)) return digits;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^\d{11}$/.test(digits)) return `+${digits}`;
  return null;
}
