import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
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

    // Fetch user context
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, athlete_name, email, subscription_tier, trial_started_at, stripe_customer_id, is_in_person")
      .eq("user_id", ticket.user_id)
      .single();

    const { data: subscriptions } = await supabaseClient
      .from("subscriptions")
      .select("plan, status, stripe_subscription_id, current_period_end")
      .eq("user_id", ticket.user_id)
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: recentBookings } = await supabaseClient
      .from("session_bookings")
      .select("session_type, slot_date, status, amount_cents")
      .eq("user_id", ticket.user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: purchasedPrograms } = await supabaseClient
      .from("purchased_programs")
      .select("program_title, program_type, purchased_at")
      .eq("user_id", ticket.user_id)
      .limit(10);

    // Build context for AI
    const userContext = {
      profile,
      subscriptions,
      recentBookings,
      purchasedPrograms,
    };

    const systemPrompt = `You are an AI support copilot for M2 Training, a sports training business run by Coach Matt.
You analyze support tickets submitted by users and propose concrete technical actions to resolve them.

Available actions you can propose (return as JSON array):
- { "type": "tier_change", "from": "basic", "to": "foundation", "reason": "..." }
- { "type": "stripe_refund", "amount_cents": 1499, "reason": "..." }
- { "type": "extend_trial", "days": 7, "reason": "..." }
- { "type": "send_email", "subject": "...", "body_draft": "..." }
- { "type": "manual_note", "note": "..." } (for things requiring manual intervention)

Rules:
- Always be specific about amounts, tiers, and actions.
- Never propose actions that aren't warranted by the ticket.
- If the issue is unclear, propose a "manual_note" action asking the admin to follow up.
- Return a JSON object with "summary" (human-readable explanation) and "actions" (array of proposed actions).`;

    const userPrompt = `Support Ticket:
Subject: ${ticket.subject}
Body: ${ticket.body}
Submitted: ${ticket.created_at}

User Context:
${JSON.stringify(userContext, null, 2)}

Analyze this ticket and propose a resolution. Return valid JSON only.`;

    // Call AI via Lovable proxy
    const aiRes = await fetch("https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/ai-admin-assist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({
        type: "support_triage",
        context: { systemPrompt, userPrompt },
      }),
    });

    let aiResult: any;
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const raw = aiData?.result || "{}";
      try {
        aiResult = typeof raw === "string"
          ? JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
          : raw;
      } catch {
        aiResult = { summary: raw, actions: [] };
      }
    } else {
      aiResult = { summary: "AI analysis unavailable. Please review manually.", actions: [{ type: "manual_note", note: "AI service returned an error." }] };
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
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
