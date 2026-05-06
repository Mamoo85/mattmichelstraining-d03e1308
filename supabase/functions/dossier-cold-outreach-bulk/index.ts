// dossier-cold-outreach-bulk
// Admin-triggered: fan out a single Growth Signal to many supply-house buyers.
// Calls dossier-cold-outreach per buyer (silent=true), then sends ONE consolidated
// SMS to Matt summarizing how many emails were queued and where to cancel.
//
// POST { signal_id, buyer_ids: string[] }
//   buyer_ids → public.industrial_supply_buyers
// Returns { queued, skipped, failed, results[] }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

const MAX_BUYERS_PER_RUN = 25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendAdminSMS(body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_PHONE_NUMBER, Body: body }),
    });
  } catch (e) {
    console.error("[bulk] sms fail", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { signal_id, buyer_ids } = await req.json();
    if (!signal_id || !Array.isArray(buyer_ids) || buyer_ids.length === 0) {
      return new Response(JSON.stringify({ error: "signal_id and buyer_ids[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (buyer_ids.length > MAX_BUYERS_PER_RUN) {
      return new Response(JSON.stringify({ error: `max ${MAX_BUYERS_PER_RUN} buyers per run` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch signal name for the SMS summary
    const { data: signal } = await sb
      .from("industry_pulse_signals")
      .select("company_name, industry")
      .eq("id", signal_id)
      .maybeSingle();

    // Fetch buyer rows
    const { data: buyers, error: bErr } = await sb
      .from("industrial_supply_buyers")
      .select("id, vertical, company, contact_name, email")
      .in("id", buyer_ids)
      .eq("active", true);
    if (bErr) throw new Error(`buyers fetch: ${bErr.message}`);
    if (!buyers || buyers.length === 0) {
      return new Response(JSON.stringify({ error: "no active buyers found for given ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fan out — call dossier-cold-outreach per buyer with silent=true
    const results: any[] = [];
    let queued = 0, skipped = 0, failed = 0;

    for (const b of buyers) {
      try {
        const { data, error } = await sb.functions.invoke("dossier-cold-outreach", {
          body: {
            signal_id,
            target_company: b.company,
            target_email: b.email,
            target_contact_name: b.contact_name || undefined,
            vertical: b.vertical,
            silent: true,
          },
        });
        if (error) { failed++; results.push({ buyer_id: b.id, company: b.company, error: error.message }); continue; }
        const d = data as any;
        if (d?.skipped) { skipped++; results.push({ buyer_id: b.id, company: b.company, skipped: true, reason: d.reason }); continue; }
        if (d?.error) { failed++; results.push({ buyer_id: b.id, company: b.company, error: d.error }); continue; }
        queued++;
        results.push({ buyer_id: b.id, company: b.company, draft_id: d?.draft_id, cancel_url: d?.cancel_url, pdf_url: d?.pdf_url });
      } catch (e: any) {
        failed++;
        results.push({ buyer_id: b.id, company: b.company, error: e?.message || "unknown" });
      }
    }

    // ONE consolidated SMS to Matt
    const signalName = signal?.company_name || signal_id.slice(0, 8);
    const cancelAllUrl = `${SUPABASE_URL}/functions/v1/cancel-reply-draft?bulk=1&signal_id=${signal_id}`;
    const summary = `Cold Email batch: ${queued} queued, ${skipped} skipped, ${failed} failed (Re: ${signalName}). Send in 10min. Cancel-all: ${cancelAllUrl}`;
    if (queued > 0) await sendAdminSMS(summary);

    return new Response(JSON.stringify({
      ok: true,
      signal_id,
      signal_company: signal?.company_name || null,
      queued, skipped, failed,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dossier-cold-outreach-bulk]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
