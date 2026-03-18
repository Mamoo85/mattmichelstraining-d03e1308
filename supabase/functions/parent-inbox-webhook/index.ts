import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const URGENT_KEYWORDS = [
  "hurt", "hurts", "hurting", "pain", "painful",
  "injury", "injured", "tweak", "tweaked",
  "cancel", "cancellation", "unsubscribe", "quit",
  "doctor", "physician", "physical therapy", "PT",
  "billing", "charge", "refund", "overcharged",
  "surgery", "MRI", "x-ray", "xray",
  "torn", "sprain", "strain", "fracture", "broken",
  "concussion", "dizzy", "swelling", "swollen",
  "emergency", "urgent", "serious", "worried",
  "unhappy", "disappointed", "frustrated", "complaint",
];

function detectUrgency(text: string): { isUrgent: boolean; reasons: string[] } {
  const lower = text.toLowerCase();
  const found = URGENT_KEYWORDS.filter((kw) => lower.includes(kw));
  return { isUrgent: found.length > 0, reasons: found };
}

function detectSentiment(text: string): string {
  const lower = text.toLowerCase();
  const positiveWords = [
    "thank", "thanks", "great", "amazing", "awesome", "love", "excellent",
    "fantastic", "wonderful", "appreciate", "happy", "proud", "progress",
    "improved", "stronger", "better", "excited", "grateful",
  ];
  const negativeWords = [
    "bad", "terrible", "awful", "hate", "worst", "horrible", "disappointed",
    "frustrated", "angry", "upset", "concerned", "worried", "scared",
  ];

  const posCount = positiveWords.filter((w) => lower.includes(w)).length;
  const negCount = negativeWords.filter((w) => lower.includes(w)).length;

  if (negCount > posCount) return "negative";
  if (posCount > negCount) return "positive";
  return "neutral";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let fromEmail = "";
    let fromName = "";
    let subject = "";
    let body = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // JSON payload (Resend inbound or manual trigger)
      const json = await req.json();
      fromEmail = json.from || json.sender || json.email || "";
      fromName = json.from_name || json.sender_name || json.name || "";
      subject = json.subject || "";
      body = json.text || json.body || json.html || "";
    } else if (contentType.includes("multipart/form-data")) {
      // Form data (SendGrid inbound parse)
      const formData = await req.formData();
      fromEmail = (formData.get("from") as string) || "";
      fromName = (formData.get("from_name") as string) || "";
      subject = (formData.get("subject") as string) || "";
      body = (formData.get("text") as string) || (formData.get("html") as string) || "";
    } else {
      // Fallback: try JSON
      const json = await req.json();
      fromEmail = json.from || json.email || "";
      fromName = json.from_name || json.name || "";
      subject = json.subject || "";
      body = json.text || json.body || "";
    }

    if (!body && !subject) {
      return new Response(JSON.stringify({ error: "No message content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullText = `${subject} ${body}`;

    // Keyword-based urgency detection
    const { isUrgent, reasons } = detectUrgency(fullText);
    const sentiment = detectSentiment(fullText);

    // AI-enhanced sentiment analysis via Lovable AI
    let aiSentiment = sentiment;
    let aiUrgent = isUrgent;
    let aiUrgentReason = reasons.join(", ");

    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const aiResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a triage assistant for a youth athletic training business. Analyze parent emails and respond with ONLY a JSON object (no markdown, no code fences):
{"sentiment":"positive|negative|neutral","is_urgent":true|false,"urgent_reason":"brief reason or empty string"}

Flag as urgent if the message mentions: injury, pain, medical concerns, billing disputes, cancellation requests, safety issues, or emotional distress about the child. Positive feedback and general questions are NOT urgent.`,
                },
                {
                  role: "user",
                  content: `Subject: ${subject}\n\nBody: ${body}`,
                },
              ],
            }),
          }
        );

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content?.trim();
          if (content) {
            try {
              const parsed = JSON.parse(content);
              aiSentiment = parsed.sentiment || sentiment;
              aiUrgent = parsed.is_urgent ?? isUrgent;
              aiUrgentReason = parsed.urgent_reason || aiUrgentReason;
            } catch {
              // AI returned non-JSON; fall back to keyword analysis
              console.log("AI returned non-JSON, using keyword fallback");
            }
          }
        }
      }
    } catch (aiError) {
      console.error("AI analysis failed, using keyword fallback:", aiError);
    }

    // Try to match parent email to a child account
    let childUserId: string | null = null;
    const emailClean = fromEmail.replace(/.*</, "").replace(/>.*/, "").trim().toLowerCase();

    const { data: parentProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", emailClean)
      .limit(1);

    if (parentProfile && parentProfile.length > 0) {
      const { data: childLink } = await supabase
        .from("parent_child_links")
        .select("child_user_id")
        .eq("parent_user_id", parentProfile[0].user_id)
        .limit(1);
      if (childLink && childLink.length > 0) {
        childUserId = childLink[0].child_user_id;
      }
    }

    const { error: insertError } = await supabase.from("parent_inbox").insert({
      parent_email: emailClean,
      parent_name: fromName || null,
      child_user_id: childUserId,
      subject,
      body,
      sentiment: aiSentiment,
      is_urgent: aiUrgent,
      urgent_reason: aiUrgentReason || null,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If urgent, also create a notification for the admin
    if (aiUrgent) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins) {
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            type: "parent_urgent",
            title: "🚨 Urgent Parent Message",
            body: `${fromName || emailClean}: ${subject || body.slice(0, 80)}`,
            link: "/admin",
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sentiment: aiSentiment, is_urgent: aiUrgent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Parent inbox webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
