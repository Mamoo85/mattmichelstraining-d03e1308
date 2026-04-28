// Sprint K — Nightly E2E health canary.
// Hits the unified enrichment waterfall with a known-good fixture and verifies
// the response shape is sane. Writes results to enrichment_e2e_runs so the
// admin observability UI can surface "last green run" and trigger alerts when
// canaries fail N times in a row.
//
// Cron: schedule via pg_cron at 3am ET nightly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Known-good seed: a real Michigan contractor with a website that has
// historically resolved to at least one provider. We do NOT write the result
// to the live prospects table — this is a pure read-only health check.
const CANARY_FIXTURE = {
  business_name: "Belfor Property Restoration",
  website: "https://www.belfor.com",
  city: "Birmingham",
  state: "MI",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const runId = crypto.randomUUID();

  let status: "pass" | "fail" | "degraded" = "fail";
  let errorMsg: string | null = null;
  let waterfallResult: Record<string, unknown> = {};

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-enrichment-waterfall`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ mode: "dry_run", ...CANARY_FIXTURE }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      errorMsg = `waterfall returned ${res.status}`;
      await res.body?.cancel();
    } else {
      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        errorMsg = "waterfall returned non-object response";
      } else {
        waterfallResult = json;
        // Pass criteria: response has expected shape (trace array OR email/phone)
        const hasTrace = Array.isArray((json as any).trace);
        const hasContact = !!(json as any).email || !!(json as any).phone;
        if (hasContact) status = "pass";
        else if (hasTrace) status = "degraded";
        else errorMsg = "waterfall response shape unrecognized";
      }
    }
  } catch (e) {
    errorMsg = String(e).slice(0, 500);
  }

  const durationMs = Date.now() - startedAt;

  // Persist run regardless of outcome
  await sb.from("enrichment_e2e_runs").insert({
    id: runId,
    status,
    duration_ms: durationMs,
    error: errorMsg,
    fixture: CANARY_FIXTURE,
    result: waterfallResult,
  });

  // Check for alert: 3 consecutive non-pass runs
  if (status !== "pass") {
    const { data: recent } = await sb
      .from("enrichment_e2e_runs")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(3);
    const allBad = (recent?.length ?? 0) >= 3 && recent!.every((r) => r.status !== "pass");
    if (allBad) {
      await sb.from("outreach_alerts_log").insert({
        alert_type: "e2e_canary_failing",
        severity: "high",
        message: `Enrichment canary has failed 3 runs in a row. Last error: ${errorMsg ?? "n/a"}`,
        meta: { last_run_id: runId, fixture: CANARY_FIXTURE },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, run_id: runId, status, duration_ms: durationMs, error: errorMsg }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
