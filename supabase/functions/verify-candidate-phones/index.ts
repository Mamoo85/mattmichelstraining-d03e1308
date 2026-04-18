// One-shot admin function: runs Twilio Lookup on all candidates with a phone
// that haven't been verified yet. Updates phone_type + phone_verified_at.
// Cost: ~$0.005/lookup. Call via POST from /dwa-admin (admin only).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function lookupPhone(phone: string): Promise<string> {
  const e164 = phone.replace(/\D/g, "");
  const normalized = e164.startsWith("1") && e164.length === 11
    ? `+${e164}`
    : e164.length === 10
    ? `+1${e164}`
    : `+${e164}`;

  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(normalized)}?Fields=line_type_intelligence`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return "unknown";
    const data = await res.json();
    const lineType: string = data?.line_type_intelligence?.type ?? "unknown";
    // Twilio returns: 'mobile', 'landline', 'voip', 'nonFixedVoip', 'tollFree', etc.
    if (lineType === "mobile") return "mobile";
    if (lineType === "landline") return "landline";
    if (lineType.toLowerCase().includes("voip")) return "voip";
    return "unknown";
  } catch {
    return "unknown";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch unverified candidates with a phone number
  const { data: candidates, error } = await sb
    .from("hire_alert_candidates")
    .select("id, phone")
    .not("phone", "is", null)
    .is("phone_verified_at", null)
    .neq("is_company_name", true)
    .order("score", { ascending: false })
    .limit(100); // safety cap

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ ok: true, verified: 0, message: "All phones already verified" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Run lookups with 200ms gap to stay well under Twilio rate limits
  const results: { id: string; phone: string; phone_type: string }[] = [];
  for (const c of candidates) {
    const phone_type = await lookupPhone(c.phone);
    results.push({ id: c.id, phone: c.phone, phone_type });

    await sb.from("hire_alert_candidates").update({
      phone_type,
      phone_verified_at: new Date().toISOString(),
    }).eq("id", c.id);

    await new Promise((r) => setTimeout(r, 200));
  }

  const summary = results.reduce((acc, r) => {
    acc[r.phone_type] = (acc[r.phone_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return new Response(JSON.stringify({
    ok: true,
    verified: results.length,
    summary,
    results,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
