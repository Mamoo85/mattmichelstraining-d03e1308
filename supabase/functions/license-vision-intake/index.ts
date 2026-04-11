// license-vision-intake
// Twilio inbound MMS webhook — client texts a photo of their license card.
// Passes image to Claude Vision, extracts license_name/number/issuing_body/expiry_date.
// Inserts into license_monitor_items, replies with TwiML confirmation SMS.
// verify_jwt = false (public webhook endpoint)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

serve(async (req) => {
  // Twilio sends form-encoded POST
  const contentType = req.headers.get("content-type") || "";
  let form: FormData;

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      form = new FormData();
      for (const [k, v] of params.entries()) form.append(k, v);
    } else {
      form = await req.formData();
    }
  } catch {
    return twiml("Sorry, couldn't process that. Please try again.");
  }

  const fromPhone = form.get("From")?.toString() || "";
  const numMedia = parseInt(form.get("NumMedia")?.toString() || "0", 10);
  const mediaUrl = form.get("MediaUrl0")?.toString() || "";

  if (!fromPhone) {
    return twiml("Error: no sender phone.");
  }

  if (numMedia === 0 || !mediaUrl) {
    return twiml("Please reply with a photo of your license card and we'll track it automatically.");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Look up client by phone number
  const { data: client } = await sb
    .from("license_monitor_clients")
    .select("id, business_name, owner_name")
    .or(`phone.eq.${fromPhone},owner_phone.eq.${fromPhone}`)
    .single();

  if (!client) {
    return twiml("Hi! We couldn't find an account for this number. Visit detroitwebagency.com/license-monitor to sign up, or text Matt at (313) 806-4952.");
  }

  // Pass image to Claude Vision
  let licenseData: {
    license_name?: string;
    license_number?: string;
    issuing_body?: string;
    expiry_date?: string;
    license_type?: string;
  } = {};

  try {
    const visionRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: mediaUrl },
            },
            {
              type: "text",
              text: `Extract from this license card and return ONLY a JSON object with these fields:
- license_name: full name on the license
- license_number: the license or certificate number
- issuing_body: the issuing authority (e.g. "Michigan LARA", "State of Michigan", etc.)
- expiry_date: expiration date in YYYY-MM-DD format (convert from whatever format shown)
- license_type: type of license (e.g. "Boiler Operator 1st Class", "Master Plumber", "HVAC Contractor", etc.)

If a field is not visible, omit it. Return only valid JSON, no explanation.`,
            },
          ],
        }],
      }),
    });

    const visionJson = await visionRes.json();
    const rawText = visionJson?.content?.[0]?.text || "{}";
    const cleaned = rawText.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    licenseData = JSON.parse(cleaned);
  } catch (e) {
    console.error("[license-vision-intake] Vision extraction failed:", e);
    return twiml("We received your photo but had trouble reading it. Please send a clearer image of the license card, or text Matt at (313) 806-4952.");
  }

  if (!licenseData.license_name && !licenseData.license_number) {
    return twiml("We couldn't extract license info from that photo. Please try a clearer image with the license number visible.");
  }

  // Insert into license_monitor_items
  const { error: insertError } = await sb.from("license_monitor_items").insert({
    client_id: client.id,
    license_name: licenseData.license_name || "",
    license_number: licenseData.license_number || null,
    issuing_body: licenseData.issuing_body || "State of Michigan",
    license_type: licenseData.license_type || null,
    expiry_date: licenseData.expiry_date || null,
    intake_method: "vision_mms",
    source_image_url: mediaUrl,
    active: true,
  });

  if (insertError) {
    console.error("[license-vision-intake] Insert error:", insertError);
    return twiml("Got your photo! There was an error saving it. Text Matt at (313) 806-4952 and we'll fix it.");
  }

  const expiryStr = licenseData.expiry_date
    ? new Date(licenseData.expiry_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "expiry not found";

  const licenseLabel = licenseData.license_type || "license";

  console.log(`[license-vision-intake] Tracked ${licenseLabel} for client ${client.id} (${fromPhone}), expiry: ${licenseData.expiry_date}`);

  return twiml(`Got it! Tracking your ${licenseLabel} expiring ${expiryStr}. We'll remind you at 90, 60, 30, 14, and 7 days before expiry. Text us any other license cards to track them too.`);
});

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
