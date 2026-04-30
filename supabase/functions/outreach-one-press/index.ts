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
        // use scanned (total found) not inserted (new only) so count updates even when all are duplicates
        if (r.ok) scrapedTotal += Number(r.data?.scanned || 0);
        else scrapeErrors.push(`${trade}/${city}: ${r.error}`);
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

    // STAGE 4 — send via configured channels (inline campaign send)
    await update({ stage: "sending" });
    let sentTotal = 0;
    let failedTotal = 0;
    const sendErrors: string[] = [];

    if (channels.includes("email") && RESEND_API_KEY) {
      // Query eligible prospects across all trade×city combos
      const { data: targets } = await supabase
        .from("contractor_outreach_prospects")
        .select("*")
        .in("trade", trades)
        .in("city", cities)
        .gte("quality_score", min_quality_score)
        .not("email", "is", null)
        .is("unsubscribed_at", null)
        .order("last_emailed_at", { ascending: true, nullsFirst: true })
        .limit(max_prospects);

      for (const p of (targets || [])) {
        try {
          const trade = p.trade || trades[0] || "Contractor";
          const city = p.city || cities[0] || "Detroit";
          const unsubUrl = `${SUPABASE_URL}/functions/v1/contractor-outreach-unsubscribe?id=${p.id}`;
          const html = dwaEmailWrap(buildCampaignBody({ businessName: p.business_name, trade, city, state: p.state || state }), unsubUrl);
          const subject = `${city} homeowner leads for ${trade.toLowerCase()} contractors — available now`;

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@detroitwebagent.com>",
              to: [p.email],
              subject,
              html,
              headers: {
                "List-Unsubscribe": `<${unsubUrl}>, <mailto:matt@detroitwebagent.com?subject=Unsubscribe>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }),
          });

          if (res.ok) {
            sentTotal++;
            await supabase.from("contractor_outreach_prospects")
              .update({ last_emailed_at: new Date().toISOString(), email_send_count: (p.email_send_count || 0) + 1 })
              .eq("id", p.id);
            await supabase.from("contractor_outreach_audit_log").insert({
              prospect_id: p.id, channel: "email", event: "sent",
              reason: subject,
              metadata: { source: "one-press", run_id: runId },
            }).catch(() => {});
          } else {
            failedTotal++;
            const t = await res.text();
            sendErrors.push(`${p.email}: ${t.slice(0, 120)}`);
          }
        } catch (e) {
          failedTotal++;
          sendErrors.push(`${p.email}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else if (channels.includes("email") && !RESEND_API_KEY) {
      sendErrors.push("RESEND_API_KEY not configured");
      failedTotal++;
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
