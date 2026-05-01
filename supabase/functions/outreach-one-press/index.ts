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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface RunInput {
  trades: string[];
  cities: string[];
  channels?: ("email" | "sms")[];
  max_prospects?: number;
  min_quality_score?: number;
  state?: string;
  resume_run_id?: string;
}

function dwaEmailWrap(bodyHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#0a1628">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid #00d4ff">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">LOCAL HOMEOWNER LEADS · EXCLUSIVE</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:11px">Detroit Web Agency · Grosse Pointe Park, MI 48230 · (313) 992-1219</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="${unsubUrl}" style="color:#4a6fa5;text-decoration:underline">Unsubscribe</a> — one click, instant removal</p>
  </div>
</div></body></html>`;
}

function buildCampaignBody(opts: { businessName: string; trade: string; city: string; state: string }): string {
  const greeting = opts.businessName ? `Hi ${opts.businessName} team,` : "Hi there,";
  const stateLabel = opts.state !== "MI" ? `, ${opts.state}` : "";
  return `
    <p style="margin:0 0 16px"><strong style="color:#00d4ff">${greeting}</strong></p>
    <p style="margin:0 0 16px">I'm Matt Michels with Detroit Web Agency. We generate exclusive homeowner leads for <strong>${opts.trade} contractors</strong> in <strong>${opts.city}${stateLabel}</strong>.</p>
    <div style="background:#0f2540;border-left:3px solid #00d4ff;padding:14px 18px;margin:0 0 18px;border-radius:4px">
      <div style="color:#00d4ff;font-size:11px;letter-spacing:2px;font-weight:700;margin-bottom:8px">WHAT YOU GET</div>
      <ul style="margin:0;padding-left:18px;color:#e2e8f0;font-size:14px;line-height:1.8">
        <li>Homeowner name, phone, email &amp; full project description</li>
        <li>Exclusive — not shared with other contractors</li>
        <li>Local homeowners who submitted a request this week</li>
        <li>Refunded if duplicate or junk — no questions asked</li>
      </ul>
    </div>
    <p style="margin:0 0 16px"><strong style="color:#ffffff">$399/month</strong> for up to 10 leads · or <strong style="color:#ffffff">$59/lead</strong> pay-as-you-go · No long-term contract.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="https://detroitwebagent.com/contractor-leads" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:6px;font-weight:800;text-decoration:none;letter-spacing:1px;font-size:14px">SEE AVAILABLE LEADS →</a>
    </div>
    <p style="margin:18px 0 0;font-size:13px;color:#94a3b8">Reply to this email or call (313) 992-1219 and I'll show you exactly what leads are available in ${opts.city} right now.</p>
    <p style="margin:14px 0 0;font-size:12px;color:#64748b">— Matt Michels<br>Detroit Web Agency</p>
  `;
}

async function invokeFn(name: string, body: unknown): Promise<{ ok: boolean; data: any; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Both headers are required: apikey gates the gateway, Authorization carries the service-role JWT
        "apikey": SUPABASE_SERVICE_KEY,
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

// Metro Detroit fallback ring — used if the chosen city scrapes 0 contractors
const FALLBACK_CITIES = ["Detroit", "Warren", "Sterling Heights", "Livonia", "Dearborn", "Troy", "Southfield", "Royal Oak", "Farmington Hills", "Novi"];

async function runOrchestration(runId: string, input: RunInput) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { trades, cities, channels = ["email"], max_prospects = 50, min_quality_score = 50, state = "MI" } = input;

  const update = async (patch: Record<string, unknown>) => {
    await supabase.from("outreach_one_press_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);
  };

  try {
    await update({ status: "running", stage: "scraping", started_at: new Date().toISOString() });

    // STAGE 1 — scrape across trade × city matrix, with auto fallback to Metro Detroit ring
    let scrapedTotal = 0;
    const scrapeErrors: string[] = [];
    const triedCities = new Set<string>();
    const perCityCap = Math.max(5, Math.ceil(max_prospects / Math.max(1, trades.length * cities.length)));

    async function scrapeCityList(cityList: string[]): Promise<number> {
      let added = 0;
      for (const trade of trades) {
        for (const city of cityList) {
          if (scrapedTotal >= max_prospects) break;
          if (triedCities.has(`${trade}|${city}`)) continue;
          triedCities.add(`${trade}|${city}`);
          const r = await invokeFn("contractor-outreach-scrape", { trade, city, state, limit: perCityCap });
          if (r.ok) {
            const found = Number(r.data?.scanned || 0);
            scrapedTotal += found; added += found;
          } else {
            scrapeErrors.push(`${trade}/${city}: ${r.error}`);
          }
          await update({ scraped_count: scrapedTotal, stage_progress: { scrape_errors: scrapeErrors.slice(-5), tried: Array.from(triedCities).slice(-10) } });
        }
      }
      return added;
    }

    await scrapeCityList(cities);

    // Self-heal #1 — if nothing was scraped, expand to the Metro Detroit ring
    if (scrapedTotal === 0) {
      const expanded = FALLBACK_CITIES.filter(c => !cities.includes(c));
      if (expanded.length) {
        await update({ stage_progress: { fallback: "expanding to Metro Detroit ring", tried: cities, expanded } });
        await scrapeCityList(expanded);
      }
    }

    // STAGE 2 — enrich freshly scraped prospects (those without enriched_at)
    await update({ stage: "enriching" });
    const allCities = Array.from(new Set([...cities, ...FALLBACK_CITIES]));
    const { data: toEnrich } = await supabase
      .from("contractor_outreach_prospects")
      .select("id")
      .is("enriched_at", null)
      .in("trade", trades)
      .in("city", allCities)
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

    // STAGE 3 — count eligible at requested threshold; if 0, drop threshold to surface what's available
    await update({ stage: "scoring" });
    let effectiveQuality = min_quality_score;
    let { count: scoredCount } = await supabase
      .from("contractor_outreach_prospects")
      .select("id", { count: "exact", head: true })
      .gte("quality_score", effectiveQuality)
      .is("unsubscribed_at", null)
      .in("trade", trades)
      .in("city", allCities);

    if ((scoredCount || 0) === 0 && effectiveQuality > 25) {
      effectiveQuality = 25; // graceful degrade so a real run can ship
      const fallback = await supabase
        .from("contractor_outreach_prospects")
        .select("id", { count: "exact", head: true })
        .gte("quality_score", effectiveQuality)
        .is("unsubscribed_at", null)
        .in("trade", trades)
        .in("city", allCities);
      scoredCount = fallback.count || 0;
      await update({ stage_progress: { quality_fallback: `dropped threshold to ${effectiveQuality}` } });
    }
    await update({ scored_count: scoredCount || 0 });


    // STAGE 4 — enqueue eligible prospects to outreach_send_queue, then trigger the worker.
    // The queue gives us retries, backoff, suppression re-checks, and observability.
    await update({ stage: "sending" });
    let queuedTotal = 0;
    let sentTotal = 0;
    let failedTotal = 0;
    const sendErrors: string[] = [];

    if (channels.includes("email")) {
      const { data: targets } = await supabase
        .from("contractor_outreach_prospects")
        .select("id, business_name, trade, city, state, email, email_send_count")
        .in("trade", trades)
        .in("city", allCities)
        .gte("quality_score", effectiveQuality)
        .not("email", "is", null)
        .is("unsubscribed_at", null)
        .order("last_emailed_at", { ascending: true, nullsFirst: true })
        .limit(max_prospects);

      const queueRows: any[] = [];
      for (const p of (targets || [])) {
        const trade = p.trade || trades[0] || "Contractor";
        const city = p.city || cities[0] || "Detroit";
        const unsubUrl = `${SUPABASE_URL}/functions/v1/contractor-outreach-unsubscribe?id=${p.id}`;
        const html = dwaEmailWrap(
          buildCampaignBody({ businessName: p.business_name, trade, city, state: p.state || state }),
          unsubUrl,
        );
        const subject = `${city} homeowner leads for ${trade.toLowerCase()} contractors — available now`;
        queueRows.push({
          channel: "email",
          prospect_id: p.id,
          source_run_id: runId,
          priority: 6,
          payload: {
            to: p.email,
            subject,
            html,
            from: "Matt Michels <matt@detroitwebagent.com>",
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>, <mailto:matt@detroitwebagent.com?subject=Unsubscribe>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          },
        });
      }

      if (queueRows.length > 0) {
        const { data: inserted, error: qErr } = await supabase
          .from("outreach_send_queue")
          .upsert(queueRows, { onConflict: "prospect_id,lead_id,channel", ignoreDuplicates: true })
          .select("id");
        if (qErr) {
          sendErrors.push(`enqueue: ${qErr.message}`);
          failedTotal += queueRows.length;
        } else {
          queuedTotal = inserted?.length || 0;
        }

        // Kick the worker once so the user sees activity quickly
        if (queuedTotal > 0) {
          const w = await invokeFn("outreach-queue-worker", { trigger: "one-press" });
          if (w.ok) {
            sentTotal = Number(w.data?.stats?.sent || 0);
            failedTotal += Number(w.data?.stats?.failed || 0);
          } else {
            sendErrors.push(`worker: ${w.error}`);
          }
        }
      }

      if ((targets || []).length === 0) {
        sendErrors.push(`No eligible prospects (quality ≥ ${effectiveQuality}, with email, in ${allCities.slice(0, 3).join(", ")}…). Try Auto-Blast on a real lead, or scrape more cities.`);
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

    const finalStatus = sendErrors.length > 0 && sentTotal === 0 && queuedTotal === 0 ? "failed" : "completed";
    await update({
      stage: "completed",
      status: finalStatus,
      sent_count: sentTotal,
      failed_count: failedTotal,
      error_message: finalStatus === "failed" ? sendErrors.slice(0, 3).join(" · ") : null,
      stage_progress: {
        send_errors: sendErrors.slice(-10),
        queued: queuedTotal,
        effective_quality: effectiveQuality,
        cities_used: allCities.slice(0, 10),
        scrape_errors: scrapeErrors.slice(-5),
      },
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

    let runId: string;
    if (body.resume_run_id) {
      // Resume mode — reset the existing row and re-run the orchestrator
      const { data: existing, error: loadErr } = await supabase
        .from("outreach_one_press_runs")
        .select("id, status")
        .eq("id", body.resume_run_id)
        .maybeSingle();
      if (loadErr || !existing) {
        throw new Error(`Resume failed: run ${body.resume_run_id} not found`);
      }
      const { error: resetErr } = await supabase
        .from("outreach_one_press_runs")
        .update({
          status: "queued",
          stage: "queued",
          error_message: null,
          completed_at: null,
        })
        .eq("id", body.resume_run_id);
      if (resetErr) throw new Error(`Resume reset failed: ${resetErr.message}`);
      runId = body.resume_run_id;
    } else {
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
      if (insertErr || !run) throw new Error(`Failed to create run: ${insertErr?.message}`);
      runId = run.id;
    }

    // Fire-and-forget orchestration; client watches realtime
    // @ts-ignore - EdgeRuntime is available in Supabase Edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runOrchestration(runId, body));
    } else {
      runOrchestration(runId, body);
    }

    return new Response(
      JSON.stringify({ ok: true, run_id: runId, resumed: !!body.resume_run_id }),
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
