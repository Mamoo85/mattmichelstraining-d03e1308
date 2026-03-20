import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ── 1. Gather business context from Supabase ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Subscriber distribution
    const { data: profiles } = await sb.from("profiles").select("subscription_tier, created_at, updated_at");
    const tierCounts: Record<string, number> = {};
    let recentSignups = 0;
    for (const p of profiles || []) {
      tierCounts[p.subscription_tier] = (tierCounts[p.subscription_tier] || 0) + 1;
      if (p.created_at >= sevenDaysAgo) recentSignups++;
    }

    // Activity data for churn context
    const { data: recentLogs } = await sb.from("progress_logs").select("user_id, logged_at").gte("logged_at", thirtyDaysAgo);
    const { data: workoutLogs } = await sb.from("workout_logs").select("user_id, completed_at").gte("completed_at", thirtyDaysAgo);

    const activeUsers = new Set([
      ...(recentLogs || []).filter(l => l.logged_at >= sevenDaysAgo).map(l => l.user_id),
      ...(workoutLogs || []).filter(w => w.completed_at >= sevenDaysAgo).map(w => w.user_id),
    ]);

    const totalPaying = Object.entries(tierCounts).filter(([k]) => k !== "free").reduce((s, [, v]) => s + v, 0);
    const tierPrices: Record<string, number> = { basic: 14.99, foundation: 49.99, custom: 99.99, team: 39.99 };
    const currentMRR = Object.entries(tierCounts).reduce((sum, [tier, count]) => sum + (tierPrices[tier] || 0) * count, 0);

    // Newsletter subscribers
    const { count: subscriberCount } = await sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true);

    // ── 2. Build simulated analytics snapshot ──
    // Since we can't call the Lovable Analytics API from an edge function,
    // we build a business-data-driven analytics context from internal tables
    const { data: recentNutritionLogs } = await sb.from("nutrition_logs").select("id", { count: "exact", head: true }).gte("logged_at", sevenDaysAgo);
    const { data: recentChallengeEntries } = await sb.from("challenge_entries").select("id", { count: "exact", head: true }).gte("logged_at", sevenDaysAgo);

    const rawAnalytics = {
      period: `${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)} to ${new Date().toISOString().slice(0, 10)}`,
      business_metrics: {
        total_users: profiles?.length || 0,
        paying_subscribers: totalPaying,
        free_users: tierCounts["free"] || 0,
        tier_distribution: tierCounts,
        current_mrr: currentMRR.toFixed(2),
        new_signups_7d: recentSignups,
        active_users_7d: activeUsers.size,
        newsletter_subscribers: subscriberCount || 0,
      },
      engagement: {
        progress_logs_30d: recentLogs?.length || 0,
        workout_logs_30d: workoutLogs?.length || 0,
        active_users_7d: activeUsers.size,
        inactive_paying_users: totalPaying - activeUsers.size,
      },
      feature_usage: {
        nutrition_logs_7d: recentNutritionLogs?.length || 0,
        challenge_entries_7d: recentChallengeEntries?.length || 0,
      },
    };

    // ── 3. Send to AI for CMO analysis ──
    const systemPrompt = `You are the elite Chief Marketing Officer for M2 Performance Training, a youth and adult athletic training platform in Grosse Pointe Park, Michigan.

You are analyzing this week's business metrics and user behavior data. Return a strict JSON object with exactly these keys:

{
  "executive_summary": "2-3 sentence overview of the week",
  "funnel_bottlenecks": [
    { "stage": "string", "issue": "string", "impact": "high|medium|low", "fix": "string" }
  ],
  "seo_opportunities": [
    { "keyword": "string", "rationale": "string", "content_type": "blog|landing_page|faq", "priority": "high|medium|low" }
  ],
  "ad_campaign_ideas": [
    { "platform": "string", "headline": "string", "body": "string", "target_demo": "string", "budget_suggestion": "string", "rationale": "string" }
  ],
  "retention_actions": [
    { "segment": "string", "action": "string", "urgency": "high|medium|low" }
  ],
  "growth_score": 1-10,
  "top_priority": "string"
}

Rules:
- Be specific and actionable — no generic advice
- Reference actual numbers from the data
- Consider the local Michigan market and youth sports seasonality
- Ad copy should be ready to use, not placeholder
- Identify the single most impactful action this week`;

    const userPrompt = `Analyze this week's business data for M2 Performance Training:\n\n${JSON.stringify(rawAnalytics, null, 2)}`;

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
        tools: [{
          type: "function",
          function: {
            name: "deliver_cmo_report",
            description: "Deliver the weekly CMO intelligence report",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string" },
                funnel_bottlenecks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      stage: { type: "string" },
                      issue: { type: "string" },
                      impact: { type: "string", enum: ["high", "medium", "low"] },
                      fix: { type: "string" },
                    },
                    required: ["stage", "issue", "impact", "fix"],
                  },
                },
                seo_opportunities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      keyword: { type: "string" },
                      rationale: { type: "string" },
                      content_type: { type: "string", enum: ["blog", "landing_page", "faq"] },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["keyword", "rationale", "content_type", "priority"],
                  },
                },
                ad_campaign_ideas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      platform: { type: "string" },
                      headline: { type: "string" },
                      body: { type: "string" },
                      target_demo: { type: "string" },
                      budget_suggestion: { type: "string" },
                      rationale: { type: "string" },
                    },
                    required: ["platform", "headline", "body", "target_demo", "budget_suggestion", "rationale"],
                  },
                },
                retention_actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segment: { type: "string" },
                      action: { type: "string" },
                      urgency: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["segment", "action", "urgency"],
                  },
                },
                growth_score: { type: "number" },
                top_priority: { type: "string" },
              },
              required: ["executive_summary", "funnel_bottlenecks", "seo_opportunities", "ad_campaign_ideas", "retention_actions", "growth_score", "top_priority"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "deliver_cmo_report" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits needed — add funds in Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    
    // Extract structured response from tool call
    let aiAnalysis: Record<string, unknown> = {};
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        aiAnalysis = JSON.parse(toolCall.function.arguments);
      } catch {
        // Fallback: try to parse from content
        const content = data.choices?.[0]?.message?.content || "";
        try { aiAnalysis = JSON.parse(content); } catch { aiAnalysis = { raw: content }; }
      }
    }

    // Build summary text
    const summary = aiAnalysis.executive_summary || "Report generated successfully.";

    // ── 4. Save to database ──
    const reportWeek = new Date();
    reportWeek.setDate(reportWeek.getDate() - reportWeek.getDay() + 1); // Monday of current week
    const reportWeekStr = reportWeek.toISOString().slice(0, 10);

    const { error: insertError } = await sb.from("ai_marketing_reports").insert({
      report_week: reportWeekStr,
      raw_analytics: rawAnalytics,
      ai_analysis: aiAnalysis,
      summary_text: summary as string,
      status: "new",
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save report");
    }

    return new Response(JSON.stringify({
      success: true,
      report_week: reportWeekStr,
      summary,
      growth_score: aiAnalysis.growth_score,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-cmo-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
