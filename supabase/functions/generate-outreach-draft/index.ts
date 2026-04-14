// generate-outreach-draft — POST endpoint
// Uses Lovable AI Gateway (Gemini flash) to generate cold outreach text + email.
// Token-secured via hire_alert_clients.dashboard_token.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { token, candidate_id } = await req.json();

    if (!token || !candidate_id) {
      return new Response(JSON.stringify({ error: "token and candidate_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate token
    const { data: client } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, active, owner_name")
      .eq("dashboard_token", token)
      .single();

    if (!client || !client.active) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get candidate data
    const { data: candidate } = await sb
      .from("hire_alert_candidates")
      .select("full_name, phone, email, license_type, city, current_employer, current_title, qualifications_summary")
      .eq("id", candidate_id)
      .single();

    if (!candidate) {
      return new Response(JSON.stringify({ error: "candidate not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const senderName = client.owner_name || "the hiring manager";
    const companyName = client.company_name || "our company";
    const candidateName = candidate.full_name || "there";
    const role = candidate.license_type || candidate.current_title || "the open position";
    const city = candidate.city || "your area";

    const prompt = `You are a recruiting copywriter for blue-collar trades (HVAC, plumbing, boiler, electrical, healthcare).

Generate TWO outreach messages from ${senderName} at ${companyName} to ${candidateName}, a ${role} in ${city}.

${candidate.current_employer ? `They currently work at ${candidate.current_employer}.` : ""}
${candidate.qualifications_summary ? `Background: ${candidate.qualifications_summary}` : ""}

MESSAGE 1 — TEXT MESSAGE (3 sentences max, casual/direct, no emojis):
- Open with their name
- Mention the specific role
- End with a soft ask ("would you be open to a quick chat?")

MESSAGE 2 — EMAIL (5 sentences max, professional but warm):
- Subject line included
- Reference their specific trade/license
- Mention what makes ${companyName} attractive (competitive pay, good team, growth)
- Clear call to action

Return ONLY valid JSON:
{
  "text_message": "...",
  "email_subject": "...",
  "email_body": "..."
}`;

    let textMessage = `Hey ${candidateName}, this is ${senderName} from ${companyName}. We're looking for a licensed ${role} and your background caught our attention. Would you be open to a quick chat about what we offer?`;
    let emailSubject = `${role} opportunity at ${companyName}`;
    let emailBody = `Hi ${candidateName},\n\nI'm ${senderName} from ${companyName} in ${city}. We're growing our team and looking for experienced ${role} professionals.\n\nWe offer competitive pay, a solid team, and room to grow. I'd love to tell you more about what we have available.\n\nWould you have a few minutes for a quick call this week? Feel free to reach me anytime.\n\nBest,\n${senderName}`;

    if (LOVABLE_API_KEY) {
      try {
        const aiRes = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData?.choices?.[0]?.message?.content || "";
          // Strip markdown wrappers
          const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (parsed.text_message) textMessage = parsed.text_message;
            if (parsed.email_subject) emailSubject = parsed.email_subject;
            if (parsed.email_body) emailBody = parsed.email_body;
          } catch { /* use fallback */ }
        }
      } catch { /* use fallback */ }
    }

    return new Response(JSON.stringify({
      text_message: textMessage,
      email_subject: emailSubject,
      email_body: emailBody,
      tcpa_notice: "Copy-paste and send from your phone. Do not text numbers on your internal do-not-contact list.",
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-outreach-draft]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
