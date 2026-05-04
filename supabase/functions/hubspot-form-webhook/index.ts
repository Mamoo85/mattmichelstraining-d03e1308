// HubSpot inbound form submission webhook → DWA leads.
// Configure in HubSpot: Workflow → "Trigger a webhook" on form submission.
// URL: https://<project>.supabase.co/functions/v1/hubspot-form-webhook
// No JWT (verify_jwt = false). HubSpot signs requests; we verify via secret token query param.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("HUBSPOT_WEBHOOK_SECRET") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Lightweight auth — HubSpot lets you set a custom query string when wiring the workflow.
    if (SHARED_SECRET) {
      const url = new URL(req.url);
      if (url.searchParams.get("token") !== SHARED_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json().catch(() => ({}));
    // HubSpot workflow webhook ships a single object with `properties` keyed by internal name.
    const props = payload?.properties || payload?.contact?.properties || payload || {};
    const get = (k: string) => props[k]?.value ?? props[k] ?? null;

    const email = get("email");
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "no email" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const lead = {
      email,
      first_name: get("firstname"),
      last_name: get("lastname"),
      phone: get("phone"),
      company: get("company"),
      website: get("website"),
      city: get("city"),
      state: get("state"),
      source: "hubspot_form",
      raw: payload,
      created_at: new Date().toISOString(),
    };

    const { error } = await sb.from("inbound_leads").insert(lead);
    if (error) {
      // Table may not exist yet — fall back to capture_submissions
      await sb.from("capture_submissions").insert({
        email,
        name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null,
        source_url: "hubspot_form",
        tenant_id: "dwa",
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hubspot-form-webhook]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
