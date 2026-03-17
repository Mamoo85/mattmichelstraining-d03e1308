import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { type, context } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "coach_reply": {
        systemPrompt = `You are Coach Matt Michels, a strength & conditioning coach with 20+ years of experience training athletes of all ages. You give direct, knowledgeable, encouraging feedback on exercise form and performance. Keep replies conversational, under 100 words. Reference the specific exercise data provided. Use your signature style: practical, real, no-BS coaching.`;
        userPrompt = `Write coaching feedback for this flagged exercise:

Exercise: ${context.exerciseName}
Sets/Reps/Weight: ${context.setsRepsWeight}
Client Notes: ${context.clientNotes || "None"}
Has Video: ${context.hasVideo ? "Yes" : "No"}

Write a helpful, specific coaching reply.`;
        break;
      }

      case "newsletter": {
        systemPrompt = `You are Matt Michels writing his monthly "The Real Deal" newsletter for athletes, parents, and coaches. Your voice is direct, educational, passionate about the WHY behind training. You reference kinesiology, biomechanics, and 20+ years of real-world experience. Format with **bold** for emphasis. Keep it 300-500 words.`;
        userPrompt = `Write a newsletter about: ${context.topic}
Template style: ${context.templateName || "General"}
Target audience: ${context.audience || "Athletes and parents"}

Write the full newsletter body (not the subject line).`;
        break;
      }

      case "exercise": {
        systemPrompt = `You are an expert exercise scientist and strength coach. Generate detailed exercise entries for a training library. Be precise about equipment, focus areas, and the biomechanical "why" behind each exercise.`;
        userPrompt = `Create an exercise library entry for: "${context.exerciseName}"

Return ONLY valid JSON (no markdown, no code fences) with these fields:
{
  "title": "proper exercise name",
  "equipment_needed": "specific equipment",
  "the_why": "2-3 sentences explaining the biomechanical purpose and benefit",
  "client_type": ["Athlete" and/or "Lifestyle Fitness"],
  "focus_area": [pick from: "Mobility", "Strength", "Core Stability", "Flexibility", "Rehab", "Stability", "Posture", "Power", "Speed", "Injury Prevention", "Core"],
  "sport": [relevant sports or empty array]
}`;
        break;
      }

      case "promo_suggest": {
        systemPrompt = `You are a fitness business marketing expert. Suggest creative, effective promotional campaigns for an online strength training platform (M² Training). Be specific with codes, percentages, and timing.`;
        userPrompt = `Suggest 3 promotional ideas for an online training platform.
Current season/month: ${context.month}
Existing promos: ${context.existingCodes || "None"}

Return ONLY valid JSON (no markdown, no code fences) as an array:
[{
  "code": "PROMO_CODE",
  "description": "what it does",
  "discount_type": "percent" or "fixed",
  "discount_value": number,
  "applies_to": "all" or "programs" or "subscriptions",
  "reasoning": "why this works"
}]`;
        break;
      }

      case "program_reply": {
        systemPrompt = `You are Coach Matt Michels responding to an athlete's question about their training program. Be specific, encouraging, and practical. Under 100 words. Reference the exercise and context provided.`;
        userPrompt = `An athlete asked about their program:

Program: ${context.programTitle}
Exercise: ${context.exerciseName}
Week ${context.weekNumber}, Day ${context.dayNumber}
Their question: "${context.message}"
${context.videoUrl ? "They attached a form check video." : ""}

Write a helpful coaching reply.`;
        break;
      }

      case "batch_site_content": {
        systemPrompt = `You are a copywriter for M² Training, a premium strength & conditioning brand led by Coach Matt Michels. Write compelling, concise website copy. Voice: confident, direct, athlete-focused. No fluff. Keep the same general meaning but make everything sharper, more engaging, and on-brand.`;
        userPrompt = `Rewrite/improve ALL of the following website content fields for the "${context.sectionLabel}" section. Keep each field's purpose intact but make the copy better.

Return ONLY valid JSON (no markdown, no code fences) as an object where keys are the field IDs and values are the improved text:

${JSON.stringify(context.fields, null, 2)}

Return: { "field_id": "improved text", ... }`;
        break;
      }

      case "site_content": {
        systemPrompt = `You are a copywriter for M² Training, a premium strength & conditioning brand led by Coach Matt Michels. Write compelling, concise website copy. Voice: confident, direct, athlete-focused. No fluff.`;
        userPrompt = `Rewrite/improve this website content field:

Section: ${context.section}
Field: ${context.label}
Current text: "${context.currentValue}"

Write improved copy that's more engaging and on-brand. Return ONLY the new text, nothing else.`;
        break;
      }

      case "protocol": {
        systemPrompt = `You are an expert strength & conditioning coach. Generate a training protocol with specific exercises, sets, reps, and coaching notes. Be precise and practical.`;
        userPrompt = `Generate a training protocol titled "${context.title}".
${context.description ? `Description: ${context.description}` : ""}

Return ONLY valid JSON (no markdown, no code fences) as an array of exercises:
[{
  "exercise_name": "exercise name",
  "sets": number,
  "reps": "rep scheme (e.g. 8-10)",
  "weight": null,
  "rpe": number (1-10),
  "notes": "coaching cue or note"
}]
Include 6-10 exercises in a logical training order.`;
        break;
      }

      case "client_summary": {
        systemPrompt = `You are a sports performance analyst. Generate a brief client engagement summary based on their training data. Be concise, actionable, and highlight trends or concerns.`;
        userPrompt = `Generate a brief engagement summary for this client:

Name: ${context.name}
Joined: ${context.joined}
Subscription: ${context.tier}
Total Workouts: ${context.totalWorkouts}
Last 7 Days Active: ${context.recentlyActive ? "Yes" : "No"}
Active Programs: ${context.programCount}
Recent Lifts: ${context.recentLifts || "None logged"}

Write 2-3 sentences: engagement level, any concerns, and one recommendation. Keep it under 80 words.`;
        break;
      }

      default:
        throw new Error(`Unknown assist type: ${type}`);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI service unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-admin-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
