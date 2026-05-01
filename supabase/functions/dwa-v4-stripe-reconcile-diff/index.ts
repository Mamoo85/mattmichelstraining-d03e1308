// Stripe reconciliation diff — read-only snapshot for admin dashboard.
// Lists last-7-day Stripe checkout sessions and flags ones missing from product tables.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// type → table + email column
const PRODUCT_MAP: Record<string, { table: string; emailCol: string; label: string }> = {
  hire_alert_subscription: { table: "hire_alert_clients", emailCol: "owner_email", label: "TechAlert" },
  field_crm_subscription: { table: "field_crm_clients", emailCol: "owner_email", label: "FieldDesk" },
  field_service_subscription: { table: "field_crm_clients", emailCol: "owner_email", label: "FieldDesk (legacy)" },
  site_radar_subscription: { table: "field_crm_clients", emailCol: "owner_email", label: "SiteRadar" },
  contractor_lead_subscription: { table: "contractor_clients", emailCol: "owner_email", label: "Contractor Leads" },
  missed_call_subscription: { table: "missed_call_clients", emailCol: "owner_email", label: "Missed-Call Catch" },
  mortgage_radar_subscription: { table: "mortgage_radar_clients", emailCol: "owner_email", label: "Mortgage Radar" },
};

interface Mismatch {
  session_id: string;
  email: string;
  product: string;
  type: string;
  amount_cents: number;
  created_at: string;
  reason: "no_provisioning" | "unknown_type";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

  try {
    const since = Math.floor((Date.now() - 7 * 24 * 3600 * 1000) / 1000);
    const sessions = await stripe.checkout.sessions.list({ created: { gte: since }, limit: 100 });

    const mismatches: Mismatch[] = [];
    let paidCount = 0;
    let provisionedCount = 0;
    const byProduct: Record<string, { paid: number; provisioned: number }> = {};

    for (const s of sessions.data) {
      if (s.payment_status !== "paid" && s.status !== "complete") continue;
      paidCount++;
      const meta = s.metadata || {};
      const type = String(meta.type || "");
      const email = String(meta.email || s.customer_email || "").toLowerCase();
      const cfg = PRODUCT_MAP[type];

      if (!cfg) {
        if (type) {
          mismatches.push({
            session_id: s.id,
            email,
            product: type,
            type,
            amount_cents: s.amount_total ?? 0,
            created_at: new Date(s.created * 1000).toISOString(),
            reason: "unknown_type",
          });
        }
        continue;
      }

      byProduct[cfg.label] ??= { paid: 0, provisioned: 0 };
      byProduct[cfg.label].paid++;

      if (!email) continue;
      const { data } = await sb
        .from(cfg.table)
        .select("id")
        .eq(cfg.emailCol, email)
        .maybeSingle();

      if (data) {
        provisionedCount++;
        byProduct[cfg.label].provisioned++;
      } else {
        mismatches.push({
          session_id: s.id,
          email,
          product: cfg.label,
          type,
          amount_cents: s.amount_total ?? 0,
          created_at: new Date(s.created * 1000).toISOString(),
          reason: "no_provisioning",
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        window_days: 7,
        total_paid_sessions: paidCount,
        total_provisioned: provisionedCount,
        mismatch_count: mismatches.length,
        by_product: byProduct,
        mismatches: mismatches.slice(0, 50),
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
