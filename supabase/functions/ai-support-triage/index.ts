import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabaseClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { ticket_id } = await req.json();
    if (!ticket_id) throw new Error("Missing ticket_id");

    // Fetch ticket
    const { data: ticket, error: tErr } = await supabaseClient
      .from("support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .single();
    if (tErr || !ticket) throw new Error("Ticket not found");

    // Fetch rich user context
    const [profileRes, subsRes, bookingsRes, programsRes, workoutCountRes, pointsRes] = await Promise.all([
      supabaseClient.from("profiles").select("full_name, athlete_name, email, subscription_tier, trial_started_at, stripe_customer_id, is_in_person, created_at").eq("user_id", ticket.user_id).single(),
      supabaseClient.from("subscriptions").select("plan, status, stripe_subscription_id, current_period_end").eq("user_id", ticket.user_id).order("created_at", { ascending: false }).limit(3),
      supabaseClient.from("session_bookings").select("session_type, slot_date, status, amount_cents").eq("user_id", ticket.user_id).order("created_at", { ascending: false }).limit(5),
      supabaseClient.from("purchased_programs").select("program_title, program_type, purchased_at").eq("user_id", ticket.user_id).limit(10),
      supabaseClient.from("workout_logs").select("date").eq("user_id", ticket.user_id),
      supabaseClient.from("user_points").select("total_points, level, current_streak").eq("user_id", ticket.user_id).single(),
    ]);

    const profile = profileRes.data;
    const subscriptions = subsRes.data || [];
    const recentBookings = bookingsRes.data || [];
    const purchasedPrograms = programsRes.data || [];
    const totalWorkouts = workoutCountRes.data?.length || 0;
    const points = pointsRes.data;

    const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown";

    const systemPrompt = `You are an AI support copilot for M² Training, Coach Matt Michels' strength & conditioning business.
You analyze support tickets and propose concrete technical actions to resolve them.

USER PROFILE:
- Name: ${profile?.athlete_name || profile?.full_name || "Unknown"}
- Email: ${profile?.email}
- Tier: ${profile?.subscription_tier || "free"}
- Member Since: ${memberSince}
- In-Person Client: ${profile?.is_in_person ? "Yes" : "No"}
- Total Workouts: ${totalWorkouts}
- Points: ${points?.total_points || 0} (${points?.level || "rookie"})
- Streak: ${points?.current_streak || 0} days
- Stripe Customer: ${profile?.stripe_customer_id ? "Yes" : "No"}
- Trial Started: ${profile?.trial_started_at || "N/A"}

SUBSCRIPTIONS: ${JSON.stringify(subscriptions)}
RECENT BOOKINGS: ${JSON.stringify(recentBookings)}
PURCHASED PROGRAMS: ${JSON.stringify(purchasedPrograms)}

Available actions you can propose (return as JSON array):
- { "type": "tier_change", "from": "...", "to": "...", "reason": "..." }
- { "type": "stripe_refund", "amount_cents": 1499, "reason": "..." }
- { "type": "extend_trial", "days": 7, "reason": "..." }
- { "type": "send_email", "subject": "...", "body_draft": "..." }
- { "type": "manual_note", "note": "..." }

Rules:
- Be specific about amounts, tiers, and actions
- Never propose unwarranted actions
- Consider the user's engagement level (workouts, streak, points) when assessing priority
- For billing issues, check their subscription and Stripe data carefully
- For access issues, check their tier and trial status
- If the issue is unclear, propose a "manual_note" asking admin to follow up
- Return valid JSON only: { "summary": "...", "priority": "low|medium|high|urgent", "actions": [...] }`;

    const userPrompt = `Support Ticket:
Subject: ${ticket.subject}
Body: ${ticket.body}
Submitted: ${ticket.created_at}

Analyze this ticket and propose a resolution. Return valid JSON only.`;

    // Call AI gateway directly
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    let aiResult: any;
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const raw = aiData?.choices?.[0]?.message?.content || "{}";
      try {
        aiResult = typeof raw === "string"
          ? JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
          : raw;
      } catch {
        aiResult = { summary: raw, priority: "medium", actions: [] };
      }
    } else {
      const status = aiRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      aiResult = { summary: "AI analysis unavailable. Please review manually.", priority: "medium", actions: [{ type: "manual_note", note: "AI service returned an error." }] };
    }

    // Update ticket with AI suggestion
    await supabaseClient
      .from("support_tickets")
      .update({
        ai_suggestion: aiResult.summary || "",
        ai_actions: aiResult.actions || [],
        status: "ai_reviewed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket_id);

    return new Response(JSON.stringify({ success: true, ...aiResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
