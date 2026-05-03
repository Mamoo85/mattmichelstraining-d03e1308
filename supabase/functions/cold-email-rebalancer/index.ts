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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";
const FLOOR = 150;

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
    const target = Number(body.target) || FLOOR;

    const sentToday = await countSentToday(sb);
    const gap = Math.max(0, target - sentToday);

    const pools = await getPoolStats(sb);
    // Total unique supply (outreach pool counted once across its 3 senders)
    const outreachSupply = pools.find(p => p.name === "multi_service")?.available || 0;
    const contractorSupply = pools.find(p => p.name === "contractor")?.available || 0;
    const techalertSupply = pools.find(p => p.name === "techalert")?.available || 0;
    const totalSupply = outreachSupply + contractorSupply + techalertSupply;

    if (gap === 0 && !force) {
      return new Response(JSON.stringify({
        ok: true, sentToday, gap: 0, target, message: "Floor already met", pools,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Pick non-empty pools to invoke. Each sender enforces its own per-run cap.
    const chosen = pools.filter(p => p.available > 0);

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

    // Supply early-warning: if total ready-to-send supply < remaining gap, scanners are behind
    const supplyShort = totalSupply < gap;
    if (supplyShort) {
      await sendSMS(
        ADMIN_PHONE,
        `🟡 SUPPLY LOW: only ${totalSupply} ready-to-send leads vs gap of ${gap}. ` +
        `Pools — outreach:${outreachSupply} contractor:${contractorSupply} techalert:${techalertSupply}. ` +
        `Triggering scanners next cycle.`,
      ).catch(() => {});

      // Auto-trigger scanners + enrichment to refill
      await Promise.all([
        sb.functions.invoke("techalert-prospect-hunter", { body: {} }).catch(() => {}),
        sb.functions.invoke("contractor-prospector", { body: {} }).catch(() => {}),
        sb.functions.invoke("prospect-local-businesses", { body: { discoverOnly: true } }).catch(() => {}),
        sb.functions.invoke("outreach-leads-enrich", { body: { batch: 50 } }).catch(() => {}),
        sb.functions.invoke("contractor-outreach-statewide-enrich", { body: { batch: 50 } }).catch(() => {}),
      ]);
    }

    return new Response(JSON.stringify({
      ok: true, sentToday, gap, target, totalSupply, supplyShort,
      pools, invoked: results,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendSMS(ADMIN_PHONE, `Cold email rebalancer ERROR: ${msg}`).catch(() => {});
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
