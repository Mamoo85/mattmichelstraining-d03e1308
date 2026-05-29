// cancel-reply-draft
// Matt clicks the cancel URL from the Ghost Delay SMS to prevent an objection reply from sending.
// GET ?id=<draft_uuid> — sets cancelled=true in email_reply_drafts.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing draft ID", { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: draft, error } = await sb
    .from("email_reply_drafts")
    .select("id, lead_email, sent, cancelled")
    .eq("id", id)
    .single();

  if (error || !draft) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Draft not found</h2></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  if (draft.sent) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#f8fafc;">
<div style="max-width:400px;margin:0 auto;">
  <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
  <h2 style="color:#1e293b;">Already Sent</h2>
  <p style="color:#64748b;">This reply was already sent to ${draft.lead_email} before you could cancel it.</p>
</div>
</body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  if (draft.cancelled) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#f8fafc;">
<div style="max-width:400px;margin:0 auto;">
  <div style="font-size:48px;margin-bottom:16px;">✅</div>
  <h2 style="color:#1e293b;">Already Cancelled</h2>
  <p style="color:#64748b;">This draft was already cancelled for ${draft.lead_email}.</p>
</div>
</body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  await sb.from("email_reply_drafts").update({ cancelled: true }).eq("id", id);

  return new Response(
    `<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;text-align:center;background:#f8fafc;">
<div style="max-width:400px;margin:0 auto;">
  <div style="font-size:48px;margin-bottom:16px;">🛑</div>
  <h2 style="color:#1e293b;margin-bottom:8px;">Reply Cancelled</h2>
  <p style="color:#64748b;">The draft to <strong>${draft.lead_email}</strong> has been cancelled.</p>
  <p style="color:#94a3b8;font-size:14px;margin-top:24px;">Reply to them manually when you're ready, or let it go.</p>
</div>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
});
