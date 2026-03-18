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

      case "schedule_suggest": {
        systemPrompt = `You are a scheduling strategist for Coach Matt Michels' in-person training studio. Analyze booking patterns and suggest optimal time slots to open for maximum bookings. Be concise, specific, and data-driven. Under 150 words.`;
        userPrompt = `Analyze this day's schedule and suggest which time slots to open:

Date: ${context.date} (${context.dayOfWeek})
Total bookings today: ${context.totalBookings}
Booked times: ${context.bookedTimes}
Currently available (open but unbooked): ${context.currentAvailable}
Total possible slots: ${context.totalSlots}

Based on typical training studio patterns (early morning 5-7am for pre-work athletes, after school 3-5pm for youth, evening 5-7pm for adults), suggest:
1. Which additional time slots to open
2. Which open but unbooked slots to consider closing
3. Any pattern observations

Be specific with times and reasoning.`;
        break;
      }

      case "form_check": {
        systemPrompt = `You are Coach Matt Michels reviewing an athlete's exercise form. Based on the exercise and any notes/context provided, write detailed form coaching feedback. Be specific about common mistakes, cues to fix them, and what to look for. Reference biomechanics and the WHY behind each cue. Be encouraging but direct. Under 200 words.`;
        userPrompt = `Write form check feedback for this athlete:

Exercise: ${context.exerciseName}
Athlete: ${context.athleteName || "Unknown"}
Sets/Reps Prescribed: ${context.setsReps || "Not specified"}
Client Notes: ${context.clientNotes || "None"}
Has Video: ${context.hasVideo ? "Yes — reference that you reviewed their video" : "No video submitted"}
Tier: ${context.tier || "Unknown"}

Write detailed coaching feedback covering:
1. Key form cues for this specific exercise
2. Common mistakes to watch for
3. A specific correction based on their notes (if any)
4. Encouragement and what to focus on next session

Sound like Matt — direct, knowledgeable, no-BS coaching.`;
        break;
      }

      case "parent_report": {
        systemPrompt = `You are Coach Matt Michels writing a progress report for a parent about their child's training. Be professional, encouraging, and specific about what the athlete is doing well and where they can improve. Parents want to know their money is well spent and their kid is making progress. Include specific data points when available. Keep it under 250 words.`;
        userPrompt = `Write a progress report for this athlete's parent:

Athlete Name: ${context.athleteName}
Subscription: ${context.tier}
Member Since: ${context.joinDate}
Total Workouts Logged: ${context.totalWorkouts}
Recent Activity (last 14 days): ${context.recentWorkouts} workouts
Active Programs: ${context.activePrograms || "None"}
Avg Sleep: ${context.avgSleep || "Not tracked"}
Avg Energy: ${context.avgEnergy || "Not tracked"}
Avg Soreness: ${context.avgSoreness || "Not tracked"}
Recent Lifts: ${context.recentLifts || "No lifts logged"}
Flagged Exercises: ${context.flaggedCount || 0}
${context.coachNotes ? `Coach's Recent Notes: ${context.coachNotes}` : ""}

Write a parent-friendly progress report covering:
1. What their athlete has been doing (be specific)
2. Strengths and improvements observed
3. Areas to focus on
4. Encouragement and next steps
5. Any concerns (if soreness is high, workouts are low, etc.)

Address the parent directly. Sign off as Coach Matt.`;
        break;
      }

      case "ai_copilot": {
        systemPrompt = `You are an AI performance analyst for M² Training, Coach Matt Michels' strength & conditioning business. Analyze athlete data to flag actionable insights. Be concise, specific, and data-driven. Use a professional but direct tone. Format output as JSON.`;
        userPrompt = `Analyze this athlete roster data and generate actionable coaching insights.

ATHLETE DATA:
${JSON.stringify(context.athletes, null, 2)}

TRIAL USERS:
${JSON.stringify(context.trialUsers, null, 2)}

Today's date: ${context.today}

Generate insights in these categories:
1. "stagnation" — athletes who haven't increased weight on core lifts (Squat, Bench, Deadlift, or similar compound movements) in 3+ weeks. Include their name, the exercise, and a suggested coach message.
2. "ghost_trials" — trial users who signed up 4+ days ago but have zero workout logs. Include their name, email, days since signup, and a draft check-in message.

Return ONLY valid JSON (no markdown, no code fences):
{
  "stagnation": [{ "name": "...", "exercise": "...", "lastWeight": number, "weeksSince": number, "suggestedMessage": "..." }],
  "ghost_trials": [{ "name": "...", "email": "...", "daysSinceSignup": number, "draftMessage": "..." }]
}`;
        break;
      }

      case "blog_draft": {
        systemPrompt = `You are Coach Matt Michels — the "Anti-Influencer" strength coach. You've trained athletes for 20+ years. Your writing style is:
- Direct, no-BS, conversational
- Backed by real experience, not internet trends
- You call out bad fitness advice openly
- You explain the WHY behind everything (biomechanics, kinesiology)
- You care deeply about youth athletes and parent education
- No clickbait, no hype — just real talk

Write SEO-optimized blog posts that sound like Matt talking to a parent or athlete over coffee. Use short paragraphs, bold key points, and end with a clear takeaway.`;
        userPrompt = `Matt typed this raw thought: "${context.rawIdea}"

Turn this into a professional, ~300-word SEO-optimized blog post in Matt's "Anti-Influencer" voice.

Requirements:
- Catchy, SEO-friendly title (include relevant keywords)
- Opening hook that grabs parents or athletes
- 3-4 short paragraphs with **bold** key phrases
- Practical takeaway at the end
- Tone: confident, educational, no fluff

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "...",
  "body": "... (markdown formatted)",
  "category": "one of: general, injury-prevention, youth-development, training-fundamentals, recovery, nutrition, parent-guide",
  "slug": "url-friendly-slug"
}`;
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
