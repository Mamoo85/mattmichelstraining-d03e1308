// dead-lead-pool-refresh — daily 7am ET cron
// Tops up dead_lead_master_pool from three internal sources so the dead-lead
// product never goes to 0. Respects per-FieldDesk-customer opt-in.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { shouldScanMore } from "../_shared/intake-throttle.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PoolCandidate {
  source: "field_service_jobs" | "marketplace_aged" | "contractor_uncontacted";
  business_name: string;
  phone: string | null;
  email: string | null;
  trade: string | null;
  signal_age_days: number;
  source_ref: string | null;
  tenant_id: string | null;
}

function dedupeKey(c: PoolCandidate): string {
  return [
    (c.business_name || "").trim().toLowerCase(),
    (c.phone || "").replace(/\D/g, ""),
    (c.email || "").trim().toLowerCase(),
  ].join("|");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();

  try {
    // Throttle gate — skip if pool already above target
    const gate = await shouldScanMore(sb, "dead_lead_pool");
    if (gate.skip) {
      return new Response(
        JSON.stringify({ skipped: true, reason: gate.reason, fresh: gate.fresh, target: gate.target }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const need = Math.max(0, gate.target - gate.fresh);
    const candidates: PoolCandidate[] = [];

    // SOURCE A — FieldDesk closed jobs aged >90d, opt-in customers only
    try {
      const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
      const { data: optedIn } = await sb
        .from("field_crm_clients" as any)
        .select("id")
        .eq("share_to_dead_lead_pool", true);
      const tenantIds = (optedIn || []).map((r: any) => r.id);
      if (tenantIds.length) {
        const { data: jobs } = await sb
          .from("field_service_jobs" as any)
          .select("id, customer_name, customer_phone, customer_email, service_type, completed_at, tenant_id")
          .in("tenant_id", tenantIds)
          .eq("status", "completed")
          .lt("completed_at", cutoff)
          .order("completed_at", { ascending: false })
          .limit(Math.min(200, need * 2));
        for (const j of (jobs || []) as any[]) {
          candidates.push({
            source: "field_service_jobs",
            business_name: j.customer_name || "Unknown",
            phone: j.customer_phone || null,
            email: j.customer_email || null,
            trade: j.service_type || null,
            signal_age_days: Math.round((Date.now() - new Date(j.completed_at).getTime()) / 86400_000),
            source_ref: j.id,
            tenant_id: j.tenant_id,
          });
        }
      }
    } catch (e) {
      console.warn("[pool-refresh] field_service_jobs source failed:", e instanceof Error ? e.message : e);
    }

    // SOURCE B — marketplace prospects aged out without sale (>60d)
    try {
      const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString();
      const { data: aged } = await sb
        .from("marketplace_prospects" as any)
        .select("id, business_name, phone, email, trade, created_at")
        .lt("created_at", cutoff)
        .in("status", ["unclaimed", "available"])
        .limit(Math.min(150, need * 2));
      for (const p of (aged || []) as any[]) {
        candidates.push({
          source: "marketplace_aged",
          business_name: p.business_name || "Unknown",
          phone: p.phone || null,
          email: p.email || null,
          trade: p.trade || null,
          signal_age_days: Math.round((Date.now() - new Date(p.created_at).getTime()) / 86400_000),
          source_ref: p.id,
          tenant_id: null,
        });
      }
    } catch (e) {
      console.warn("[pool-refresh] marketplace source failed:", e instanceof Error ? e.message : e);
    }

    // SOURCE C — contractor_leads never contacted, >45d old
    try {
      const cutoff = new Date(Date.now() - 45 * 86400_000).toISOString();
      const { data: stale } = await sb
        .from("contractor_leads" as any)
        .select("id, business_name, phone, email, trade, created_at, last_contacted_at")
        .lt("created_at", cutoff)
        .is("last_contacted_at", null)
        .limit(Math.min(150, need * 2));
      for (const l of (stale || []) as any[]) {
        candidates.push({
          source: "contractor_uncontacted",
          business_name: l.business_name || "Unknown",
          phone: l.phone || null,
          email: l.email || null,
          trade: l.trade || null,
          signal_age_days: Math.round((Date.now() - new Date(l.created_at).getTime()) / 86400_000),
          source_ref: l.id,
          tenant_id: null,
        });
      }
    } catch (e) {
      console.warn("[pool-refresh] contractor_leads source failed:", e instanceof Error ? e.message : e);
    }

    // Dedupe across sources + against existing pool
    const seen = new Set<string>();
    const fresh = candidates.filter((c) => {
      if (!c.business_name || c.business_name === "Unknown") return false;
      if (!c.phone && !c.email) return false; // need at least one contact channel
      const k = dedupeKey(c);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Existing pool dedupe (cheap: pull last 30 days of keys)
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: existing } = await sb
      .from("dead_lead_master_pool" as any)
      .select("business_name, phone, email")
      .gte("added_at", since);
    const existingKeys = new Set(
      ((existing || []) as any[]).map((e) =>
        [
          (e.business_name || "").trim().toLowerCase(),
          (e.phone || "").replace(/\D/g, ""),
          (e.email || "").trim().toLowerCase(),
        ].join("|")
      ),
    );
    const toInsert = fresh.filter((c) => !existingKeys.has(dedupeKey(c))).slice(0, need);

    let inserted = 0;
    if (toInsert.length) {
      const rows = toInsert.map((c) => ({
        business_name: c.business_name,
        phone: c.phone,
        email: c.email,
        trade: c.trade,
        source: c.source,
        source_ref: c.source_ref,
        tenant_id: c.tenant_id,
        signal_age_days: c.signal_age_days,
        status: "available",
      }));
      const { error, count } = await sb
        .from("dead_lead_master_pool" as any)
        .insert(rows, { count: "exact" });
      if (error) throw error;
      inserted = count || rows.length;
    }

    const ms = Date.now() - startedAt;
    if (inserted > 0) {
      await sb.from("system_comms_log").insert({
        product: "dead_lead_pool",
        status: "ok",
        channel: "cron",
        meta: { inserted, ms, candidates: candidates.length, target: gate.target, had: gate.fresh },
      });
    }
    if (gate.fresh < gate.target / 2 && inserted < 5) {
      // Pool still very low after refresh — alert Matt
      await sendSMS(
        ADMIN_PHONE,
        `Dead lead pool low: ${gate.fresh} fresh, target ${gate.target}, refresh added ${inserted}.`,
      );
    }

    return new Response(
      JSON.stringify({ inserted, candidates: candidates.length, target: gate.target, had: gate.fresh, ms }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pool-refresh] fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
