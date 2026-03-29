import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, business, description, phone, email } = await req.json();

    const systemPrompt = `You are Matt Michels, owner of a local web design business in Grosse Pointe, MI. You build high-converting websites for Detroit-area contractors and local businesses. Your tone is direct, professional, and locally personal — like a real business owner who knows the Metro Detroit market inside and out.

Your pricing is simple:
- $499 flat build fee (site is live in 7 days or less)
- $49/month for hosting, updates, and ongoing support (month-to-month, no contracts)
- $99/month optional Google Ads management add-on

What's included in the build: professional copywriting, mobile-first design, custom quote/contact forms, Google Business Profile optimization, Google Maps integration, click-to-call/text buttons, SSL + hosting, domain connection, SEO meta tags, 1 revision round, and 7-day delivery.

You're different because you're a local business owner yourself — you know what it takes to get local clients. You give every client your direct cell. No agencies, no outsourcing.`;

    const userPrompt = `Write a personalized web design proposal for this lead:

Name: ${name}
Business: ${business || "Not provided"}
Phone: ${phone}
Email: ${email}
What they do: ${description || "No description provided"}

Write a professional proposal that includes:
1. A warm, specific opening that shows you understand their business (1-2 sentences)
2. What their site will include (reference specific features relevant to their industry)
3. The exact investment ($499 flat + $49/month — no surprises)
4. What they get on day 1 (your personal cell number, discovery call, clear 7-day timeline)
5. A confident closing with a specific call to action ("Text me at (313) 806-4952 or reply to this email")

Keep it under 350 words. No bullet-point walls — write in short paragraphs. Sound like a real person, not a template. Make it feel like it was written specifically for their industry.`;

    const response = await fetch("https://api.lovable.ai/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} — ${errorText}`);
    }

    const aiData = await response.json();
    const proposal = aiData.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({ proposal }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-web-proposal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
