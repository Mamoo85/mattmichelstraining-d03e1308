import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type BusinessIntelRequest = {
  tool: "churn_predict" | "pricing_optimizer" | "revenue_forecast" | "competitor_monitor";
  context?: {
    notes?: string;
    competitorUrl?: string;
    competitorName?: string;
  };
};

type FirecrawlResponse = {
  data?: {
    markdown?: string;
  };
  markdown?: string;
};

type GatewayResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { tool, context } = await req.json() as BusinessIntelRequest;

    let systemPrompt = "";
    let userPrompt = "";
    let dbContext = "";

    switch (tool) {
      case "churn_predict": {
        // Gather real data for AI analysis
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        const { data: profiles } = await sb.from("profiles").select("user_id, full_name, email, subscription_tier, created_at, updated_at").neq("subscription_tier", "free");
        const { data: recentLogs } = await sb.from("progress_logs").select("user_id, logged_at").gte("logged_at", thirtyDaysAgo);
        const { data: workoutLogs } = await sb.from("workout_logs").select("user_id, completed_at").gte("completed_at", thirtyDaysAgo);

        // Build per-user activity summary
        const userActivity: Record<string, { name: string; email: string; tier: string; logsLast30: number; logsLast7: number; workoutsLast30: number; joinDate: string }> = {};
        for (const p of profiles || []) {
          userActivity[p.user_id] = {
            name: p.full_name || p.email || "Unknown",
            email: p.email || "",
            tier: p.subscription_tier,
            logsLast30: 0,
            logsLast7: 0,
            workoutsLast30: 0,
            joinDate: p.created_at,
          };
        }
        for (const l of recentLogs || []) {
          if (userActivity[l.user_id]) {
            userActivity[l.user_id].logsLast30++;
            if (l.logged_at >= sevenDaysAgo) userActivity[l.user_id].logsLast7++;
          }
        }
        for (const w of workoutLogs || []) {
          if (userActivity[w.user_id]) userActivity[w.user_id].workoutsLast30++;
        }

        dbContext = JSON.stringify(Object.values(userActivity).slice(0, 50));
        systemPrompt = `You are a retention analytics AI for M2 Performance Training. Analyze subscriber activity data to predict churn risk.
Rules:
- Flag users with HIGH, MEDIUM, or LOW churn risk
- HIGH: paying subscribers with 0 logs in 7+ days, or <3 logs in 30 days
- MEDIUM: declining activity trend, or sudden drop in workout frequency
- LOW: consistent activity
- For each at-risk user, suggest a personalized re-engagement action
- Output as a structured report with sections: 🔴 HIGH RISK, 🟡 MEDIUM RISK, 📊 SUMMARY
- Include actionable next steps for each user`;
        userPrompt = `Analyze this subscriber activity data and predict churn risk:\n${dbContext}`;
        break;
      }

      case "pricing_optimizer": {
        const { data: profiles } = await sb.from("profiles").select("subscription_tier").neq("subscription_tier", "free");
        const tierCounts: Record<string, number> = {};
        for (const p of profiles || []) {
          tierCounts[p.subscription_tier] = (tierCounts[p.subscription_tier] || 0) + 1;
        }

        dbContext = JSON.stringify({ tierDistribution: tierCounts, totalPaying: profiles?.length || 0 });
        systemPrompt = `You are a pricing strategy AI for M2 Performance Training, a youth/adult athletic training platform.
Current tiers: Basic ($14.99/mo), Foundation ($49.99/mo), Custom ($99.99/mo), Team ($39.99/mo per athlete).
Rules:
- Analyze the tier distribution to identify pricing opportunities
- Suggest price adjustments with reasoning
- Consider price anchoring, decoy pricing, and value-based pricing
- Recommend bundle opportunities
- Output sections: 📊 CURRENT STATE, 💡 RECOMMENDATIONS, 🎯 PROJECTED IMPACT`;
        userPrompt = `Here's the current subscriber distribution:\n${dbContext}\n\nAdditional context: ${context?.notes || "Focus on maximizing revenue while keeping youth athletes accessible."}`;
        break;
      }

      case "revenue_forecast": {
        const { data: profiles } = await sb.from("profiles").select("subscription_tier, created_at").neq("subscription_tier", "free");

        // Group signups by month
        const monthlySignups: Record<string, number> = {};
        for (const p of profiles || []) {
          const month = p.created_at.slice(0, 7);
          monthlySignups[month] = (monthlySignups[month] || 0) + 1;
        }

        const tierPrices: Record<string, number> = { basic: 14.99, foundation: 49.99, custom: 99.99, team: 39.99 };
        const tierCounts: Record<string, number> = {};
        for (const p of profiles || []) {
          tierCounts[p.subscription_tier] = (tierCounts[p.subscription_tier] || 0) + 1;
        }

        const currentMRR = Object.entries(tierCounts).reduce((sum, [tier, count]) => sum + (tierPrices[tier] || 0) * count, 0);

        dbContext = JSON.stringify({ monthlySignups, tierCounts, currentMRR: currentMRR.toFixed(2), totalPaying: profiles?.length || 0 });
        systemPrompt = `You are a revenue forecasting AI for M2 Performance Training.
Rules:
- Analyze historical signup trends and current MRR
- Project 3-month, 6-month, and 12-month revenue forecasts
- Factor in estimated churn rates (industry average 5-8% monthly for fitness)
- Identify growth opportunities and risks
- Output sections: 📊 CURRENT METRICS, 📈 FORECASTS (3/6/12 month), ⚡ GROWTH LEVERS, ⚠️ RISKS`;
        userPrompt = `Here's the revenue data:\n${dbContext}\n\nNotes: ${context?.notes || ""}`;
        break;
      }

      case "competitor_monitor": {
        // Use Firecrawl to scrape competitor
        const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
        let scrapedContent = "";
        if (firecrawlKey && context?.competitorUrl) {
          try {
            const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ url: context.competitorUrl, formats: ["markdown"], onlyMainContent: true }),
            });
            if (scrapeRes.ok) {
              const scrapeData = await scrapeRes.json() as FirecrawlResponse;
              scrapedContent = scrapeData.data?.markdown || scrapeData.markdown || "";
              // Limit content length
              if (scrapedContent.length > 8000) scrapedContent = scrapedContent.slice(0, 8000) + "...";
            }
          } catch (e) {
            console.error("Firecrawl error:", e);
            scrapedContent = "[Could not scrape competitor site — Firecrawl may not be configured]";
          }
        }

        systemPrompt = `You are a competitive intelligence AI for M2 Performance Training (youth/adult athletic training, Grosse Pointe Park MI).
Rules:
- Analyze the competitor's website content
- Identify their pricing, services, positioning, and unique selling points
- Compare against M2's offerings
- Highlight threats and opportunities
- Suggest actionable counter-strategies
- Output sections: 🏢 COMPETITOR OVERVIEW, 💰 PRICING COMPARISON, 🎯 THEIR STRENGTHS, ⚡ OUR ADVANTAGES, 📋 ACTION ITEMS`;
        userPrompt = scrapedContent
          ? `Analyze this competitor's website:\nURL: ${context?.competitorUrl || "Unknown URL"}\n\nContent:\n${scrapedContent}`
          : `Analyze competitor: ${context?.competitorName || context?.competitorUrl || "a local training facility"}.\nNotes: ${context?.notes || "General competitive analysis"}`;
        break;
      }

      default:
        throw new Error(`Unknown tool: ${tool}`);
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

    const data = await response.json() as GatewayResponse;
    const result = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {};

    return new Response(JSON.stringify({ result, tool, usage: { prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0, total_tokens: usage.total_tokens || 0, model: data.model || "google/gemini-3-flash-preview" } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-business-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
