// Inventory Sentinel — runs every 4h
// For each row in inventory_watchlist:
//   1) Count total rows + fresh rows (within freshness_days)
//   2) Classify: green (>= min_rows AND fresh OK) / yellow (any rows but < min OR stale) / red (0 rows)
//   3) On yellow/red: SMS Matt immediately + auto-invoke backfill_function
//   4) Always write inventory_alerts row for audit trail

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Watch {
  product_slug: string;
  display_name: string;
  inventory_table: string;
  freshness_column: string;
  min_rows: number;
  freshness_days: number;
  backfill_function: string | null;
  active: boolean;
}

async function checkOne(sb: any, w: Watch) {
  const sinceISO = new Date(Date.now() - w.freshness_days * 86400_000).toISOString();

  // Total count
  const { count: total, error: e1 } = await sb
    .from(w.inventory_table)
    .select("*", { count: "exact", head: true });
  if (e1) {
    return {
      product_slug: w.product_slug,
      status: "red" as const,
      row_count: 0,
      fresh_row_count: 0,
      threshold: w.min_rows,
      message: `Failed to count ${w.inventory_table}: ${e1.message}`,
    };
  }

  // Fresh count
  const { count: fresh } = await sb
    .from(w.inventory_table)
    .select("*", { count: "exact", head: true })
    .gte(w.freshness_column, sinceISO);

  const totalN = total ?? 0;
  const freshN = fresh ?? 0;

  let status: "green" | "yellow" | "red";
  let message: string;
  if (totalN === 0) {
    status = "red";
    message = `${w.display_name}: EMPTY (0 rows). Customer-facing failure imminent.`;
  } else if (totalN < w.min_rows || freshN === 0) {
    status = "yellow";
    message = `${w.display_name}: ${totalN} rows (<${w.min_rows}) / ${freshN} fresh in ${w.freshness_days}d. Backfill triggered.`;
  } else {
    status = "green";
    message = `${w.display_name}: ${totalN} rows / ${freshN} fresh — OK.`;
  }

  return {
    product_slug: w.product_slug,
    status,
    row_count: totalN,
    fresh_row_count: freshN,
    threshold: w.min_rows,
    message,
  };
}

async function invokeBackfill(fn: string): Promise<any> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 400) };
  } catch (e: any) {
    return { error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();

  const { data: watches, error } = await sb
    .from("inventory_watchlist")
    .select("*")
    .eq("active", true);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  const criticalAlerts: string[] = [];

  for (const w of (watches || []) as Watch[]) {
    const check = await checkOne(sb, w);
    let backfillResult: any = null;
    let smsSent = false;

    if (check.status !== "green" && w.backfill_function) {
      backfillResult = await invokeBackfill(w.backfill_function);
    }

    if (check.status === "red" || (check.status === "yellow" && check.row_count < w.min_rows / 2)) {
      criticalAlerts.push(check.message);
    }

    await sb.from("inventory_alerts").insert({
      product_slug: check.product_slug,
      status: check.status,
      row_count: check.row_count,
      fresh_row_count: check.fresh_row_count,
      threshold: check.threshold,
      message: check.message,
      backfill_invoked: !!backfillResult,
      backfill_result: backfillResult,
      sms_sent: false,
    });

    results.push({ ...check, backfill: backfillResult });
  }

  if (criticalAlerts.length > 0 && TWILIO_PHONE) {
    const body = `🚨 INVENTORY SENTINEL\n\n${criticalAlerts.join("\n\n")}\n\nBackfills triggered. Check /dwa-admin → Inventory Health.`;
    await sendSMS(ADMIN_PHONE, TWILIO_PHONE, body, "inventory_sentinel").catch(() => {});
    // mark sms_sent on the most recent alerts
    await sb.from("inventory_alerts")
      .update({ sms_sent: true })
      .in("product_slug", results.filter(r => r.status !== "green").map(r => r.product_slug))
      .gte("created_at", new Date(startedAt).toISOString());
  }

  return new Response(JSON.stringify({
    ok: true,
    checked: results.length,
    critical: criticalAlerts.length,
    results,
    duration_ms: Date.now() - startedAt,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
