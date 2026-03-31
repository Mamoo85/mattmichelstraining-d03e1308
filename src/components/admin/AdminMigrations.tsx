import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertCircle, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── PENDING MIGRATIONS ──
// Add new migrations here. Already-applied ones are auto-skipped.
const PENDING_MIGRATIONS = [
  {
    name: "20260331000001_seo_page_configs",
    sql: `CREATE TABLE IF NOT EXISTS public.seo_page_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trade TEXT NOT NULL, city TEXT NOT NULL, slug TEXT NOT NULL,
      page_data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.seo_page_configs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk_seo" ON public.seo_page_configs FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000002_outreach_leads_website",
    sql: `ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS website TEXT;`,
  },
  {
    name: "20260331000003_b2b_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.b2b_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      business_name TEXT,
      contact_name TEXT,
      phone TEXT,
      service_type TEXT NOT NULL,
      fulfillment_stage TEXT NOT NULL DEFAULT 'New Lead - Action Required',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.b2b_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk_b2b" ON public.b2b_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_clients_email_service ON public.b2b_clients(email, service_type);`,
  },
  {
    name: "20260331000004_service_subscriptions",
    sql: `CREATE TABLE IF NOT EXISTS public.service_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES public.b2b_clients(id) ON DELETE CASCADE,
      service_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      stripe_subscription_id TEXT,
      started_at TIMESTAMPTZ DEFAULT now(),
      cancelled_at TIMESTAMPTZ
    );
    ALTER TABLE public.service_subscriptions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk_svc" ON public.service_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000010_linkedin_outreach_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.linkedin_outreach_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, industry TEXT, target_title TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.linkedin_outreach_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.linkedin_outreach_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000011_abandoned_cart_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.abandoned_cart_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, platform TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.abandoned_cart_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.abandoned_cart_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000012_client_report_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.client_report_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, agency_type TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.client_report_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.client_report_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000013_restaurant_menu_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.restaurant_menu_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, cuisine_type TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.restaurant_menu_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.restaurant_menu_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000014_insurance_drip_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.insurance_drip_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, insurance_type TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.insurance_drip_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.insurance_drip_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000015_podcast_pitch_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.podcast_pitch_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, expertise TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.podcast_pitch_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.podcast_pitch_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000016_trade_show_followup_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.trade_show_followup_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, industry TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.trade_show_followup_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.trade_show_followup_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000017_testimonial_harvester_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.testimonial_harvester_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, service_type TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.testimonial_harvester_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.testimonial_harvester_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000018_new_mover_marketing_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.new_mover_marketing_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, service_area TEXT, trade TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.new_mover_marketing_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.new_mover_marketing_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260331000019_annual_review_clients",
    sql: `CREATE TABLE IF NOT EXISTS public.annual_review_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, business_name TEXT, contact_name TEXT, industry TEXT, active BOOLEAN NOT NULL DEFAULT true, stripe_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE public.annual_review_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "srk" ON public.annual_review_clients FOR ALL TO service_role USING (true) WITH CHECK (true);`,
  },
  {
    name: "20260401000001_outreach_leads_automation_cols",
    sql: `ALTER TABLE public.outreach_leads
      ADD COLUMN IF NOT EXISTS offer_pitched TEXT,
      ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sms_2_sent BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sms_2_sent_at TIMESTAMPTZ;`,
  },
];

type MigrationResult = { name: string; status: string; error?: string };

export default function AdminMigrations() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<MigrationResult[] | null>(null);
  const [error, setError] = useState("");

  const runMigrations = async () => {
    setRunning(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-migrate", {
        body: { migrations: PENDING_MIGRATIONS },
      });
      if (fnErr) throw fnErr;
      setResults(data?.results || []);
    } catch (e: any) {
      setError(e.message || "Failed to run migrations");
    } finally {
      setRunning(false);
    }
  };

  const applied = results?.filter(r => r.status === "applied").length || 0;
  const skipped = results?.filter(r => r.status === "skipped").length || 0;
  const errors = results?.filter(r => r.status === "error").length || 0;

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Database size={14} /> Database Migrations
          </CardTitle>
          <p className="text-xs text-slate-400 mt-1">
            {PENDING_MIGRATIONS.length} migrations registered. Already-applied ones are automatically skipped.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runMigrations}
            disabled={running}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm"
          >
            {running ? <Loader2 size={14} className="animate-spin mr-2" /> : <Database size={14} className="mr-2" />}
            {running ? "Running..." : "Run All Pending Migrations"}
          </Button>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {results && (
            <div className="mt-4 space-y-2">
              <div className="flex gap-4 text-xs text-slate-400">
                {applied > 0 && <span className="text-green-400">{applied} applied</span>}
                {skipped > 0 && <span className="text-slate-500">{skipped} skipped (already done)</span>}
                {errors > 0 && <span className="text-red-400">{errors} failed</span>}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {results.map((r) => (
                  <div
                    key={r.name}
                    className={`text-xs px-3 py-2 rounded flex items-center gap-2 ${
                      r.status === "applied" ? "bg-green-500/10 text-green-400" :
                      r.status === "skipped" ? "bg-slate-700/50 text-slate-500" :
                      "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {r.status === "applied" && <CheckCircle size={12} />}
                    {r.status === "skipped" && <span className="text-slate-600">—</span>}
                    {r.status === "error" && <AlertCircle size={12} />}
                    <span className="font-mono">{r.name}</span>
                    {r.error && <span className="ml-auto text-red-300 truncate max-w-xs">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
