// alert-rule-tester: dry-run simulator for spend anomalies, quiet hours, DLQ aging.
// Reuses _shared/alert-rules.ts so tester == production.
import {
  evaluateDlqAging,
  evaluateSpendAnomaly,
  evaluateWalkerBudget,
  shouldSuppressForQuietHours,
  type Severity,
} from "../_shared/alert-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { rule, input } = body as {
      rule: "spend_anomaly" | "quiet_hours" | "dlq_aging" | "walker_budget";
      input: Record<string, unknown>;
    };

    let result: unknown;
    switch (rule) {
      case "spend_anomaly":
        result = evaluateSpendAnomaly(
          Number(input.todaySpend ?? 0),
          Number(input.rollingAvg7d ?? 0),
          Number(input.threshold ?? 2.0),
        );
        break;
      case "quiet_hours": {
        const date = input.etTimeIso ? new Date(String(input.etTimeIso)) : new Date();
        result = shouldSuppressForQuietHours((input.severity as Severity) || "warn", date);
        break;
      }
      case "dlq_aging":
        result = evaluateDlqAging(
          new Date(String(input.enteredAt)),
          (input.reason as string) || null,
          Number(input.ageThresholdDays ?? 7),
        );
        break;
      case "walker_budget":
        result = evaluateWalkerBudget(
          Number(input.dailySpend ?? 0),
          Number(input.dailyBudgetUsd ?? 50),
        );
        break;
      default:
        return new Response(JSON.stringify({ error: "unknown rule" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, rule, input, result, dry: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
