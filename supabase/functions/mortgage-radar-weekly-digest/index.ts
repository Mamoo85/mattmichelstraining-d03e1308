// mortgage-radar-weekly-digest — every Monday 8am ET (cron: 0 13 * * 1)
// For each active LO client, sends a weekly SMS summary of new leads in their ZIPs.
// Also sends Matt an admin summary of all clients + total leads.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const dateLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const { data: clients } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, email, contact_name, phone, zip_codes")
    .eq("active", true);

  let clientsNotified = 0;
  let totalLeads = 0;

  await Promise.all((clients || []).map(async (c: any) => {
    const zips: string[] = Array.isArray(c.zip_codes) ? c.zip_codes : [];
    if (zips.length === 0) return;

    const { data: leads } = await (sb.from as any)("mortgage_radar_leads")
      .select("id, score, signal_type, zip")
      .in("zip", zips)
      .gte("created_at", weekAgo);

    const count = leads?.length || 0;
    totalLeads += count;

    if (!c.phone) return;

    const hotLeads = (leads || []).filter((l: any) => l.score >= 8).length;
    const zipList = zips.slice(0, 3).join(", ") + (zips.length > 3 ? ` +${zips.length - 3}` : "");

    const msg = count === 0
      ? `MR Weekly (${dateLabel}): No new leads in your ZIPs this week (${zipList}). Market may be quiet — dashboard has all prior leads.`
      : `MR Weekly (${dateLabel}): ${count} new lead${count === 1 ? "" : "s"} in ${zipList} — ${hotLeads} hot (8+/10). Log in: detroitwebagent.com/my-mortgage-radar`;

    try {
      await sendSMS(c.phone, TWILIO_PHONE, msg, "mortgage-radar-weekly-digest");
      clientsNotified++;
    } catch (e) {
      console.warn(`[mr-weekly-digest] SMS failed for ${c.email}:`, e instanceof Error ? e.message : String(e));
    }
  }));

  // Admin summary to Matt
  const adminMsg = `MR Weekly Digest sent (${dateLabel}): ${clientsNotified}/${(clients || []).length} LOs notified — ${totalLeads} total new leads this week`;
  await sendSMS(ADMIN_PHONE, TWILIO_PHONE, adminMsg, "mortgage-radar-weekly-digest");

  await (sb.from as any)("agent_heartbeats").upsert({
    agent_name: "mortgage-radar-weekly-digest",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { clientsNotified, totalLeads, activeClients: (clients || []).length },
  }, { onConflict: "agent_name" });

  return new Response(
    JSON.stringify({ ok: true, clientsNotified, totalLeads }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
