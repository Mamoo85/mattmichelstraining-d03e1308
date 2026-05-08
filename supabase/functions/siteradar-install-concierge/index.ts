// SiteRadar Install Concierge — emails the customer's webmaster with a
// branded install walkthrough + the snippet pre-filled. Sets install_status=pending.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail } from "../_shared/dwa-email.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { client_id, webmaster_email, webmaster_name, platform } = await req.json();
    if (!client_id || !webmaster_email) {
      return new Response(JSON.stringify({ error: "client_id + webmaster_email required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: client } = await sb
      .from("field_crm_clients")
      .select("business_name, owner_name, visitor_script_key")
      .eq("id", client_id)
      .maybeSingle();
    if (!client) {
      return new Response(JSON.stringify({ error: "client not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const snippet = `<script async src="${SUPABASE_URL}/functions/v1/visitor-identify?key=${client.visitor_script_key}"></script>`;

    const html = `
<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#0a1628;color:#fff;padding:32px;border-radius:8px;">
  <p style="color:#00d4ff;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 8px;">📡 SiteRadar Install</p>
  <h2 style="color:#fff;margin:0 0 12px;">Quick install request from ${client.owner_name || client.business_name}</h2>
  <p style="color:#cbd5e1;line-height:1.6;font-size:14px;">Hi${webmaster_name ? " " + webmaster_name : ""},</p>
  <p style="color:#cbd5e1;line-height:1.6;font-size:14px;">${client.owner_name || client.business_name} just signed up for <strong>SiteRadar</strong> — a tool that identifies which businesses visit ${client.business_name}'s website (no personal data, fully GDPR/CCPA-safe).</p>
  <p style="color:#cbd5e1;line-height:1.6;font-size:14px;">Could you paste this one-line snippet just before the closing <code style="color:#00d4ff;">&lt;/body&gt;</code> tag (or add it as a custom HTML block in ${platform || "the site builder"})?</p>
  <pre style="background:#030711;color:#94a3b8;padding:14px;border-radius:6px;font-size:11px;overflow-x:auto;border:1px solid #1e3a5f;">${snippet}</pre>
  <p style="color:#cbd5e1;line-height:1.6;font-size:14px;">It's about 30 seconds of work. Reply once it's live and we'll verify on our end. Any questions, hit reply — I'm Matt at Detroit Web Agency.</p>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px;">Thanks!<br/>Matt Michels<br/>Detroit Web Agency<br/>(313) 992-1219</p>
</div>`;

    await dwaEmail({
      to: webmaster_email,
      subject: `Quick favor — SiteRadar install for ${client.business_name}`,
      html,
    });

    await sb.from("field_crm_clients")
      .update({ install_status: "pending", install_platform: platform || null })
      .eq("id", client_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
