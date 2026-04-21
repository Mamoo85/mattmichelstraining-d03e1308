// contractor-leads-status — Single-payload E2E health check for the
// contractor leads pipeline (PPL marketplace). Powers AdminContractorLeadsStatus.tsx.
//
// Returns: KPIs, contractors table, sites table, cron health snapshot,
// last outbound message per recipient.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const CONTRACTOR_CRON_NAMES = [
  "contractor-prospector",
  "contractor-lead-notify",
  "contractor-drip",
  "contractor-fomo-mailer",
  "contractor-roi-sms",
  "contractor-aged-lead-downsell",
  "contractor-lead-health-monitor",
  "contractor-renewal-reminder",
  "contractor-roi-report",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing bearer token" });
    }
    const token = authHeader.slice(7).trim();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (token !== SUPABASE_SERVICE_KEY) {
      const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await sbAuth.auth.getUser();
      if (!userData?.user) return json(401, { error: "Invalid session" });
      const { data: role } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .in("role", ["admin", "agency_admin"])
        .maybeSingle();
      if (!role) return json(403, { error: "Admin role required" });
    }

    const now = Date.now();
    const d7 = new Date(now - 7 * 86400_000).toISOString();
    const d30 = new Date(now - 30 * 86400_000).toISOString();

    // -- Parallel fetch: contractors, sites, leads (7d/30d/all), cron health, comms --
    const [
      contractorsRes,
      sitesRes,
      leads7Res,
      leads30Res,
      leadsAllRes,
      cronRes,
      commsRes,
    ] = await Promise.all([
      sb.from("contractor_clients")
        .select("id, business_name, email, phone, trade, city, active, billing_active, dead_lead_billing_active, created_at")
        .order("created_at", { ascending: false }),
      sb.from("contractor_lead_sites")
        .select("id, contractor_id, trade, city, state, active, created_at"),
      sb.from("contractor_leads")
        .select("id, site_id, created_at, status, contact_name, phone, email, trade, city")
        .gte("created_at", d7)
        .order("created_at", { ascending: false }),
      sb.from("contractor_leads")
        .select("id, site_id, created_at")
        .gte("created_at", d30),
      sb.from("contractor_leads").select("id", { count: "exact", head: true }),
      sb.from("cron_job_health")
        .select("jobname, last_success_at, last_run_at, last_error, status, expected_interval_minutes, stale_after_minutes, next_run_at")
        .in("jobname", CONTRACTOR_CRON_NAMES),
      sb.from("system_comms_log")
        .select("id, recipient, channel, product, body_preview, body_full, status, created_at, metadata")
        .or("product.like.contractor%,product.eq.dwa_admin_reply")
        .gte("created_at", d30)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const contractors = contractorsRes.data ?? [];
    const sites = sitesRes.data ?? [];
    const leads7 = leads7Res.data ?? [];
    const leads30 = leads30Res.data ?? [];
    const totalLeadsAll = leadsAllRes.count ?? 0;
    const cronJobs = cronRes.data ?? [];
    const comms = commsRes.data ?? [];

    // -- Build per-contractor stats --
    const sitesByContractor = new Map<string, typeof sites>();
    for (const s of sites) {
      const arr = sitesByContractor.get(s.contractor_id ?? "") ?? [];
      arr.push(s);
      sitesByContractor.set(s.contractor_id ?? "", arr);
    }
    const leads7BySite = new Map<string, number>();
    const leads30BySite = new Map<string, number>();
    for (const l of leads7) leads7BySite.set(l.site_id ?? "", (leads7BySite.get(l.site_id ?? "") ?? 0) + 1);
    for (const l of leads30) leads30BySite.set(l.site_id ?? "", (leads30BySite.get(l.site_id ?? "") ?? 0) + 1);

    const contractorRows = contractors.map((c) => {
      const cSites = sitesByContractor.get(c.id) ?? [];
      const siteIds = cSites.map((s) => s.id);
      const leads_7d = siteIds.reduce((n, id) => n + (leads7BySite.get(id) ?? 0), 0);
      const leads_30d = siteIds.reduce((n, id) => n + (leads30BySite.get(id) ?? 0), 0);
      // Find the last outbound SMS to this contractor
      const phoneE164 = normalizePhone(c.phone);
      const lastOutbound = phoneE164
        ? comms.find(
            (m) =>
              m.recipient === phoneE164 &&
              m.channel === "sms" &&
              (m.status === "sent" || m.status === "delivered"),
          )
        : null;
      return {
        id: c.id,
        business_name: c.business_name,
        email: c.email,
        phone: c.phone,
        trade: c.trade,
        city: c.city,
        active: c.active ?? true,
        billing_active: c.billing_active ?? false,
        dead_lead_billing_active: c.dead_lead_billing_active ?? false,
        sites_count: cSites.length,
        leads_7d,
        leads_30d,
        last_outbound_at: lastOutbound?.created_at ?? null,
      };
    });

    // -- Sites table --
    const contractorById = new Map(contractors.map((c) => [c.id, c.business_name]));
    const siteRows = sites.map((s) => ({
      id: s.id,
      contractor_id: s.contractor_id,
      contractor_name: contractorById.get(s.contractor_id ?? "") ?? "—",
      trade: s.trade,
      city: s.city,
      state: s.state,
      active: s.active,
      leads_7d: leads7BySite.get(s.id) ?? 0,
      leads_30d: leads30BySite.get(s.id) ?? 0,
    }));

    // -- Last outbound per recipient (group comms by recipient) --
    const lastByRecipient = new Map<string, typeof comms[number]>();
    for (const m of comms) {
      if (!m.recipient || m.channel !== "sms") continue;
      if (m.status !== "sent" && m.status !== "delivered") continue;
      if (!lastByRecipient.has(m.recipient)) lastByRecipient.set(m.recipient, m);
    }
    const lastOutboundRows = Array.from(lastByRecipient.values())
      .slice(0, 100)
      .map((m) => ({
        message_id: m.id,
        recipient: m.recipient,
        product: m.product,
        body: m.body_full ?? m.body_preview ?? "",
        body_full_stored: !!m.body_full,
        sent_at: m.created_at,
      }));

    // -- KPIs --
    const kpi = {
      active_contractors: contractors.filter((c) => c.active !== false).length,
      total_contractors: contractors.length,
      total_sites: sites.length,
      leads_7d: leads7.length,
      leads_30d: leads30.length,
      leads_all_time: totalLeadsAll,
      contractors_with_billing: contractors.filter((c) => c.billing_active).length,
    };

    return json(200, {
      generated_at: new Date().toISOString(),
      kpi,
      contractors: contractorRows,
      sites: siteRows,
      cron_health: cronJobs,
      last_outbound: lastOutboundRows,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contractor-leads-status] error:", msg);
    return json(500, { error: msg });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(digits)) return digits;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return null;
}
