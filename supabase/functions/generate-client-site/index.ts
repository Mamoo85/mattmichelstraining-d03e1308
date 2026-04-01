import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  console.log(`[GENERATE-SITE] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// Template section definitions — mirrors frontend siteTemplates.ts
const TEMPLATES: Record<string, { sections: { key: string; type: string; promptHint: string }[] }> = {
  contractor: {
    sections: [
      { key: "hero", type: "hero", promptHint: "Bold headline about reliable local service. Include a strong call-to-action for a free estimate." },
      { key: "services", type: "services", promptHint: "6 core services this contractor offers. Each needs a title, short description." },
      { key: "about", type: "about", promptHint: "Trustworthy company story. Mention years in business, local roots, licensed & insured." },
      { key: "testimonials", type: "testimonials", promptHint: "3 realistic customer testimonials with first names and service type." },
      { key: "gallery", type: "gallery", promptHint: "Section intro text about showcasing completed projects." },
      { key: "faq", type: "faq", promptHint: "5 common questions homeowners ask this type of contractor." },
      { key: "cta", type: "cta", promptHint: "Urgent but friendly CTA. Free estimate or same-day service angle." },
      { key: "contact", type: "contact", promptHint: "Contact section with phone, email, service area." },
    ],
  },
  restaurant: {
    sections: [
      { key: "hero", type: "hero", promptHint: "Appetizing headline that captures the restaurant's vibe." },
      { key: "menu", type: "menu", promptHint: "6 signature dishes with name, description, and price range." },
      { key: "about", type: "about", promptHint: "Restaurant origin story. Chef background, cuisine philosophy." },
      { key: "testimonials", type: "testimonials", promptHint: "3 realistic diner reviews with specific dishes." },
      { key: "gallery", type: "gallery", promptHint: "Section intro about the dining experience." },
      { key: "cta", type: "cta", promptHint: "CTA for reservations or online ordering." },
      { key: "contact", type: "contact", promptHint: "Hours, address, phone, parking, delivery options." },
    ],
  },
  professional: {
    sections: [
      { key: "hero", type: "hero", promptHint: "Authoritative headline about expertise and results." },
      { key: "services", type: "services", promptHint: "6 service areas/specialties with value propositions." },
      { key: "about", type: "about", promptHint: "Professional credibility. Education, credentials, client-first philosophy." },
      { key: "team", type: "team", promptHint: "3 team member bios with name, title, credentials." },
      { key: "testimonials", type: "testimonials", promptHint: "3 client success stories with outcomes." },
      { key: "faq", type: "faq", promptHint: "5 questions prospective clients commonly ask." },
      { key: "cta", type: "cta", promptHint: "Professional CTA for scheduling a consultation." },
      { key: "contact", type: "contact", promptHint: "Office address, phone, email, office hours." },
    ],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth check — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();
    if (!roleData) throw new Error("Admin access required");

    const body = await req.json();
    const { template_key, business_name, industry_detail, phone, email, address, city, lead_id } = body;

    if (!template_key || !business_name) {
      throw new Error("Missing required fields: template_key, business_name");
    }

    const template = TEMPLATES[template_key];
    if (!template) throw new Error(`Unknown template: ${template_key}`);

    logStep("Generating site content", { template_key, business_name });

    // Build AI prompt
    const sectionPrompts = template.sections.map((s) =>
      `"${s.key}" (type: ${s.type}): ${s.promptHint}`
    ).join("\n");

    const prompt = `You are a professional web copywriter. Generate website content for a local business.

BUSINESS INFO:
- Business Name: ${business_name}
- Industry: ${industry_detail || template_key}
- Phone: ${phone || "not provided"}
- Email: ${email || "not provided"}
- Address/City: ${address || city || "not provided"}

Generate content for each section below. Return a JSON array where each element has:
- "key": the section key
- "type": the section type
- "content": an object with section-specific fields

Section-specific content format:
- hero: { "headline": string, "subheadline": string, "cta_text": string, "cta_subtext": string }
- services/menu: { "title": string, "items": [{ "title": string, "description": string, "price"?: string }] } (exactly 6 items)
- about: { "title": string, "paragraphs": [string, string], "highlights": [{ "label": string, "value": string }] } (3 highlights like "15+ Years", "Licensed & Insured", etc.)
- testimonials: { "title": string, "items": [{ "name": string, "text": string, "rating": 5, "detail": string }] } (exactly 3)
- gallery: { "title": string, "description": string }
- faq: { "title": string, "items": [{ "question": string, "answer": string }] } (exactly 5)
- cta: { "headline": string, "subtext": string, "button_text": string }
- contact: { "title": string, "description": string, "phone": string, "email": string, "address": string, "hours": string }
- team: { "title": string, "members": [{ "name": string, "title": string, "bio": string }] } (exactly 3)

SECTIONS TO GENERATE:
${sectionPrompts}

Return ONLY the JSON array. No markdown, no explanation. Use the actual business name throughout. Make all copy sound professional, local, and conversion-focused. Use the business phone/email/address in the contact section.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a professional web copywriter. Return only valid JSON. No markdown code fences." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error ${aiResponse.status}: ${errText}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";
    logStep("AI response received", { length: rawContent.length });

    // Clean response — strip markdown fences if present
    rawContent = rawContent.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let sections;
    try {
      sections = JSON.parse(rawContent);
    } catch (e) {
      logStep("JSON parse failed, attempting repair");
      // Try to find the array in the response
      const arrayMatch = rawContent.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        sections = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    if (!Array.isArray(sections)) {
      throw new Error("AI response is not an array");
    }

    // Generate slug
    const slug = business_name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);

    // Default color schemes per template
    const colorSchemes: Record<string, any> = {
      contractor: { primary: "#1e40af", secondary: "#1e293b", accent: "#f59e0b" },
      restaurant: { primary: "#dc2626", secondary: "#1c1917", accent: "#eab308" },
      professional: { primary: "#0f766e", secondary: "#1e293b", accent: "#6366f1" },
    };

    // Upsert generated site
    const siteData = {
      lead_id: lead_id || null,
      template_key,
      slug,
      business_name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      sections,
      color_scheme: colorSchemes[template_key] || colorSchemes.contractor,
      is_published: false,
    };

    // Check if slug exists, append number if needed
    const { data: existingSite } = await supabaseClient
      .from("generated_sites")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingSite) {
      // Update existing
      const { data: updated, error: updateErr } = await supabaseClient
        .from("generated_sites")
        .update({ ...siteData, updated_at: new Date().toISOString() })
        .eq("slug", slug)
        .select()
        .single();
      if (updateErr) throw updateErr;
      logStep("Site updated", { id: updated.id, slug });
      return new Response(JSON.stringify({ site: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const { data: created, error: createErr } = await supabaseClient
        .from("generated_sites")
        .insert(siteData)
        .select()
        .single();
      if (createErr) throw createErr;
      logStep("Site created", { id: created.id, slug });
      return new Response(JSON.stringify({ site: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
