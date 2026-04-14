// Territory Defense — weekly cron scans competitor reviews via Sonar
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateJSON } from "../_shared/ai.ts";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SonarResult {
  avg_rating: number;
  review_count: number;
  negative_reviews: string[];
}

async function sonarSearch(query: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [{ role: "user", content: query }],
        max_tokens: 800,
      }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: monitors } = await sb
      .from("competitor_monitors")
      .select("*")
      .order("last_scanned_at", { ascending: true, nullsFirst: true })
      .limit(20);

    if (!monitors || monitors.length === 0) {
      return new Response(JSON.stringify({ scanned: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let alertCount = 0;

    for (const monitor of monitors) {
      const query = `${monitor.competitor_name} Google reviews recent. What is their current Google star rating, approximate total review count, and list any 1 or 2 star reviews from the past 2 weeks?`;
      const raw = await sonarSearch(query);

      if (!raw) {
        await sb.from("competitor_monitors")
          .update({ last_scanned_at: new Date().toISOString() })
          .eq("id", monitor.id);
        continue;
      }

      // Parse with AI
      const parsed = await generateJSON<SonarResult>(
        `Extract from this text about "${monitor.competitor_name}" Google reviews:\n\n${raw}\n\nReturn JSON: { "avg_rating": number, "review_count": number, "negative_reviews": ["summary of each 1-2 star review"] }`,
        { avg_rating: 0, review_count: 0, negative_reviews: [] },
        600
      );

      const prevRating = monitor.last_avg_rating ? Number(monitor.last_avg_rating) : 0;
      const prevCount = monitor.last_review_count || 0;
      const ratingDrop = prevRating > 0 && parsed.avg_rating > 0 ? prevRating - parsed.avg_rating : 0;
      const newNegatives = parsed.negative_reviews.length;

      // Detect alerts
      const alerts: { type: string; details: any }[] = [];

      if (ratingDrop >= 0.3) {
        alerts.push({
          type: "review_drop",
          details: { previous_rating: prevRating, current_rating: parsed.avg_rating, drop: ratingDrop },
        });
      }

      if (newNegatives >= 2) {
        alerts.push({
          type: "new_negative",
          details: { count: newNegatives, reviews: parsed.negative_reviews.slice(0, 5) },
        });
      }

      // Update monitor
      await sb.from("competitor_monitors").update({
        last_scanned_at: new Date().toISOString(),
        last_avg_rating: parsed.avg_rating || monitor.last_avg_rating,
        last_review_count: parsed.review_count || monitor.last_review_count,
      }).eq("id", monitor.id);

      // Insert alerts and notify client
      for (const alert of alerts) {
        await sb.from("competitor_alerts").insert({
          monitor_id: monitor.id,
          alert_type: alert.type,
          details: alert.details,
        });

        // Look up client to notify
        const clientTable = monitor.client_table || "contractor_clients";
        const { data: client } = await sb
          .from(clientTable)
          .select("phone, email, business_name")
          .eq("id", monitor.client_id)
          .maybeSingle();

        if (client?.phone) {
          const alertMsg = alert.type === "review_drop"
            ? `🎯 COMPETITOR ALERT: ${monitor.competitor_name} dropped from ${prevRating}⭐ to ${parsed.avg_rating}⭐. This is your window — deploy aggressive marketing in their territory NOW.`
            : `🎯 COMPETITOR ALERT: ${monitor.competitor_name} got ${newNegatives} negative reviews this week. Their customers are looking for alternatives — reach out now.`;

          await sendSMS(client.phone, TWILIO_PHONE, alertMsg, "territory_defense");
        }

        alertCount++;
      }
    }

    // Notify Matt summary
    if (alertCount > 0) {
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE,
        `Territory Defense: ${alertCount} competitor alert(s) generated from ${monitors.length} monitors scanned.`,
        "territory_defense"
      );
    }

    return new Response(JSON.stringify({
      scanned: monitors.length,
      alerts_generated: alertCount,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[competitor-scan]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
