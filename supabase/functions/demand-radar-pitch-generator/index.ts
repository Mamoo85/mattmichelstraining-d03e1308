// demand-radar-pitch-generator — DR-12
// Generates a 3-line cold email pitch for a Demand Radar signal using Gemini.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { signal_id, vendor_offering } = await req.json();
    if (!signal_id) {
      return new Response(JSON.stringify({ error: "signal_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: signal } = await sb
      .from("industry_pulse_signals")
      .select("company_name, signal_type, summary, recommended_pitch, location")
      .eq("id", signal_id)
      .single();

    if (!signal) {
      return new Response(JSON.stringify({ error: "signal not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const prompt = `Write a 3-line cold email to ${signal.company_name} in ${signal.location || "Michigan"}.

Signal: ${signal.summary}
${signal.recommended_pitch ? `Pitch angle: ${signal.recommended_pitch}` : ""}
${vendor_offering ? `What I sell: ${vendor_offering}` : ""}

Rules:
- 3 lines max. No subject line.
- Reference the specific signal naturally (no fake personalization).
- End with a soft question, not "let's hop on a call".
- No "I hope this email finds you well". No buzzwords.
- Plain text only.`;

    const draft = await generateText(prompt, 300);

    return new Response(JSON.stringify({
      pitch: draft || `Saw ${signal.company_name} ${signal.summary.toLowerCase()}. We help companies in similar moments. Worth a 5-min look?`,
      company: signal.company_name,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[demand-radar-pitch-generator]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
