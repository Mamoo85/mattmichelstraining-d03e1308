import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { topic } = await req.json();
    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current monthly focus
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthName = now.toLocaleString("en-US", { month: "long" });

    const { data: focus } = await serviceClient
      .from("monthly_focus")
      .select("title, topic, matt_quote, exercises")
      .eq("month", currentMonth)
      .eq("year", currentYear)
      .eq("status", "published")
      .limit(1)
      .maybeSingle();

    // Fetch current monthly challenge
    const { data: challenge } = await serviceClient
      .from("monthly_challenges")
      .select("title, description, metric_label")
      .eq("month", currentMonth)
      .eq("year", currentYear)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const systemPrompt = `You are Matt Michels — a strength & conditioning coach with 20+ years experience and zero injuries ever. You run M² Training in Grosse Pointe, MI.

Write a SHORT, punchy monthly newsletter email (plain text with **bold** for emphasis). Rules:
- MAX 250 words total. No fluff. Every sentence earns its spot.
- Speak like a coach talking to athletes and parents — direct, confident, real.
- Use short paragraphs (1-3 sentences max).
- Structure: greeting → monthly focus recap → challenge shoutout → topic deep-dive → sign-off.
- Sign off as "Matt Michels" with "M² Training" underneath.
- No emojis. No corporate tone. No "hope you're doing well" filler.
- Write like someone who's been in the trenches, not behind a desk.`;

    let userPrompt = `Write the ${monthName} ${currentYear} newsletter.\n\n`;

    if (focus) {
      userPrompt += `MONTHLY FOCUS: "${focus.title}" — Topic: ${focus.topic}. Matt's quote: "${focus.matt_quote}". Key exercises: ${focus.exercises?.join(", ") || "general training"}.\n\n`;
    } else {
      userPrompt += `No monthly focus is set this month — skip that section.\n\n`;
    }

    if (challenge) {
      userPrompt += `MONTHLY CHALLENGE: "${challenge.title}" — ${challenge.description}. Metric: ${challenge.metric_label}.\n\n`;
    } else {
      userPrompt += `No monthly challenge is active — skip that section.\n\n`;
    }

    userPrompt += `MATT'S TOPIC THIS MONTH: ${topic}\n\nExpand on this topic with real coaching insight. Give one actionable takeaway.`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit — try again in a minute." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed. Top up in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const generatedBody = aiData.choices?.[0]?.message?.content || "";
    const generatedSubject = `The Real Deal — ${monthName} ${currentYear}`;

    return new Response(
      JSON.stringify({
        subject: generatedSubject,
        body: generatedBody,
        focus_title: focus?.title || null,
        challenge_title: challenge?.title || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("generate-newsletter error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
