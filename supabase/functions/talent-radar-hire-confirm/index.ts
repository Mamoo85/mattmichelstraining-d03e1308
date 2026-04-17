// TR-19: Hire confirmation 14d SMS check
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER")!;

async function sendSMS(to: string, body: string) {
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Find candidate views from 14 days ago that haven't been confirmed
    const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
    const cutoff2 = new Date(Date.now() - 15 * 86400_000).toISOString();

    const { data: views } = await supabase
      .from("hire_alert_client_candidates" as any)
      .select("id, client_id, candidate_id, viewed_at")
      .eq("client_action", "viewed")
      .gte("viewed_at", cutoff2)
      .lte("viewed_at", cutoff)
      .limit(50);

    let prompted = 0;
    for (const v of (views as any[]) || []) {
      const { data: client } = await supabase.from("hire_alert_clients" as any).select("phone, business_name, email").eq("id", v.client_id).maybeSingle();
      const { data: cand } = await supabase.from("hire_alert_candidates" as any).select("name").eq("id", v.candidate_id).maybeSingle();
      if (!client?.phone || !cand?.name) continue;

      await sendSMS(client.phone, `Quick check from Detroit Web Agency: did you end up hiring ${cand.name}? Reply YES or NO. Helps us track your ROI savings.`);
      await supabase.from("radar_hire_confirmations" as any).insert({
        client_id: v.client_id,
        candidate_id: v.candidate_id,
        candidate_name: cand.name,
      });
      prompted++;
    }

    return new Response(JSON.stringify({ ok: true, prompted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
