// outreach-one-press: single-button orchestrator that runs Scrape → Enrich → Send.
// Updates `outreach_one_press_runs` after each stage so the admin UI gets live
// progress via Supabase Realtime (no polling required).
//
// Invocation: POST { trades: string[], cities: string[], channels?: ('email'|'sms')[],
//                    max_prospects?: number, min_quality_score?: number }
// Returns: { ok: true, run_id }
//
// The orchestrator runs work in the background after responding, so the client
// returns immediately and watches the realtime channel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RunInput {
  trades: string[];
  cities: string[];
  channels?: ("email" | "sms")[];
  max_prospects?: number;
  min_quality_score?: number;
  state?: string;
}

async function invokeFn(name: string, body: unknown): Promise<{ ok: boolean; data: any; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) return { ok: false, data, error: `${name} ${res.status}: ${text.slice(0, 300)}` };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runOrchestration(runId: string, input: RunInput) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { trades, cities, channels = ["email"], max_prospects = 50, min_quality_score = 50, state = "MI" } = input;

  const update = async (patch: Record<string, unknown>) => {
    await supabase.from("outreach_one_press_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);
  };

  try {
    await update({ status: "running", stage: "scraping", started_at: new Date().toISOString() });

    // STAGE 1 — scrape across trade × city matrix
    let scrapedTotal = 0;
    const scrapeErrors: string[] = [];
    const perCityCap = Math.max(5, Math.ceil(max_prospects / Math.max(1, trades.length * cities.length)));
    for (const trade of trades) {
      for (const city of cities) {
        if (scrapedTotal >= max_prospects) break;
        const r = await invokeFn("contractor-outreach-scrape", { trade, city, state, limit: perCityCap });
        if (r.ok && r.data?.inserted) scrapedTotal += Array.isArray(r.data.inserted) ? r.data.inserted.length : Number(r.data.inserted) || 0;
        else if (!r.ok) scrapeErrors.push(`${trade}/${city}: ${r.error}`);
        await update({ scraped_count: scrapedTotal, stage_progress: { scrape_errors: scrapeErrors.slice(-5) } });
      }
    }

    // STAGE 2 — enrich freshly scraped prospects (those without enriched_at)
    await update({ stage: "enriching" });
    const { data: toEnrich } = await supabase
      .from("contractor_outreach_prospects")
      .select("id")
      .is("enriched_at", null)
      .in("trade", trades)
      .in("city", cities)
      .order("created_at", { ascending: false })
      .limit(max_prospects);

    let enrichedTotal = 0;
    const enrichErrors: string[] = [];
    for (const p of (toEnrich || [])) {
      const r = await invokeFn("contractor-outreach-enrich", { prospect_id: p.id });
      if (r.ok) enrichedTotal++;
      else enrichErrors.push(`${p.id}: ${r.error}`);
      if (enrichedTotal % 5 === 0) {
        await update({ enriched_count: enrichedTotal, stage_progress: { enrich_errors: enrichErrors.slice(-5) } });
      }
    }
    await update({ enriched_count: enrichedTotal, stage_progress: { enrich_errors: enrichErrors.slice(-5) } });

    // STAGE 3 — quality scoring is automatic via DB trigger; just count eligible
    await update({ stage: "scoring" });
    const { count: scoredCount } = await supabase
      .from("contractor_outreach_prospects")
      .select("id", { count: "exact", head: true })
      .gte("quality_score", min_quality_score)
      .is("unsubscribed_at", null)
      .in("trade", trades)
      .in("city", cities);
    await update({ scored_count: scoredCount || 0 });

    // STAGE 4 — send via configured channels
    await update({ stage: "sending" });
    let sentTotal = 0;
    let failedTotal = 0;
    const sendErrors: string[] = [];

    if (channels.includes("email")) {
      const r = await invokeFn("contractor-outreach-email-blast", {
        trades, cities, min_quality_score, max_sends: max_prospects,
      });
      if (r.ok) {
        sentTotal += Number(r.data?.sent || 0);
        failedTotal += Number(r.data?.failed || 0);
      } else {
        sendErrors.push(`email: ${r.error}`);
        failedTotal++;
      }
    }
    if (channels.includes("sms")) {
      const r = await invokeFn("contractor-outreach-sms-send", {
        trades, cities, min_quality_score, max_sends: max_prospects,
      });
      if (r.ok) {
        sentTotal += Number(r.data?.sent || 0);
        failedTotal += Number(r.data?.failed || 0);
      } else {
        sendErrors.push(`sms: ${r.error}`);
        failedTotal++;
      }
    }

    await update({
      stage: "completed",
      status: "completed",
      sent_count: sentTotal,
      failed_count: failedTotal,
      stage_progress: { send_errors: sendErrors },
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[one-press] fatal:", msg);
    await supabase.from("outreach_one_press_runs").update({
      status: "failed",
      stage: "failed",
      error_message: msg,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as RunInput;
    if (!body.trades?.length || !body.cities?.length) {
      return new Response(
        JSON.stringify({ error: "trades and cities arrays are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: run, error: insertErr } = await supabase
      .from("outreach_one_press_runs")
      .insert({
        trades: body.trades,
        cities: body.cities,
        channels: body.channels || ["email"],
        max_prospects: body.max_prospects || 50,
        min_quality_score: body.min_quality_score || 50,
        status: "queued",
        stage: "queued",
      })
      .select("id")
      .single();

    if (insertErr || !run) {
      throw new Error(`Failed to create run: ${insertErr?.message}`);
    }

    // Fire-and-forget orchestration; client watches realtime
    // EdgeRuntime.waitUntil keeps the worker alive after we respond
    // @ts-ignore - EdgeRuntime is available in Supabase Edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runOrchestration(run.id, body));
    } else {
      runOrchestration(run.id, body);
    }

    return new Response(
      JSON.stringify({ ok: true, run_id: run.id }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[one-press] handler error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
