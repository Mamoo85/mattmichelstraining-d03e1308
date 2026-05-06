// missed-call-escalation — runs every 30 min.
// If a missed-call text-back has no reply in 4 hours, emails Matt with full context.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

  // Captures older than 4h with no reply, created within last 8h (don't spam for old ones)
  const { data: stale } = await sb
    .from("missed_call_captures")
    .select("id, caller_number, city, voicemail_transcript, text_sent, created_at")
    .eq("status", "new")
    .is("reply_received", null)
    .lte("created_at", fourHoursAgo)
    .gte("created_at", eightHoursAgo);

  if (!stale?.length) return new Response(JSON.stringify({ ok: true, escalated: 0 }));

  const rows = (stale as Array<{ id: string; caller_number: string; city?: string; voicemail_transcript?: string; text_sent?: string; created_at: string }>)
    .map((r) => `<tr><td style="padding:8px;border-bottom:1px solid #1e293b;">${r.caller_number}</td><td style="padding:8px;border-bottom:1px solid #1e293b;">${r.city || "—"}</td><td style="padding:8px;border-bottom:1px solid #1e293b;">${r.voicemail_transcript ? r.voicemail_transcript.slice(0, 60) : "—"}</td><td style="padding:8px;border-bottom:1px solid #1e293b;">${new Date(r.created_at).toLocaleTimeString()}</td></tr>`)
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DWA System <matt@detroitwebagent.com>",
      to: ["matt@detroitwebagent.com"],
      subject: `📞 ${stale.length} missed call lead(s) haven't replied in 4+ hours`,
      html: `<div style="font-family:sans-serif;max-width:560px;background:#0a1628;color:#fff;padding:32px;border-radius:8px;"><h2 style="color:#f59e0b;margin:0 0 16px;">Unresponsive missed-call leads</h2><p style="margin:0 0 20px;color:#94a3b8;">These callers got your text-back but haven't replied. Consider calling them directly.</p><table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="color:#00d4ff;text-align:left;"><th style="padding:8px;">Number</th><th style="padding:8px;">City</th><th style="padding:8px;">Voicemail</th><th style="padding:8px;">Called at</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    }),
  });

  // Mark as in_progress so we don't re-escalate
  const ids = (stale as Array<{ id: string }>).map((r) => r.id);
  await sb.from("missed_call_captures").update({ status: "in_progress" }).in("id", ids);

  return new Response(JSON.stringify({ ok: true, escalated: stale.length }), { headers: { "Content-Type": "application/json" } });
});
