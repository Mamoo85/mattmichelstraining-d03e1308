// landlord-letter-generator — HTTP POST
// Generates state-appropriate landlord letters for various situation types.
// Stores in landlord_cases, emails formatted letter to landlord.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Notice period requirements by state and situation type (simplified)
const STATE_NOTICE_PERIODS: Record<string, Record<string, string>> = {
  MI: {
    late_rent: "7 days written notice to pay or quit",
    lease_violation: "30 days written notice to cure or quit",
    eviction_warning: "30 days notice (month-to-month) or per lease term",
    non_renewal: "30 days written notice before lease end",
    property_damage: "7 days notice to repair or vacate",
    default: "30 days written notice",
  },
  OH: {
    late_rent: "3 days written notice to pay or vacate",
    lease_violation: "30 days written notice to cure or quit",
    eviction_warning: "30 days notice (month-to-month)",
    non_renewal: "30 days written notice before lease end",
    property_damage: "30 days notice to repair or vacate",
    default: "30 days written notice",
  },
  IL: {
    late_rent: "5 days written notice to pay or quit",
    lease_violation: "10 days written notice to cure or quit",
    eviction_warning: "30 days notice (month-to-month)",
    non_renewal: "30 days written notice before lease end",
    property_damage: "10 days notice to repair or vacate",
    default: "30 days written notice",
  },
};

function getNoticePeriod(state: string, situationType: string): string {
  const stateRules = STATE_NOTICE_PERIODS[state?.toUpperCase()] ||
    STATE_NOTICE_PERIODS["MI"];
  return stateRules[situationType] || stateRules["default"];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { clientId, tenantName, propertyAddress, situationType, situationDetails } = body;

    if (!clientId || !tenantName || !propertyAddress || !situationType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: clientId, tenantName, propertyAddress, situationType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client record
    const { data: client, error: clientErr } = await sb
      .from("landlord_letter_clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const state = client.state || "MI";
    const noticePeriod = getNoticePeriod(state, situationType);
    const today = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const situationTypeLabels: Record<string, string> = {
      late_rent: "Late Rent / Failure to Pay",
      lease_violation: "Lease Violation",
      eviction_warning: "Eviction Warning / Notice to Quit",
      non_renewal: "Notice of Non-Renewal",
      property_damage: "Property Damage Notice",
      unauthorized_occupant: "Unauthorized Occupant Notice",
      noise_complaint: "Noise / Nuisance Violation",
      pet_violation: "Unauthorized Pet Notice",
      general: "General Notice",
    };

    const prompt = `You are an expert landlord-tenant attorney specializing in ${state} landlord-tenant law. Generate a professional, legally appropriate landlord letter.

DATE: ${today}
STATE: ${state}
SITUATION TYPE: ${situationTypeLabels[situationType] || situationType}
REQUIRED NOTICE PERIOD: ${noticePeriod}

LANDLORD INFORMATION:
Name: ${client.name || client.landlord_name || "Property Owner"}
Address: ${client.address || "[Landlord Address]"}
Phone: ${client.phone || "[Phone]"}
Email: ${client.email}

TENANT INFORMATION:
Tenant Name: ${tenantName}
Property Address: ${propertyAddress}

SITUATION DETAILS:
${situationDetails || "No additional details provided."}

Write a complete, properly formatted landlord letter that:
1. Opens with proper date, addresses, and salutation
2. Clearly states the issue and what is required of the tenant
3. References ${state} landlord-tenant law where appropriate (cite specific statutes if known)
4. States the exact notice period: ${noticePeriod}
5. Lists clear consequences if the issue is not resolved
6. Explains next steps (what tenant must do, by when)
7. Is professional, firm, and legally defensible
8. Closes with landlord name, signature line, and contact info
9. Includes a "Certificate of Service" section at the bottom

FORMAT AS JSON:
{
  "letterText": "Full plain text of the letter (use \\n for line breaks)",
  "letterHtml": "Full HTML version of the letter, formatted for printing (include CSS for print layout)",
  "deadline": "The response deadline date (e.g. 'May 15, 2026')",
  "keySummary": "One sentence summary of what the tenant must do"
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiJson = await aiRes.json();
    const rawText = aiJson.content?.[0]?.text || "{}";

    let parsed: {
      letterText?: string;
      letterHtml?: string;
      deadline?: string;
      keySummary?: string;
    } = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = { letterText: rawText };
    }

    const letterText = parsed.letterText || rawText;
    const letterHtml = parsed.letterHtml || `<pre style="font-family:Georgia,serif;white-space:pre-wrap;">${letterText}</pre>`;

    // Store in landlord_cases
    const { data: caseRecord, error: caseErr } = await sb
      .from("landlord_cases")
      .insert({
        client_id: clientId,
        tenant_name: tenantName,
        property_address: propertyAddress,
        situation_type: situationType,
        situation_details: situationDetails,
        letter_text: letterText,
        state,
        notice_period: noticePeriod,
        deadline: parsed.deadline,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (caseErr) {
      console.error("Case insert error:", caseErr);
    }

    const caseId = caseRecord?.id;

    // Increment letters_generated
    await sb.rpc("increment_letters_generated", { client_id: clientId }).catch(() => {
      // RPC may not exist; update directly
      return sb
        .from("landlord_letter_clients")
        .update({
          letters_generated: (client.letters_generated || 0) + 1,
        })
        .eq("id", clientId);
    });

    // Email the letter to landlord
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:750px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;}
  .letter-box{border:1px solid #e2e8f0;border-radius:8px;padding:32px;background:#fff;margin:24px 0;}
  .summary-box{background:#f8fafc;border-left:4px solid #e8621a;padding:16px;margin-bottom:24px;border-radius:0 8px 8px 0;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
  @media print{.no-print{display:none;}}
</style></head>
<body>
<h1 class="no-print">Your Landlord Letter is Ready</h1>
<div class="summary-box no-print">
  <strong>Situation:</strong> ${situationTypeLabels[situationType] || situationType}<br>
  <strong>Tenant:</strong> ${tenantName}<br>
  <strong>Property:</strong> ${propertyAddress}<br>
  <strong>Required Action:</strong> ${parsed.keySummary || "See letter below."}<br>
  <strong>Notice Period:</strong> ${noticePeriod}
</div>
<p class="no-print" style="color:#64748b;font-size:14px;">Print this letter, sign it, and deliver it to the tenant. Keep a copy for your records. Consider sending via certified mail for legal proof of delivery.</p>
<div class="letter-box">
  ${letterHtml}
</div>
<div class="footer no-print">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M² Performance Training | matt@mattmichelstraining.com | (313) 806-4952</span>
</div>
</body>
</html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [client.email],
        subject: `Your ${situationTypeLabels[situationType] || "Landlord"} Letter — ${tenantName} at ${propertyAddress}`,
        html: emailHtml,
      }),
    });

    return new Response(
      JSON.stringify({ success: true, caseId, letterText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("landlord-letter-generator error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
