import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Verify the caller is an admin
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

    const { type, context } = await req.json();

    // ── RAG: Fetch service catalog as source of truth ──
    const { data: catalog } = await supabaseClient
      .from("service_catalog")
      .select("item_name, exact_price, description, category")
      .eq("is_active", true);

    const catalogContext = catalog && catalog.length > 0
      ? `\n\nAVAILABLE INVENTORY CONTEXT (Source of Truth):\n${JSON.stringify(catalog)}\n\nRULE 1: You may ONLY reference the exact item_name provided in the context. RULE 2: You may ONLY use the exact exact_price provided. RULE 3: Do NOT invent, estimate, discount, or hallucinate any items, packages, or prices that are not explicitly listed in the context array. If a price is not in the array, do not mention a price.`
      : "";

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "draft_reply":
      case "coach_reply":
      case "program_reply": {
        systemPrompt = `You are Coach Matt Michels, a strength & conditioning coach with 20+ years of experience training athletes of all ages. You give direct, knowledgeable, encouraging feedback on exercise form and performance. Keep replies conversational, under 100 words. Reference the specific exercise data provided. Use your signature style: practical, real, no-BS coaching.`;
        
        if (context.source === "program_message" || type === "program_reply") {
          userPrompt = `An athlete asked about their program:\n\nProgram: ${context.programTitle || "Training Program"}\nExercise: ${context.exerciseName}\nWeek ${context.weekNumber || "?"}, Day ${context.dayNumber || "?"}\nTheir question: "${context.message || ""}"\n${context.videoUrl ? "They attached a form check video." : ""}\n\nWrite a helpful coaching reply.`;
        } else {
          userPrompt = `Write coaching feedback for this flagged exercise:\n\nExercise: ${context.exerciseName}\nSets/Reps/Weight: ${context.setsRepsWeight || "Not specified"}\nClient Notes: ${context.clientNotes || "None"}\nHas Video: ${context.hasVideo ? "Yes" : "No"}\n\nWrite a helpful, specific coaching reply.`;
        }
        break;
      }

      case "newsletter": {
        systemPrompt = `You are Matt Michels writing his monthly "The Real Deal" newsletter for athletes, parents, and coaches. Your voice is direct, educational, passionate about the WHY behind training. You reference kinesiology, biomechanics, and 20+ years of real-world experience. Format with **bold** for emphasis. Keep it 300-500 words.${catalogContext}`;
        userPrompt = `Write a newsletter about: ${context.topic}\nTemplate style: ${context.templateName || "General"}\nTarget audience: ${context.audience || "Athletes and parents"}\n\nWrite the full newsletter body (not the subject line).`;
        break;
      }

      case "exercise": {
        systemPrompt = `You are an expert exercise scientist and strength coach. Generate detailed exercise entries for a training library. Be precise about equipment, focus areas, and the biomechanical "why" behind each exercise.`;
        userPrompt = `Create an exercise library entry for: "${context.exerciseName}"\n\nReturn ONLY valid JSON (no markdown, no code fences) with these fields:\n{\n  "title": "proper exercise name",\n  "equipment_needed": "specific equipment",\n  "the_why": "2-3 sentences explaining the biomechanical purpose and benefit",\n  "client_type": ["Athlete" and/or "Lifestyle Fitness"],\n  "focus_area": [pick from: "Mobility", "Strength", "Core Stability", "Flexibility", "Rehab", "Stability", "Posture", "Power", "Speed", "Injury Prevention", "Core"],\n  "sport": [relevant sports or empty array]\n}`;
        break;
      }

      case "promo_suggest": {
        systemPrompt = `You are a fitness business marketing expert. Suggest creative, effective promotional campaigns for an online strength training platform (M² Training). Be specific with codes, percentages, and timing.${catalogContext}`;
        userPrompt = `Suggest 3 promotional ideas for an online training platform.\nCurrent season/month: ${context.month}\nExisting promos: ${context.existingCodes || "None"}\n\nReturn ONLY valid JSON (no markdown, no code fences) as an array:\n[{\n  "code": "PROMO_CODE",\n  "description": "what it does",\n  "discount_type": "percent" or "fixed",\n  "discount_value": number,\n  "applies_to": "all" or "programs" or "subscriptions",\n  "reasoning": "why this works"\n}]`;
        break;
      }

      case "batch_site_content": {
        systemPrompt = `You are a copywriter for M² Training, a premium strength & conditioning brand led by Coach Matt Michels. Write compelling, concise website copy. Voice: confident, direct, athlete-focused. No fluff. Keep the same general meaning but make everything sharper, more engaging, and on-brand.${catalogContext}`;
        userPrompt = `Rewrite/improve ALL of the following website content fields for the "${context.sectionLabel}" section. Keep each field's purpose intact but make the copy better.\n\nReturn ONLY valid JSON (no markdown, no code fences) as an object where keys are the field IDs and values are the improved text:\n\n${JSON.stringify(context.fields, null, 2)}\n\nReturn: { "field_id": "improved text", ... }`;
        break;
      }

      case "site_content": {
        systemPrompt = `You are a copywriter for M² Training, a premium strength & conditioning brand led by Coach Matt Michels. Write compelling, concise website copy. Voice: confident, direct, athlete-focused. No fluff.${catalogContext}`;
        userPrompt = `Rewrite/improve this website content field:\n\nSection: ${context.section}\nField: ${context.label}\nCurrent text: "${context.currentValue}"\n\nWrite improved copy that's more engaging and on-brand. Return ONLY the new text, nothing else.`;
        break;
      }

      case "protocol": {
        systemPrompt = `You are an expert strength & conditioning coach. Generate a training protocol with specific exercises, sets, reps, and coaching notes. Be precise and practical.`;
        userPrompt = `Generate a training protocol titled "${context.title}".\n${context.description ? `Description: ${context.description}` : ""}\n\nReturn ONLY valid JSON (no markdown, no code fences) as an array of exercises:\n[{\n  "exercise_name": "exercise name",\n  "sets": number,\n  "reps": "rep scheme (e.g. 8-10)",\n  "weight": null,\n  "rpe": number (1-10),\n  "notes": "coaching cue or note"\n}]\nInclude 6-10 exercises in a logical training order.`;
        break;
      }

      case "client_summary": {
        systemPrompt = `You are a sports performance analyst. Generate a brief client engagement summary based on their training data. Be concise, actionable, and highlight trends or concerns.`;
        userPrompt = `Generate a brief engagement summary for this client:\n\nName: ${context.name}\nJoined: ${context.joined}\nSubscription: ${context.tier}\nTotal Workouts: ${context.totalWorkouts}\nLast 7 Days Active: ${context.recentlyActive ? "Yes" : "No"}\nActive Programs: ${context.programCount}\nRecent Lifts: ${context.recentLifts || "None logged"}\n\nWrite 2-3 sentences: engagement level, any concerns, and one recommendation. Keep it under 80 words.`;
        break;
      }

      case "schedule_suggest": {
        systemPrompt = `You are a scheduling strategist for Coach Matt Michels' in-person training studio. Analyze booking patterns and suggest optimal time slots to open for maximum bookings. Be concise, specific, and data-driven. Under 150 words.`;
        userPrompt = `Analyze this day's schedule and suggest which time slots to open:\n\nDate: ${context.date} (${context.dayOfWeek})\nTotal bookings today: ${context.totalBookings}\nBooked times: ${context.bookedTimes}\nCurrently available (open but unbooked): ${context.currentAvailable}\nTotal possible slots: ${context.totalSlots}\n\nBased on typical training studio patterns (early morning 5-7am for pre-work athletes, after school 3-5pm for youth, evening 5-7pm for adults), suggest:\n1. Which additional time slots to open\n2. Which open but unbooked slots to consider closing\n3. Any pattern observations\n\nBe specific with times and reasoning.`;
        break;
      }

      case "form_check": {
        systemPrompt = `You are Coach Matt Michels reviewing an athlete's exercise form. Based on the exercise and any notes/context provided, write detailed form coaching feedback. Be specific about common mistakes, cues to fix them, and what to look for. Reference biomechanics and the WHY behind each cue. Be encouraging but direct. Under 200 words.`;
        userPrompt = `Write form check feedback for this athlete:\n\nExercise: ${context.exerciseName}\nAthlete: ${context.athleteName || "Unknown"}\nSets/Reps Prescribed: ${context.setsReps || "Not specified"}\nClient Notes: ${context.clientNotes || "None"}\nHas Video: ${context.hasVideo ? "Yes — reference that you reviewed their video" : "No video submitted"}\nTier: ${context.tier || "Unknown"}\n\nWrite detailed coaching feedback covering:\n1. Key form cues for this specific exercise\n2. Common mistakes to watch for\n3. A specific correction based on their notes (if any)\n4. Encouragement and what to focus on next session\n\nSound like Matt — direct, knowledgeable, no-BS coaching.`;
        break;
      }

      case "parent_report": {
        systemPrompt = `You are Coach Matt Michels writing a progress report for a parent about their child's training. Be professional, encouraging, and specific about what the athlete is doing well and where they can improve. Parents want to know their money is well spent and their kid is making progress. Include specific data points when available. Keep it under 250 words.${catalogContext}`;
        userPrompt = `Write a progress report for this athlete's parent:\n\nAthlete Name: ${context.athleteName}\nSubscription: ${context.tier}\nMember Since: ${context.joinDate}\nTotal Workouts Logged: ${context.totalWorkouts}\nRecent Activity (last 14 days): ${context.recentWorkouts} workouts\nActive Programs: ${context.activePrograms || "None"}\nAvg Sleep: ${context.avgSleep || "Not tracked"}\nAvg Energy: ${context.avgEnergy || "Not tracked"}\nAvg Soreness: ${context.avgSoreness || "Not tracked"}\nRecent Lifts: ${context.recentLifts || "No lifts logged"}\nFlagged Exercises: ${context.flaggedCount || 0}\n${context.coachNotes ? `Coach's Recent Notes: ${context.coachNotes}` : ""}\n\nWrite a parent-friendly progress report covering:\n1. What their athlete has been doing (be specific)\n2. Strengths and improvements observed\n3. Areas to focus on\n4. Encouragement and next steps\n5. Any concerns (if soreness is high, workouts are low, etc.)\n\nAddress the parent directly. Sign off as Coach Matt.`;
        break;
      }

      case "ai_copilot": {
        systemPrompt = `You are an AI performance analyst for M² Training, Coach Matt Michels' strength & conditioning business. Analyze athlete data to flag actionable insights. Be concise, specific, and data-driven. Use a professional but direct tone. Format output as JSON.${catalogContext}`;
        userPrompt = `Analyze this athlete roster data and generate actionable coaching insights.\n\nATHLETE DATA:\n${JSON.stringify(context.athletes, null, 2)}\n\nTRIAL USERS:\n${JSON.stringify(context.trialUsers, null, 2)}\n\nToday's date: ${context.today}\n\nGenerate insights in these categories:\n1. "stagnation" — athletes who haven't increased weight on core lifts (Squat, Bench, Deadlift, or similar compound movements) in 3+ weeks. Include their name, the exercise, and a suggested coach message.\n2. "ghost_trials" — trial users who signed up 4+ days ago but have zero workout logs. Include their name, email, days since signup, and a draft check-in message.\n\nReturn ONLY valid JSON (no markdown, no code fences):\n{\n  "stagnation": [{ "name": "...", "exercise": "...", "lastWeight": number, "weeksSince": number, "suggestedMessage": "..." }],\n  "ghost_trials": [{ "name": "...", "email": "...", "daysSinceSignup": number, "draftMessage": "..." }]\n}`;
        break;
      }

      case "blog_draft": {
        systemPrompt = `You are Coach Matt Michels — the "Anti-Influencer" strength coach. You've trained athletes for 20+ years. Your writing style is:\n- Direct, no-BS, conversational\n- Backed by real experience, not internet trends\n- You call out bad fitness advice openly\n- You explain the WHY behind everything (biomechanics, kinesiology)\n- You care deeply about youth athletes and parent education\n- No clickbait, no hype — just real talk\n\nWrite SEO-optimized blog posts that sound like Matt talking to a parent or athlete over coffee. Use short paragraphs, bold key points, and end with a clear takeaway.${catalogContext}`;
        userPrompt = `Matt typed this raw thought: "${context.rawIdea}"\n\nTurn this into a professional, ~300-word SEO-optimized blog post in Matt's "Anti-Influencer" voice.\n\nRequirements:\n- Catchy, SEO-friendly title (include relevant keywords)\n- Opening hook that grabs parents or athletes\n- 3-4 short paragraphs with **bold** key phrases\n- Practical takeaway at the end\n- Tone: confident, educational, no fluff\n\nReturn ONLY valid JSON (no markdown, no code fences):\n{\n  "title": "...",\n  "body": "... (markdown formatted)",\n  "category": "one of: general, injury-prevention, youth-development, training-fundamentals, recovery, nutrition, parent-guide",\n  "slug": "url-friendly-slug"\n}`;
        break;
      }

      case "generate_ad": {
        systemPrompt = `You are a precise marketing copywriter for M² Training, Coach Matt Michels' strength & conditioning brand. You are provided with a strict JSON array of available services and their exact prices.${catalogContext}\n\nRULE 1: You may ONLY reference the exact item_name provided in the context. RULE 2: You may ONLY use the exact exact_price provided. RULE 3: Do NOT invent, estimate, discount, or hallucinate any items, packages, or prices that are not explicitly listed in the context array. If a price is not in the array, do not mention a price.`;
        userPrompt = `Generate a marketing ad/copy for:\nTarget: ${context.target || "general audience"}\nPlatform: ${context.platform || "website"}\nTone: ${context.tone || "confident, direct"}\nFocus: ${context.focus || "general services"}\n\nReturn ONLY valid JSON (no markdown, no code fences):\n{\n  "title": "ad headline",\n  "body": "full ad copy (markdown ok)",\n  "cta": "call to action text"\n}`;
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

    // Queue the result for admin approval instead of returning directly
    const { error: queueError } = await supabaseClient
      .from("ai_action_queue")
      .insert({
        action_type: type,
        target_user_id: context._targetUserId || null,
        context: context,
        ai_result: content,
        status: "pending",
      });

    if (queueError) {
      console.error("Failed to queue AI action:", queueError);
      // Fall through and return result anyway if queue fails
      return new Response(JSON.stringify({ result: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ queued: true, message: "AI response queued for admin approval" }), {
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
