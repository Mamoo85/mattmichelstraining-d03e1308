// test-license-vision — admin-only OCR test endpoint
// Accepts base64 image, runs Claude Vision extraction, returns parsed JSON.
// No DB writes, no Twilio — pure test. Called from AdminSimulationSuite.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { image_base64, mime_type } = await req.json();

    if (!image_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: "image_base64 and mime_type required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mime_type, data: image_base64 },
            },
            {
              type: "text",
              text: `Extract license information from this image. Return ONLY a JSON object with these exact keys (use null if not found):
{
  "license_type": "string — e.g. Boiler Operator, HVAC, Electrical",
  "license_number": "string — the license or certificate number",
  "holder_name": "string — full name on the license",
  "expiry_date": "string — expiration date in YYYY-MM-DD format if possible",
  "issuing_state": "string — state abbreviation e.g. MI",
  "issuing_authority": "string — the issuing agency or department"
}
Return ONLY the JSON, no other text.`,
            },
          ],
        }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || "Claude API error", raw: data }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const rawText = data.content?.[0]?.text || "";
    let parsed: Record<string, unknown> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { parse_error: "Could not parse JSON from response" };
    }

    return new Response(JSON.stringify({ ok: true, extracted: parsed, raw_text: rawText }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
