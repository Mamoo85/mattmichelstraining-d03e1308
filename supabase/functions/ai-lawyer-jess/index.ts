import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DOCUMENT_TYPES = [
  { type: "terms_of_service", title: "Terms of Service", description: "Covers all SaaS products on mattmichelstraining.com" },
  { type: "privacy_policy", title: "Privacy Policy", description: "CCPA/GDPR compliant — covers email, phone, business data collection" },
  { type: "sms_consent", title: "SMS/TCPA Consent Disclaimer", description: "Required for all text marketing services" },
  { type: "can_spam_footer", title: "CAN-SPAM Email Footer", description: "Physical address + unsubscribe link for prospecting emails" },
  { type: "saas_agreement", title: "SaaS Subscription Agreement", description: "Auto-renewal terms, cancellation policy, 7-day trial terms" },
  { type: "ai_disclosure", title: "AI Usage Disclosure", description: "FTC-required disclosure for AI-generated customer communications" },
  { type: "affiliate_disclosure", title: "Affiliate Disclosure", description: "FTC-required disclosure for newsletter affiliate links" },
  { type: "coaching_waiver", title: "Coaching & Training Liability Waiver", description: "Injury liability waiver for M² Performance Training" },
  { type: "minor_waiver", title: "Minor Athlete Parental Consent", description: "Parental consent for under-18 athletes" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, documentType } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === "list") {
      const { data } = await sb.from("legal_documents").select("*").order("created_at", { ascending: false });
      const existing = data || [];
      const allDocs = DOCUMENT_TYPES.map(dt => {
        const found = existing.find((d: any) => d.document_type === dt.type);
        return {
          ...dt,
          exists: !!found,
          id: found?.id || null,
          version: found?.version || 0,
          status: found?.status || "missing",
          lastReviewed: found?.last_reviewed_at || null,
          nextReview: found?.next_review_at || null,
        };
      });
      return new Response(JSON.stringify({ documents: allDocs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      const docConfig = DOCUMENT_TYPES.find(d => d.type === documentType);
      if (!docConfig) {
        return new Response(JSON.stringify({ error: "Unknown document type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `You are Jess, an AI legal assistant specializing in small business compliance. You generate legally sound documents for a Michigan-based SaaS and coaching business called M² Development / M² Performance Training, owned by Matt Michels in Grosse Pointe, MI.

Business details:
- Legal entity: M² Development (DBA M² Performance Training)
- Owner: Matt Michels
- Address: Grosse Pointe, MI (use "Grosse Pointe, MI 48230" as mailing address)
- Email: matt@m2training.com | Phone: (313) 806-4952
- Website: mattmichelstraining.com
- Services: 40+ automated B2B SaaS tools (email, SMS, AI content, lead gen) + athletic coaching
- Payment: Stripe subscriptions with 7-day free trials
- SMS services: missed-call text-back, review requests, appointment reminders, holiday blasts, birthday campaigns
- AI usage: AI generates emails, blog posts, social media content, estimates, proposals for clients
- Newsletter: weekly B2B sales newsletter with affiliate product links

Generate the document in clean HTML format with proper headings, sections, and legal language. Include the current date as the effective date. Make it comprehensive but readable. Include all standard clauses for this type of document.`;

      const prompt = `Generate a complete "${docConfig.title}" document. ${docConfig.description}. Output clean HTML only, no markdown.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI error:", errText);
        throw new Error("AI generation failed");
      }

      const aiData = await aiRes.json();
      const content = aiData?.choices?.[0]?.message?.content || "";

      // Check if document already exists
      const { data: existing } = await sb.from("legal_documents")
        .select("id, version")
        .eq("document_type", documentType)
        .order("version", { ascending: false })
        .limit(1);

      const nextVersion = existing && existing.length > 0 ? (existing[0].version || 1) + 1 : 1;
      const now = new Date().toISOString();
      const sixMonthsLater = new Date(Date.now() + 180 * 86400000).toISOString();

      if (existing && existing.length > 0) {
        await sb.from("legal_documents").update({
          content,
          version: nextVersion,
          status: "draft",
          last_reviewed_at: now,
          next_review_at: sixMonthsLater,
          updated_at: now,
        }).eq("id", existing[0].id);
      } else {
        await sb.from("legal_documents").insert({
          document_type: documentType,
          title: docConfig.title,
          content,
          version: 1,
          status: "draft",
          last_reviewed_at: now,
          next_review_at: sixMonthsLater,
        });
      }

      return new Response(JSON.stringify({ success: true, content, version: nextVersion }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      await sb.from("legal_documents").update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("document_type", documentType);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_all") {
      const results: any[] = [];
      for (const doc of DOCUMENT_TYPES) {
        try {
          const innerRes = await fetch(SUPABASE_URL + "/functions/v1/ai-lawyer-jess", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ action: "generate", documentType: doc.type }),
          });
          const innerData = await innerRes.json();
          results.push({ type: doc.type, success: innerData.success || false });
        } catch (e: any) {
          results.push({ type: doc.type, success: false, error: e.message });
        }
      }
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: list, generate, approve, generate_all" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Jess error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
