// Consolidated system audit: Stripe reconcile + dead edge functions + customer health + mortgage radar live data
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "npm:stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// product slug -> client table mapping (only the live ones we provision)
const PRODUCT_TABLE_MAP: Record<string, string> = {
  contractor_lead: "contractor_clients",
  hire_alert: "hire_alert_clients",
  field_service: "field_crm_clients",
  field_crm: "field_crm_clients",
  missed_call: "missed_call_clients",
  mortgage_radar: "mortgage_radar_clients",
  trade_radar: "trade_radar_clients",
  site_radar: "field_crm_clients",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

  const result: any = { ts: new Date().toISOString() };

  // ─── 1. Stripe reconciliation ──────────────────────────────────────
  try {
    const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
    const orphans: any[] = [];
    for (const sub of subs.data) {
      const meta = sub.metadata || {};
      const type = (meta.type as string)?.replace(/_subscription$/, "");
      const table = type ? PRODUCT_TABLE_MAP[type] : null;
      if (!table) continue;
      const cust = sub.customer as string;
      const customer = await stripe.customers.retrieve(cust);
      const email = (customer as any).email;
      if (!email) continue;
      const { data: row } = await sb.from(table).select("id").eq("email", email).maybeSingle();
      if (!row) orphans.push({ sub_id: sub.id, email, product: type, table, created: sub.created });
    }
    result.stripe_reconcile = { active_subs: subs.data.length, orphans };
  } catch (e) {
    result.stripe_reconcile = { error: String(e) };
  }

  // ─── 2. Dead edge functions (no recent invocations) ──────────────────
  try {
    const { data: usage } = await sb.rpc("get_function_invocation_counts" as any).then(
      (r) => ({ data: r.data })
    ).catch(() => ({ data: null }));
    result.dead_functions = {
      note: "Use Supabase analytics_query for full scan; tracked in error_logs absence",
      tracked: usage || null,
    };
  } catch (e) {
    result.dead_functions = { error: String(e) };
  }

  // ─── 3. Customer health scoring ──────────────────────────────────────
  try {
    const health: any[] = [];
    const checks = [
      { table: "contractor_clients", leadTable: "contractor_leads", fk: "client_id", label: "Contractor Leads" },
      { table: "mortgage_radar_clients", leadTable: "mortgage_radar_leads", fk: null, label: "Mortgage Radar" },
      { table: "trade_radar_clients", leadTable: "trade_radar_leads", fk: null, label: "Trade Radar" },
      { table: "hire_alert_clients", leadTable: "hire_alert_candidates", fk: "client_id", label: "TechAlert" },
    ];
    for (const c of checks) {
      const { data: clients } = await sb.from(c.table).select("id, email, business_name, created_at").limit(50);
      for (const client of clients || []) {
        let leadCount = 0;
        if (c.fk) {
          const { count } = await sb.from(c.leadTable).select("*", { count: "exact", head: true })
            .eq(c.fk, (client as any).id)
            .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
          leadCount = count || 0;
        } else {
          // shared pool — count last 7d
          const { count } = await sb.from(c.leadTable).select("*", { count: "exact", head: true })
            .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
          leadCount = count || 0;
        }
        const ageDays = Math.floor((Date.now() - new Date((client as any).created_at).getTime()) / 86400000);
        const risk = leadCount === 0 && ageDays > 7 ? "high" : leadCount < 3 && ageDays > 14 ? "medium" : "low";
        if (risk !== "low") {
          health.push({
            product: c.label,
            client_id: (client as any).id,
            email: (client as any).email,
            business_name: (client as any).business_name,
            age_days: ageDays,
            leads_last_7d: leadCount,
            risk,
          });
        }
      }
    }
    result.customer_health = { at_risk: health };
  } catch (e) {
    result.customer_health = { error: String(e) };
  }

  // ─── 4. Mortgage Radar live data audit ──────────────────────────────
  try {
    const { data: bySrc } = await sb.rpc("execute_sql" as any).catch(() => ({ data: null }));
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: leads } = await sb
      .from("mortgage_radar_leads")
      .select("signal_source, score, street_view_url, raw")
      .gte("created_at", since);
    const sources: Record<string, { count: number; avg_score: number; with_sv: number; llm_only_capped: number }> = {};
    (leads || []).forEach((l: any) => {
      const s = l.signal_source || "unknown";
      sources[s] = sources[s] || { count: 0, avg_score: 0, with_sv: 0, llm_only_capped: 0 };
      sources[s].count++;
      sources[s].avg_score += l.score || 0;
      if (l.street_view_url) sources[s].with_sv++;
      if (l.score === 3 && l.raw?.llm_only) sources[s].llm_only_capped++;
    });
    Object.values(sources).forEach((v) => (v.avg_score = +(v.avg_score / v.count).toFixed(2)));
    result.mortgage_radar = {
      window: "14d",
      total_leads: leads?.length || 0,
      by_source: sources,
      no_street_view_pct: leads?.length
        ? +(((leads.length - Object.values(sources).reduce((a, s) => a + s.with_sv, 0)) / leads.length) * 100).toFixed(1)
        : 0,
    };
  } catch (e) {
    result.mortgage_radar = { error: String(e) };
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
