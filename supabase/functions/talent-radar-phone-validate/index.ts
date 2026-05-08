// talent-radar-phone-validate
// Drains hire_alert_candidates with phone + no validation flag, runs Twilio Lookup,
// marks mobile vs landline. Mobile-validated phones get score+1 and clear is_dnc_risk.
//
// POST { limit?: number, dry_run?: boolean }
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function lookup(phone: string): Promise<{ line_type: string | null; carrier: string | null; valid: boolean }> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return { line_type: null, carrier: null, valid: false };
  const e164 = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "").slice(-10)}`;
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`;
  try {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!r.ok) return { line_type: null, carrier: null, valid: false };
    const j = await r.json();
    return {
      line_type: j?.line_type_intelligence?.type || null,
      carrier: j?.line_type_intelligence?.carrier_name || null,
      valid: !!j?.valid,
    };
  } catch { return { line_type: null, carrier: null, valid: false }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const dryRun = !!body?.dry_run;
  const limit = Math.min(Number(body?.limit) || 50, 200);

  // Pull candidates with phone but no phone_line_type in raw_data
  const { data: rows } = await sb.from("hire_alert_candidates")
    .select("id, phone, score, raw_data")
    .not("phone", "is", null)
    .limit(limit);

  let validated = 0, mobile = 0, landline = 0, errors = 0;
  for (const row of rows || []) {
    const existing = (row.raw_data as any)?.phone_line_type;
    if (existing) continue;
    const result = await lookup(row.phone!);
    if (!result.valid) { errors++; continue; }
    validated++;
    if (result.line_type === "mobile") mobile++;
    else if (result.line_type === "landline") landline++;

    if (dryRun) continue;

    const newRaw = { ...(row.raw_data as any || {}), phone_line_type: result.line_type, phone_carrier: result.carrier };
    const newScore = result.line_type === "mobile" ? Math.min((row.score || 0) + 1, 10) : row.score;
    await sb.from("hire_alert_candidates").update({
      raw_data: newRaw,
      score: newScore,
    }).eq("id", row.id);
  }

  return new Response(JSON.stringify({
    ok: true, dry_run: dryRun, total_checked: rows?.length || 0, validated, mobile, landline, errors,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
