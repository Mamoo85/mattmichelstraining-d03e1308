// outreach-dead-lead-seed — pulls outreach_leads with phone + no reply 7+ days
// past D14 and inserts them into dead_lead_contacts under the
// "Cold Email Revival" campaign for Matt. Runs daily.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { wrapServe } from "../_shared/telemetry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DAILY_CAP = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

serve(wrapServe("outreach-dead-lead-seed", async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let inserted = 0, skipped = 0;

  try {
    // Find Matt's Cold Email Revival campaign
    const { data: campaign } = await sb
      .from("dead_lead_campaigns")
      .select("id, contractor_id")
      .eq("name", "Cold Email Revival")
      .eq("status", "active")
      .maybeSingle();

    if (!campaign) {
      return new Response(JSON.stringify({ ok: false, error: "Cold Email Revival campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sevenDaysAfterD14 = new Date(Date.now() - 7 * 86400000).toISOString();

    // Candidates: D14 sent 7+ days ago, no reply, has phone
    const { data: candidates, error } = await sb
      .from("outreach_leads")
      .select("id, business_name, owner_name, first_name, phone, owner_phone, email, owner_email, industry")
      .lt("followup_d14_sent_at", sevenDaysAfterD14)
      .is("replied_at", null)
      .or("phone.not.is.null,owner_phone.not.is.null")
      .limit(DAILY_CAP * 2);

    if (error) throw error;
    if (!candidates?.length) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, note: "no candidates" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const c of candidates) {
      if (inserted >= DAILY_CAP) break;

      const phone = normPhone((c.owner_phone as string) || (c.phone as string));
      if (!phone) { skipped++; continue; }

      // Dedupe: skip if phone already exists in dead_lead_contacts
      const { count: existing } = await sb
        .from("dead_lead_contacts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("phone", phone);
      if ((existing ?? 0) > 0) { skipped++; continue; }

      const name = (c.owner_name as string) ||
        [c.first_name, c.business_name].filter(Boolean).join(" ") ||
        (c.business_name as string) ||
        "Unknown";

      const { error: insErr } = await sb.from("dead_lead_contacts").insert({
        campaign_id: campaign.id,
        name,
        phone,
        email: (c.owner_email as string) || (c.email as string) || null,
        original_service: (c.industry as string) || null,
        status: "pending",
      });

      if (insErr) {
        console.error("[seed] insert err:", insErr.message);
        skipped++;
        continue;
      }
      inserted++;
    }

    // Update campaign total
    if (inserted > 0) {
      const { count: total } = await sb
        .from("dead_lead_contacts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);
      await sb.from("dead_lead_campaigns")
        .update({ total_contacts: total ?? 0, updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "outreach-dead-lead-seed",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { inserted, skipped, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ ok: true, inserted, skipped, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[seed] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}));
