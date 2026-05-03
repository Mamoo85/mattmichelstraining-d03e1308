// cold-email-rebalancer
// Hourly orchestrator that guarantees we hit the 150-email/day floor by
// fanning out across senders weighted by available lead supply.
//
// Logic:
//  1. Count today's distinct cold-email sends from email_send_log
//  2. Compute remaining gap = max(0, FLOOR - sent_today)
//  3. Inventory each product's "ready-to-send" pool (has email, never contacted)
//  4. Skip empty pools, route remaining quota to non-empty senders
//  5. Invoke each chosen sender once
//  6. SMS Matt if total available supply across ALL pools < remaining gap
//     (means scanners/enrichment haven't refilled fast enough)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { evaluateBreaker, getActiveBreaker } from "../_shared/enrichment-breaker.ts";
import { isFrugalMode } from "../_shared/enrichment-budget.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";
const FLOOR = 150;

// Per-provider scaling: each provider has its own baseline + ceiling.
const PROVIDER_BUDGETS = [
  { key: "apollo_daily_budget_usd",    max_key: "apollo_max_budget_usd",    base: 30, hard_max: 120, label: "Apollo" },
  { key: "hunter_daily_budget_usd",    max_key: "hunter_max_budget_usd",    base: 15, hard_max: 60,  label: "Hunter" },
  { key: "firecrawl_daily_budget_usd", max_key: "firecrawl_max_budget_usd", base: 5,  hard_max: 20,  label: "Firecrawl" },
];

const COLD_TEMPLATES = [
  "cold_outreach",
  "multi_service_pitch_1", "multi_service_pitch_2", "multi_service_pitch_3",
  "web_drip_d1", "web_drip_d4", "web_drip_d8", "web_drip_d15",
  "techalert_cold_outreach", "techalert_cold_d0",
  "techalert_followup_d3", "techalert_followup_d7", "techalert_followup_d14",
  "contractor_drip_d0", "contractor_drip_d3", "contractor_drip_d7", "contractor_drip_d14",
  "dossier_cold_outreach",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PoolName = "multi_service" | "web_design" | "contractor" | "techalert" | "local_business";

interface PoolStat {
  name: PoolName;
  fn: string;
  available: number;
}

async function getPoolStats(sb: any): Promise<PoolStat[]> {
  // Pool A: outreach_leads with email but never contacted (multi-service-drip + web-design-drip both consume this)
  const { count: outreachUnsent } = await sb
    .from("outreach_leads")
    .select("id", { count: "exact", head: true })
    .or("enriched_email.not.is.null,validated_email.not.is.null,email.not.is.null")
    .is("last_contact_date", null);

  // Pool B: contractor_outreach_prospects
  const { count: contractorUnsent } = await sb
    .from("contractor_outreach_prospects")
    .select("id", { count: "exact", head: true })
    .not("email", "is", null)
    .is("last_emailed_at", null)
    .is("suppressed_at", null);

  // Pool C: hire_alert_candidates ready for cold outreach (TechAlert)
  const { count: techalertUnsent } = await sb
    .from("hire_alert_candidates")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "enriched");

  // outreach_leads is shared by 3 senders; split it for visibility but invoke all 3
  const outreach = outreachUnsent ?? 0;
  const contractor = contractorUnsent ?? 0;
  const techalert = techalertUnsent ?? 0;

  return [
    { name: "multi_service", fn: "multi-service-drip", available: outreach },
    { name: "web_design", fn: "web-design-drip", available: outreach },
    { name: "local_business", fn: "prospect-local-businesses", available: outreach },
    { name: "contractor", fn: "contractor-prospector", available: contractor },
    { name: "techalert", fn: "techalert-outreach", available: techalert },
  ];
}

async function countSentToday(sb: any): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await sb
    .from("email_send_log")
    .select("message_id")
    .in("template_name", COLD_TEMPLATES)
    .eq("status", "sent")
    .gte("created_at", `${today}T00:00:00Z`);
  if (error) return 0;
  return new Set((data || []).map((r: any) => r.message_id).filter(Boolean)).size;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const dryRun = body.dry_run === true || body.preview === true;
    const target = Number(body.target) || FLOOR;

    const sentToday = await countSentToday(sb);
    const gap = Math.max(0, target - sentToday);

    const pools = await getPoolStats(sb);
    // Total unique supply (outreach pool counted once across its 3 senders)
    const outreachSupply = pools.find(p => p.name === "multi_service")?.available || 0;
    const contractorSupply = pools.find(p => p.name === "contractor")?.available || 0;
    const techalertSupply = pools.find(p => p.name === "techalert")?.available || 0;
    const totalSupply = outreachSupply + contractorSupply + techalertSupply;
    const supplyShort = totalSupply < gap;

    // ── MRR-vs-spend gate: force frugal ON if cold-email MRR < 30d spend ─────
    const { data: econ } = await sb
      .from("cold_email_economics_today")
      .select("spend_30d_cents, mrr_attributed_cents, mrr_covers_spend")
      .maybeSingle();
    const mrrCovers = !!econ?.mrr_covers_spend;
    let frugal = await isFrugalMode(sb);
    if (!mrrCovers && !frugal) {
      // Force ON
      await sb.from("enrichment_walker_config").upsert(
        { key: "frugal_mode", value_text: "true" },
        { onConflict: "key" },
      );
      frugal = true;
    }

    if (gap === 0 && !force) {
      return new Response(JSON.stringify({
        ok: true, sentToday, gap: 0, target, message: "Floor already met", pools,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Pick non-empty pools to invoke. Each sender enforces its own per-run cap.
    const chosen = pools.filter(p => p.available > 0);

    // Build allocation plan: weight by available supply, capped by remaining gap
    const totalAvail = chosen.reduce((s, p) => s + p.available, 0) || 1;
    const plan = chosen.map(p => ({
      fn: p.fn,
      pool: p.name,
      available: p.available,
      planned_send: Math.min(p.available, Math.ceil((p.available / totalAvail) * gap)),
    }));

    if (dryRun) {
      return new Response(JSON.stringify({
        ok: true, dry_run: true, sentToday, gap, target, totalSupply,
        supplyShort: totalSupply < gap, pools, plan,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const results = await Promise.all(chosen.map(async (p) => {
      try {
        const { data, error } = await sb.functions.invoke(p.fn, {
          body: { force: true, rebalanced: true },
        });
        return { fn: p.fn, pool: p.name, available: p.available, ok: !error, error: error?.message, data };
      } catch (e) {
        return { fn: p.fn, pool: p.name, available: p.available, ok: false, error: String(e) };
      }
    }));

    // ── Safety circuit breaker — evaluate before any scale-up ──────────────
    const breakerEval = await evaluateBreaker(sb).catch((e) => {
      console.error("breaker eval failed", e);
      return { tripped: false, details: { error: String(e) } };
    });
    const activeBreaker = await getActiveBreaker(sb);
    const breakerBlocked = activeBreaker.tripped || breakerEval.tripped;

    if (breakerEval.tripped) {
      await sendSMS(
        ADMIN_PHONE,
        `🛑 ENRICHMENT CIRCUIT TRIPPED: ${breakerEval.reason} ` +
        `(${(breakerEval.metric_value || 0).toFixed?.(2) ?? breakerEval.metric_value} > ${breakerEval.threshold}). ` +
        `Budget frozen. Reset in 6h or manually clear.`,
      ).catch(() => {});
    }

    let budgetScaled: any = null;
    if (supplyShort && !breakerBlocked) {
      // ── Auto-scale per-provider daily budgets ──────────────────────────
      try {
        const shortfallRatio = gap > 0 ? (gap - totalSupply) / gap : 0; // 0..1
        const multiplier = 1 + Math.min(2, Math.max(0.5, shortfallRatio * 3));
        const changes: Array<{ label: string; from: number; to: number }> = [];

        const { data: cfg } = await sb
          .from("enrichment_walker_config")
          .select("key, value_numeric")
          .in("key", PROVIDER_BUDGETS.flatMap(p => [p.key, p.max_key]));
        const cfgMap = new Map<string, number>((cfg || []).map((r: any) => [r.key, Number(r.value_numeric)]));

        for (const pb of PROVIDER_BUDGETS) {
          const current = cfgMap.get(pb.key) ?? pb.base;
          const ceiling = cfgMap.get(pb.max_key) ?? pb.hard_max;
          const next = Math.min(ceiling, Math.round(current * multiplier));
          if (next > current) {
            await sb.from("enrichment_walker_config").upsert({
              key: pb.key, value_numeric: next,
            }, { onConflict: "key" });
            changes.push({ label: pb.label, from: current, to: next });
          }
        }

        if (changes.length) {
          budgetScaled = { changes, multiplier: multiplier.toFixed(2), shortfallRatio: shortfallRatio.toFixed(2) };
        }
      } catch (e) {
        console.error("budget scale failed", e);
      }

      const scaleSummary = budgetScaled?.changes?.length
        ? budgetScaled.changes.map((c: any) => `${c.label} $${c.from}→$${c.to}`).join(", ")
        : "no scale (caps reached)";

      await sendSMS(
        ADMIN_PHONE,
        `🟡 SUPPLY LOW: ${totalSupply} ready vs gap ${gap}. ` +
        `Pools — outreach:${outreachSupply} contractor:${contractorSupply} techalert:${techalertSupply}. ` +
        `${scaleSummary}. Triggering scanners + enrichment.`,
      ).catch(() => {});

      const enrichBatch = budgetScaled ? 100 : 50;
      await Promise.all([
        sb.functions.invoke("techalert-prospect-hunter", { body: {} }).catch(() => {}),
        sb.functions.invoke("contractor-prospector", { body: {} }).catch(() => {}),
        sb.functions.invoke("prospect-local-businesses", { body: { discoverOnly: true } }).catch(() => {}),
        sb.functions.invoke("outreach-leads-enrich", {
          body: { batch: enrichBatch, triggered_by: "rebalancer", target_gap: gap },
        }).catch(() => {}),
        sb.functions.invoke("contractor-outreach-statewide-enrich", { body: { batch: enrichBatch } }).catch(() => {}),
        sb.functions.invoke("enrichment-matrix-walker", { body: {} }).catch(() => {}),
      ]);
    } else if (supplyShort && breakerBlocked) {
      // Breaker is tripped — do not scale, do not burst enrichment
      console.log("[rebalancer] supply short but breaker blocked, skipping enrichment burst");
    } else {
      // ── Auto-decay each provider budget back toward baseline ───────────
      try {
        const { data: cfg } = await sb
          .from("enrichment_walker_config")
          .select("key, value_numeric")
          .in("key", PROVIDER_BUDGETS.map(p => p.key));
        const cfgMap = new Map<string, number>((cfg || []).map((r: any) => [r.key, Number(r.value_numeric)]));
        const decayed: any[] = [];
        for (const pb of PROVIDER_BUDGETS) {
          const current = cfgMap.get(pb.key) ?? pb.base;
          if (current > pb.base && totalSupply > gap * 2) {
            const next = Math.max(pb.base, Math.round(current * 0.85));
            if (next < current) {
              await sb.from("enrichment_walker_config").upsert({
                key: pb.key, value_numeric: next,
              }, { onConflict: "key" });
              decayed.push({ label: pb.label, from: current, to: next });
            }
          }
        }
        if (decayed.length) budgetScaled = { decayed };
      } catch (_) { /* best effort */ }
    }

    return new Response(JSON.stringify({
      ok: true, sentToday, gap, target, totalSupply, supplyShort,
      breakerBlocked, breaker: breakerEval, activeBreaker,
      budgetScaled, pools, plan, invoked: results,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendSMS(ADMIN_PHONE, `Cold email rebalancer ERROR: ${msg}`).catch(() => {});
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
